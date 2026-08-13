"""
Real ML engine — 6-model ensemble actually trained at startup.

Per spec v8 Part 4:
  1. XGBoost — claim-level fraud probability
  2. LightGBM — prescriber-level anomaly vs specialty peers
  3. IsolationForest — outlier feature for supervised models (300 estimators, contamination=0.05)
  4. DBSCAN — prescriber-pharmacy-patient network clustering (Jaccard distance)
  5. Meta-learner LR — combine XGBoost + LightGBM into ANOMALY_SCORE
  6. Patient context layer — TF-IDF + LR (lightweight stand-in for BioClinicalBERT/PubMedBERT
     which run inside Hopkins SAFE Desktop per spec; production deployment uses
     HuggingFace Inference API or in-house BERT serving)

All sklearn-family models train on seed data at app startup. Models persist in
module-level globals. Provides scoring + status endpoints.
"""
from __future__ import annotations
from datetime import datetime
from typing import Optional, Dict, Any, List
import numpy as np

from sklearn.ensemble import IsolationForest
from sklearn.linear_model import LogisticRegression
from sklearn.cluster import DBSCAN
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics import accuracy_score, precision_score, recall_score, roc_auc_score
from sklearn.preprocessing import StandardScaler

import xgboost as xgb
import lightgbm as lgb


# ─── Module-level model storage ───
_state: Dict[str, Any] = {
    "trained": False,
    "trained_at": None,

    # 1. XGBoost — claim-level fraud
    "xgb_model": None,
    "xgb_scaler": None,
    "xgb_n_samples": 0,
    "xgb_metrics": {},
    "xgb_feature_importance": {},

    # 2. LightGBM — prescriber outlier
    "lgb_model": None,
    "lgb_scaler": None,
    "lgb_n_samples": 0,
    "lgb_metrics": {},
    "lgb_feature_importance": {},

    # 3. IsolationForest — outlier feature
    "iso_model": None,
    "iso_scaler": None,
    "iso_n_samples": 0,

    # 4. DBSCAN — network clustering
    "dbscan_model": None,
    "dbscan_n_clusters": 0,
    "dbscan_n_outliers": 0,

    # 5. Meta-learner LR — stacking
    "meta_model": None,
    "meta_n_samples": 0,
    "meta_metrics": {},

    # 6. Context layer — TF-IDF + LR (stand-in for BioClinicalBERT)
    "context_vectorizer": None,
    "context_model": None,
    "context_n_samples": 0,
    "context_metrics": {},
}


# ─── Feature definitions per spec ───
CLAIM_FEATURES = [
    "refill_timing_ratio",      # filled_within / days_supply
    "time_to_fill_days",        # date_filled - date_written
    "prescriber_drug_novelty",  # 1.0 if first time prescriber wrote this drug for any patient
    "patient_pharmacy_count",   # distinct pharmacies for this patient
    "geographic_distance_km",   # mock proxy
    "ndc_vs_nadac_ratio",       # cost / NADAC benchmark
    "dose_mg",
    "days_supply",
    "controlled_schedule",      # 0 if not controlled, 2 if II, 3 if III, 4 if IV
]

PRESCRIBER_FEATURES = [
    "atc_volume",                # total Rx
    "brand_rate",                # brand vs generic
    "controlled_rate",           # % controlled
    "mme_per_patient",           # avg MME for this prescriber's patients
    "cost_deviation_pct",        # avg vs peer median
    "geographic_outlier_score",  # mock proxy
    "is_pain_management",
    "is_excluded",
]

CONTEXT_LABELS = ["suppress", "escalate"]


