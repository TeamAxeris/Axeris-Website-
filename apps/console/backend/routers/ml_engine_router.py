"""
ML Engine status + on-demand prediction endpoints.

Exposes the real scikit-learn models trained at startup:
  - GET /ml-engine/status — model metadata, training samples, metrics, feature importance
  - GET /ml-engine/predict-claim/{rx_id} — IsolationForest score for a specific claim
  - GET /ml-engine/predict-prescriber/{provider_id} — GBM pill-mill probability + drivers
  - POST /ml-engine/retrain — re-train both models on current data
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database.database import get_db
from database.models import Prescription, Provider, Patient, Drug
from engines import ml_models

router = APIRouter(prefix="/ml-engine", tags=["ml-engine"])


@router.get("/status")
def status():
    """Real ML engine state: trained models, samples, metrics, feature importance."""
    return ml_models.get_status()


@router.post("/retrain")
def retrain():
    """Re-train both scikit-learn models on current claims data."""
    return ml_models.train_models()


@router.get("/predict-claim/{rx_id}")
def predict_claim(rx_id: str, db: Session = Depends(get_db)):
    """Run the live IsolationForest model on a specific claim."""
    rx = db.get(Prescription, rx_id)
    if not rx:
        raise HTTPException(404, "prescription not found")
    drug = db.get(Drug, rx.drug_id)
    patient = db.get(Patient, rx.patient_id)
    return {
        "rx_id": rx_id,
        "prediction": ml_models.score_claim(rx, drug, patient, db),
    }


@router.get("/predict-prescriber/{provider_id}")
def predict_prescriber(provider_id: str, db: Session = Depends(get_db)):
    """Run the live GradientBoosting model on a specific prescriber."""
    provider = db.get(Provider, provider_id)
    if not provider:
        raise HTTPException(404, "provider not found")
    return {
        "provider_id": provider_id,
        "provider_name": f"Dr. {provider.first_name} {provider.last_name}",
        "specialty": provider.specialty,
        "prediction": ml_models.score_prescriber(provider, db),
    }


_ENGINE_META = {
    "RULE": {"engine": 1, "name": "Rules Engine",
             "description": "Deterministic clinical safety checks — dose limits, DDI, allergy cross-reactivity, REMS, exclusion lists. Evidence-anchored, zero-latency, fully explainable."},
    "ML":   {"engine": 2, "name": "ML Engine",
             "description": "XGBoost claim fraud + LightGBM prescriber outlier + IsolationForest anomaly + DBSCAN network clustering, blended by a logistic meta-learner."},
    "PAT":  {"engine": 3, "name": "Patient-Context Engine",
             "description": "Member-specific layer — renal/hepatic function, pharmacogenomics, age, polypharmacy burden. Escalates true risk and suppresses false positives the population-level engines can't see."},
}


@router.get("/intelligence")
def engine_intelligence(db: Session = Depends(get_db)):
    """Engine Intelligence — how the 3-engine ensemble actually performs.

    Per-engine flag attribution, live sklearn model metrics, latency
    percentiles, cross-engine disagreement (what the ensemble catches that
    a single engine would miss), and Engine-3 context influence.
    """
    rxs = db.query(Prescription).all()

    # Per-engine attribution from flag_id prefixes (RULE- / ML- / PAT-)
    engines: dict = {}
    check_hits: dict = {}
    rule_rx, ml_rx, pat_rx = set(), set(), set()
    for rx in rxs:
        for f in (rx.flags or []):
            fid = f.get("flag_id") or ""
            prefix = fid.split("-")[0]
            if prefix not in _ENGINE_META:
                continue
            e = engines.setdefault(prefix, {"flags": 0, "critical": 0, "warning": 0, "info": 0})
            e["flags"] += 1
            sev = f.get("severity") or "info"
            e[sev if sev in ("critical", "warning") else "info"] += 1
            ch = check_hits.setdefault(fid, {"flag_id": fid, "title": f.get("title", ""), "engine": prefix, "hits": 0})
            ch["hits"] += 1
            if prefix == "RULE":
                rule_rx.add(rx.id)
            elif prefix == "ML":
                ml_rx.add(rx.id)
            elif prefix == "PAT":
                pat_rx.add(rx.id)

    # Cross-engine disagreement — the ensemble's value: claims only ONE
    # engine catches would be misses in a single-engine system.
    ml_only = ml_rx - rule_rx
    rule_only = rule_rx - ml_rx
    both = rule_rx & ml_rx

    # Engine-3 context influence: PAT-flagged claims that still auto-approved
    # (context downgraded population-level noise) vs escalated to FLAG.
    pat_suppressed = sum(1 for rx in rxs if rx.id in pat_rx and rx.disposition == "APPROVE")
    pat_escalated = sum(1 for rx in rxs if rx.id in pat_rx and rx.disposition == "FLAG")

    lat = sorted(rx.processing_time_ms for rx in rxs if rx.processing_time_ms)
    latency = {
        "avg_ms": round(sum(lat) / len(lat), 1) if lat else 0,
        "p50_ms": lat[len(lat) // 2] if lat else 0,
        "p95_ms": lat[int(len(lat) * 0.95) - 1] if lat else 0,
        "p99_ms": lat[int(len(lat) * 0.99) - 1] if lat else 0,
        "sla_target_ms": 200,
        "within_sla_pct": round(sum(1 for x in lat if x < 200) / len(lat) * 100, 1) if lat else 0,
    }

    top_checks = sorted(check_hits.values(), key=lambda c: -c["hits"])[:12]

    return {
        "engines": [
            {**_ENGINE_META[k], **engines.get(k, {"flags": 0, "critical": 0, "warning": 0, "info": 0}),
             "claims_touched": len({"RULE": rule_rx, "ML": ml_rx, "PAT": pat_rx}[k])}
            for k in ("RULE", "ML", "PAT")
        ],
        "models": ml_models.get_status(),
        "latency": latency,
        "ensemble_value": {
            "claims_flagged_by_both": len(both),
            "ml_only_catches": len(ml_only),
            "rules_only_catches": len(rule_only),
            "ml_only_sample": sorted(ml_only)[:8],
            "rules_only_sample": sorted(rule_only)[:8],
            "narrative": "Claims flagged by only one engine are the ensemble's edge — a rules-only PBM system misses every ML-only catch; a pure-ML system misses the deterministic safety blocks.",
        },
        "context_layer": {
            "pat_flagged_claims": len(pat_rx),
            "suppressed_to_auto_approve": pat_suppressed,
            "escalated_to_hard_block": pat_escalated,
            "narrative": "Engine 3 personalizes the verdict: the same drug/dose can be safe for one member and contraindicated for another (renal function, PGx phenotype, polypharmacy burden).",
        },
        "top_checks": top_checks,
    }