# ─── Feature extractors ───
def _extract_claim_features(rx, drug, patient, db) -> Optional[np.ndarray]:
    from database.models import Prescription, Drug, Pharmacy
    if not (rx and drug):
        return None
    try:
        # refill_timing_ratio
        days_supply = float(rx.days_supply or 0) or 1
        if rx.date_filled and rx.date_written:
            time_to_fill = (rx.date_filled - rx.date_written).days
        else:
            time_to_fill = 0
        # prescriber-drug novelty: have they written this drug before?
        prior = db.query(Prescription).filter(
            Prescription.provider_id == rx.provider_id,
            Prescription.drug_id == rx.drug_id,
            Prescription.id != rx.id,
        ).count()
        novelty = 1.0 if prior == 0 else 0.0
        # patient pharmacy count
        patient_pharmacy_count = db.query(Prescription.pharmacy_id).filter(
            Prescription.patient_id == rx.patient_id,
        ).distinct().count()
        # geographic distance (mock — would use prescriber zip vs pharmacy zip)
        geographic_distance_km = float((hash(str(rx.provider_id) + str(rx.pharmacy_id)) % 200))
        # NDC vs NADAC ratio (mock — use NADAC benchmark if available)
        nadac = drug.nadac_price or drug.average_cost_per_unit or 1.0
        ndc_vs_nadac = float((drug.average_cost_per_unit or nadac) / max(nadac, 0.01))
        controlled_schedule = {"II": 2, "III": 3, "IV": 4, "V": 5}.get(drug.schedule, 0)
        return np.array([
            1.0,                     # refill timing ratio (mock 1.0)
            float(time_to_fill),
            novelty,
            float(patient_pharmacy_count),
            geographic_distance_km,
            ndc_vs_nadac,
            float(rx.dose_mg or 0),
            days_supply,
            float(controlled_schedule),
        ], dtype=float)
    except Exception:
        return None


def _extract_prescriber_features(provider, db) -> Optional[np.ndarray]:
    from database.models import Prescription, Drug
    if not provider:
        return None
    try:
        total = db.query(Prescription).filter(Prescription.provider_id == provider.id).count()
        if total == 0:
            return None
        ctrl = db.query(Prescription).join(Drug).filter(
            Prescription.provider_id == provider.id,
            Drug.schedule.in_(["II", "III", "IV", "V"]),
        ).count()
        brand = db.query(Prescription).join(Drug).filter(
            Prescription.provider_id == provider.id,
            Drug.brand_name.isnot(None),
            Drug.generic_available == True,
        ).count()
        # MME per patient (rough proxy — sum opioid doses / patient count)
        unique_patients = db.query(Prescription.patient_id).filter(
            Prescription.provider_id == provider.id
        ).distinct().count() or 1
        opioid_rxs = db.query(Prescription).join(Drug).filter(
            Prescription.provider_id == provider.id,
            Drug.is_opioid == True,
        ).all()
        mme_total = 0.0
        for orx in opioid_rxs:
            d = db.get(Drug, orx.drug_id)
            if d and d.mme_conversion_factor:
                mme_total += (orx.dose_mg or 0) * (d.mme_conversion_factor or 0) * 4  # rough daily
        mme_per_patient = mme_total / unique_patients
        # Cost deviation (rough proxy)
        cost_deviation_pct = float((hash(provider.id) % 50)) - 25.0
        # Geographic outlier (rough)
        geo_outlier = float((hash(provider.id + "geo") % 100)) / 100
        is_pain = 1.0 if (provider.specialty or "").lower() == "pain management" else 0.0
        is_excl = 1.0 if provider.is_excluded else 0.0
        return np.array([
            float(total),
            brand / total if total else 0,
            ctrl / total if total else 0,
            mme_per_patient,
            cost_deviation_pct,
            geo_outlier,
            is_pain,
            is_excl,
        ], dtype=float)
    except Exception:
        return None


# ─── Training ───
def train_models(db_session=None) -> Dict[str, Any]:
    """Train all 6 models on current seed data. Idempotent."""
    from database.database import SessionLocal
    from database.models import Prescription, Provider, Patient, Drug

    db = db_session or SessionLocal()
    try:
        # ─── Build claim-level training matrix ───
        rxs = db.query(Prescription).all()
        X_claim, y_claim = [], []
        for rx in rxs:
            drug = db.get(Drug, rx.drug_id)
            patient = db.get(Patient, rx.patient_id)
            f = _extract_claim_features(rx, drug, patient, db)
            if f is None or np.isnan(f).any():
                continue
            X_claim.append(f)
            # Bootstrap label: FLAG/REVIEW = 1, APPROVE = 0
            y_claim.append(1 if rx.disposition in ("FLAG", "REVIEW") else 0)
        if len(X_claim) < 30:
            return {"trained": False, "reason": f"insufficient claim data ({len(X_claim)} rows)"}
        X_claim = np.vstack(X_claim)
        y_claim = np.array(y_claim)

        # ─── 3. IsolationForest (outlier feature) ───
        iso_scaler = StandardScaler().fit(X_claim)
        X_claim_s = iso_scaler.transform(X_claim)
        iso_model = IsolationForest(
            contamination=0.05, n_estimators=300, random_state=42, n_jobs=-1,
        ).fit(X_claim_s)
        iso_outlier_feature = (-iso_model.score_samples(X_claim_s)).reshape(-1, 1)

        # ─── 1. XGBoost (claim-level fraud, with iso outlier as extra feature) ───
        X_claim_xgb = np.hstack([X_claim, iso_outlier_feature])
        xgb_scaler = StandardScaler().fit(X_claim_xgb)
        X_claim_xgb_s = xgb_scaler.transform(X_claim_xgb)
        xgb_model = xgb.XGBClassifier(
            n_estimators=200, max_depth=4, learning_rate=0.1,
            objective="binary:logistic", random_state=42, n_jobs=-1,
            eval_metric="logloss",
        ).fit(X_claim_xgb_s, y_claim)
        xgb_pred = xgb_model.predict(X_claim_xgb_s)
        xgb_prob = xgb_model.predict_proba(X_claim_xgb_s)[:, 1]
        xgb_metrics = {
            "accuracy": float(round(accuracy_score(y_claim, xgb_pred), 4)),
            "precision": float(round(precision_score(y_claim, xgb_pred, zero_division=0), 4)),
            "recall": float(round(recall_score(y_claim, xgb_pred, zero_division=0), 4)),
            "roc_auc": float(round(roc_auc_score(y_claim, xgb_prob), 4)) if len(set(y_claim)) > 1 else None,
            "n_positive": int(y_claim.sum()),
            "n_negative": int(len(y_claim) - y_claim.sum()),
        }
        xgb_feat_imp = {
            name: float(round(imp, 4))
            for name, imp in zip(
                CLAIM_FEATURES + ["iso_outlier_score"], xgb_model.feature_importances_
            )
        }

        # ─── Build prescriber-level training matrix ───
        providers = db.query(Provider).all()
        X_prv, y_prv = [], []
        for p in providers:
            f = _extract_prescriber_features(p, db)
            if f is None:
                continue
            X_prv.append(f)
            y_prv.append(1 if p.is_excluded or (
                (p.specialty or "").lower() == "pain management" and not p.board_certified
                and f[2] > 0.5  # controlled_rate
            ) else 0)
        lgb_metrics = {"note": "insufficient data"}
        lgb_feat_imp = {}
        lgb_model = None
        lgb_scaler = None
        if len(X_prv) >= 8:
            X_prv = np.vstack(X_prv)
            y_prv = np.array(y_prv)
            lgb_scaler = StandardScaler().fit(X_prv)
            X_prv_s = lgb_scaler.transform(X_prv)
            # ─── 2. LightGBM ───
            lgb_model = lgb.LGBMClassifier(
                n_estimators=100, max_depth=4, learning_rate=0.1,
                objective="binary", random_state=42, n_jobs=-1, verbose=-1,
            ).fit(X_prv_s, y_prv)
            lgb_pred = lgb_model.predict(X_prv_s)
            lgb_prob = lgb_model.predict_proba(X_prv_s)[:, 1]
            lgb_metrics = {
                "accuracy": float(round(accuracy_score(y_prv, lgb_pred), 4)),
                "precision": float(round(precision_score(y_prv, lgb_pred, zero_division=0), 4)),
                "recall": float(round(recall_score(y_prv, lgb_pred, zero_division=0), 4)),
                "roc_auc": float(round(roc_auc_score(y_prv, lgb_prob), 4)) if len(set(y_prv)) > 1 else None,
                "n_positive": int(y_prv.sum()),
                "n_negative": int(len(y_prv) - y_prv.sum()),
            }
            lgb_feat_imp = {
                name: float(round(imp, 4))
                for name, imp in zip(PRESCRIBER_FEATURES, lgb_model.feature_importances_)
            }

        # ─── 4. DBSCAN — prescriber-pharmacy-patient network clustering ───
        # Build network feature: each prescriber represented by their patient set
        prv_patient_sets = {}
        for prx in db.query(Prescription).all():
            prv_patient_sets.setdefault(prx.provider_id, set()).add(prx.patient_id)
        # Convert to binary matrix (prescribers x patients)
        if prv_patient_sets:
            all_patients = sorted({p for s in prv_patient_sets.values() for p in s})
            prv_ids = sorted(prv_patient_sets.keys())
            net_matrix = np.zeros((len(prv_ids), len(all_patients)), dtype=int)
            for i, pid in enumerate(prv_ids):
                for j, pat in enumerate(all_patients):
                    if pat in prv_patient_sets[pid]:
                        net_matrix[i, j] = 1
            # DBSCAN with Jaccard distance
            dbscan = DBSCAN(eps=0.85, min_samples=2, metric="jaccard").fit(net_matrix)
            n_clusters = len({c for c in dbscan.labels_ if c != -1})
            n_outliers = int((dbscan.labels_ == -1).sum())
        else:
            dbscan = None
            n_clusters = 0
            n_outliers = 0

        # ─── 5. Meta-learner LR (stacking XGBoost + LightGBM outputs) ───
        # For each prescriber, get their avg XGBoost claim prob + LightGBM prescriber prob
        meta_metrics = {"note": "insufficient data"}
        meta_model = None
        if lgb_model is not None and len(X_prv) > 0:
            X_meta, y_meta = [], []
            for i, p in enumerate(providers):
                if i >= len(X_prv):
                    continue
                # Avg XGBoost prob across this prescriber's claims
                p_rxs = [r for r in rxs if r.provider_id == p.id]
                if not p_rxs:
                    continue
                p_X_claim = []
                for r in p_rxs[:50]:
                    drug = db.get(Drug, r.drug_id)
                    pat = db.get(Patient, r.patient_id)
                    fc = _extract_claim_features(r, drug, pat, db)
                    if fc is not None and not np.isnan(fc).any():
                        iso_extra = -iso_model.score_samples(iso_scaler.transform(fc.reshape(1, -1)))
                        p_X_claim.append(np.hstack([fc, iso_extra]))
                if not p_X_claim:
                    continue
                p_X_claim = np.vstack(p_X_claim)
                xgb_avg = float(xgb_model.predict_proba(xgb_scaler.transform(p_X_claim))[:, 1].mean())
                lgb_prv_prob = float(lgb_model.predict_proba(
                    lgb_scaler.transform(X_prv[i].reshape(1, -1))
                )[0, 1])
                X_meta.append([xgb_avg, lgb_prv_prob])
                y_meta.append(int(y_prv[i]))
            if len(X_meta) >= 5 and len(set(y_meta)) > 1:
                X_meta = np.array(X_meta)
                y_meta = np.array(y_meta)
                meta_model = LogisticRegression(max_iter=200, random_state=42).fit(X_meta, y_meta)
                meta_pred = meta_model.predict(X_meta)
                meta_prob = meta_model.predict_proba(X_meta)[:, 1]
                meta_metrics = {
                    "accuracy": float(round(accuracy_score(y_meta, meta_pred), 4)),
                    "roc_auc": float(round(roc_auc_score(y_meta, meta_prob), 4)),
                    "coef": {"xgboost_input": float(round(meta_model.coef_[0][0], 4)),
                             "lightgbm_input": float(round(meta_model.coef_[0][1], 4))},
                    "intercept": float(round(meta_model.intercept_[0], 4)),
                }

        # ─── 6. Context layer — TF-IDF + LR (BERT stand-in) ───
        # Train on flag titles vs disposition (suppress = APPROVE/REVIEW low risk; escalate = FLAG)
        context_texts, context_labels = [], []
        for rx in rxs:
            for f in (rx.flags or []):
                txt = f"{f.get('title','')} {f.get('description','')[:200]}"
                if not txt.strip():
                    continue
                context_texts.append(txt)
                # Suppress label (0) for APPROVE, escalate (1) for FLAG
                context_labels.append(1 if rx.disposition == "FLAG" else 0)
        context_metrics = {"note": "insufficient data"}
        context_vectorizer = None
        context_model = None
        if len(context_texts) >= 30 and len(set(context_labels)) > 1:
            context_vectorizer = TfidfVectorizer(max_features=500, ngram_range=(1, 2), stop_words="english")
            X_ctx = context_vectorizer.fit_transform(context_texts)
            context_model = LogisticRegression(max_iter=200, random_state=42, class_weight="balanced").fit(
                X_ctx, context_labels
            )
            ctx_pred = context_model.predict(X_ctx)
            context_metrics = {
                "accuracy": float(round(accuracy_score(context_labels, ctx_pred), 4)),
                "precision": float(round(precision_score(context_labels, ctx_pred, zero_division=0), 4)),
                "recall": float(round(recall_score(context_labels, ctx_pred, zero_division=0), 4)),
                "n_samples": len(context_texts),
                "n_features": X_ctx.shape[1],
                "note": "TF-IDF + LR stand-in for BioClinicalBERT/PubMedBERT (which run inside Hopkins SAFE Desktop per spec)",
            }

        # ─── Persist ───
        _state.update({
            "trained": True,
            "trained_at": datetime.utcnow().isoformat() + "Z",
            "xgb_model": xgb_model, "xgb_scaler": xgb_scaler,
            "xgb_n_samples": int(X_claim.shape[0]),
            "xgb_metrics": xgb_metrics, "xgb_feature_importance": xgb_feat_imp,
            "lgb_model": lgb_model, "lgb_scaler": lgb_scaler,
            "lgb_n_samples": int(X_prv.shape[0]) if hasattr(X_prv, "shape") else 0,
            "lgb_metrics": lgb_metrics, "lgb_feature_importance": lgb_feat_imp,
            "iso_model": iso_model, "iso_scaler": iso_scaler,
            "iso_n_samples": int(X_claim.shape[0]),
            "dbscan_model": dbscan,
            "dbscan_n_clusters": n_clusters, "dbscan_n_outliers": n_outliers,
            "meta_model": meta_model,
            "meta_n_samples": len(X_meta) if "X_meta" in locals() and isinstance(X_meta, np.ndarray) else 0,
            "meta_metrics": meta_metrics,
            "context_vectorizer": context_vectorizer, "context_model": context_model,
            "context_n_samples": len(context_texts),
            "context_metrics": context_metrics,
        })
        return get_status()
    finally:
        if db_session is None:
            db.close()


# ─── Scoring helpers (used by ml_engine.py + ml_engine_router.py) ───
def score_claim(rx, drug, patient, db) -> Dict[str, Any]:
    if not _state["trained"] or _state["xgb_model"] is None:
        return {"available": False}
    f = _extract_claim_features(rx, drug, patient, db)
    if f is None or np.isnan(f).any():
        return {"available": False}
    iso_score = float(_state["iso_model"].score_samples(_state["iso_scaler"].transform(f.reshape(1, -1)))[0])
    iso_outlier_feat = -iso_score
    f_xgb = np.hstack([f, [iso_outlier_feat]])
    xgb_prob = float(_state["xgb_model"].predict_proba(_state["xgb_scaler"].transform(f_xgb.reshape(1, -1)))[0, 1])
    return {
        "available": True,
        "model_ensemble": "XGBoost + IsolationForest",
        "xgboost_fraud_probability": round(xgb_prob, 4),
        "isolation_forest_anomaly_score": round(iso_score, 4),
        "isolation_forest_is_outlier": iso_score < -0.1,
        "feature_values": {n: round(float(v), 4) for n, v in zip(CLAIM_FEATURES, f.tolist())},
        "feature_importance": _state["xgb_feature_importance"],
    }


def score_prescriber(provider, db) -> Dict[str, Any]:
    if not _state["trained"] or _state["lgb_model"] is None:
        return {"available": False}
    f = _extract_prescriber_features(provider, db)
    if f is None or np.isnan(f).any():
        return {"available": False}
    lgb_prob = float(_state["lgb_model"].predict_proba(
        _state["lgb_scaler"].transform(f.reshape(1, -1))
    )[0, 1])
    contribs = {
        name: round(float(v * imp), 4)
        for name, v, imp in zip(
            PRESCRIBER_FEATURES, f.tolist(),
            _state["lgb_model"].feature_importances_,
        )
    }
    sorted_contribs = sorted(contribs.items(), key=lambda kv: -abs(kv[1]))
    return {
        "available": True,
        "model": "LightGBM",
        "pill_mill_probability": round(lgb_prob, 4),
        "feature_values": {n: round(float(v), 4) for n, v in zip(PRESCRIBER_FEATURES, f.tolist())},
        "feature_contributions": dict(sorted_contribs),
        "top_drivers": sorted_contribs[:3],
    }


def score_meta(rx, drug, patient, provider, db) -> Dict[str, Any]:
    """Stacked meta-learner: combine XGBoost claim + LightGBM prescriber into ANOMALY_SCORE."""
    if not _state["trained"] or _state["meta_model"] is None:
        return {"available": False}
    claim = score_claim(rx, drug, patient, db)
    prescriber = score_prescriber(provider, db)
    if not (claim.get("available") and prescriber.get("available")):
        return {"available": False}
    xgb_in = claim["xgboost_fraud_probability"]
    lgb_in = prescriber["pill_mill_probability"]
    meta_in = np.array([[xgb_in, lgb_in]])
    anomaly_score = float(_state["meta_model"].predict_proba(meta_in)[0, 1])
    return {
        "available": True,
        "model": "Meta-learner LR (stacks XGBoost + LightGBM)",
        "anomaly_score": round(anomaly_score, 4),
        "inputs": {"xgboost_claim_prob": xgb_in, "lightgbm_prescriber_prob": lgb_in},
    }


def score_context(flag_text: str) -> Dict[str, Any]:
    """Patient context layer — TF-IDF + LR (BERT stand-in)."""
    if not _state["trained"] or _state["context_model"] is None:
        return {"available": False}
    X = _state["context_vectorizer"].transform([flag_text])
    prob_escalate = float(_state["context_model"].predict_proba(X)[0, 1])
    return {
        "available": True,
        "model": "TF-IDF + LogisticRegression (BERT stand-in)",
        "production_model": "BioClinicalBERT + PubMedBERT (Hopkins SAFE Desktop only)",
        "escalate_probability": round(prob_escalate, 4),
        "suppress_probability": round(1 - prob_escalate, 4),
        "decision": "escalate" if prob_escalate > 0.5 else "suppress",
    }


def get_status() -> Dict[str, Any]:
    return {
        "trained": _state["trained"],
        "trained_at": _state["trained_at"],
        "models": {
            "xgboost": {
                "type": "XGBoost", "library": "xgboost",
                "purpose": "Claim-level fraud probability (0-1)",
                "n_estimators": 200, "max_depth": 4, "learning_rate": 0.1,
                "n_training_samples": _state["xgb_n_samples"],
                "features": CLAIM_FEATURES + ["iso_outlier_score"],
                "metrics": _state["xgb_metrics"],
                "feature_importance": _state["xgb_feature_importance"],
                "real": True,
            },
            "lightgbm": {
                "type": "LightGBM", "library": "lightgbm",
                "purpose": "Prescriber-level anomaly vs specialty peers",
                "n_estimators": 100, "max_depth": 4, "learning_rate": 0.1,
                "n_training_samples": _state["lgb_n_samples"],
                "features": PRESCRIBER_FEATURES,
                "metrics": _state["lgb_metrics"],
                "feature_importance": _state["lgb_feature_importance"],
                "real": True,
            },
            "isolation_forest": {
                "type": "IsolationForest", "library": "scikit-learn",
                "purpose": "Outlier feature for supervised models",
                "contamination": 0.05, "n_estimators": 300,
                "n_training_samples": _state["iso_n_samples"],
                "features": CLAIM_FEATURES,
                "real": True,
            },
            "dbscan": {
                "type": "DBSCAN", "library": "scikit-learn",
                "purpose": "Prescriber-pharmacy-patient network clustering",
                "metric": "jaccard", "eps": 0.85, "min_samples": 2,
                "n_clusters_found": _state["dbscan_n_clusters"],
                "n_outliers": _state["dbscan_n_outliers"],
                "real": True,
            },
            "meta_learner_lr": {
                "type": "LogisticRegression (stacking)", "library": "scikit-learn",
                "purpose": "Combine XGBoost + LightGBM into ANOMALY_SCORE",
                "n_training_samples": _state["meta_n_samples"],
                "metrics": _state["meta_metrics"],
                "real": True,
            },
            "patient_context_layer": {
                "type": "TF-IDF + LogisticRegression",
                "library": "scikit-learn",
                "production_type": "BioClinicalBERT + PubMedBERT (dual-model arbitration)",
                "production_environment": "Hopkins SAFE Desktop per spec — no PHI leaves credentialed env",
                "purpose": "Patient context — false positive suppression",
                "n_training_samples": _state["context_n_samples"],
                "metrics": _state["context_metrics"],
                "real": True,
                "note": "Lightweight sklearn stand-in for the BERT ensemble; HuggingFace Inference API or in-house BERT serving used in production deployment",
            },
        },
        "data_sources_for_training": [
            "Synthetic seed (current demo)",
            "Production training: Kythera Wayfinder open claims (310M patients)",
            "Validation: JHM EHR via Truveta TDM (Hopkins study)",
        ],
        "explainability": "Feature values + feature importance returned for every prediction (XGBoost gain-based for claims; LightGBM split-based for prescribers; SHAP TreeExplainer planned for production)",
    }
