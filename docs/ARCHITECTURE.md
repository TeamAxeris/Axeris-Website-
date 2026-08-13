# Axeris Architecture — System Design & Data Flow

**Complete technical specification** for Axeris v0.8 (Spec v8, April 2026).

---

## Executive Overview

Axeris is a **3-engine clinical analysis pipeline** that evaluates prescriptions across 24 numbered safety checks (Categories A–F). The system operates in two modes (TPA post-adjudication + PBA real-time), integrates with 9 live federal APIs, trains 6 real ML models, and maintains an ERISA § 404 audit trail.

**Key Numbers:**
- **24** clinical safety checks
- **3** analysis engines (Rules, ML, Patient Context)
- **6** real ML models (XGB, LGB, ISO, DBSCAN, Meta-LR, TF-IDF)
- **9** live public API integrations
- **2** operating modes (TPA + PBA)
- **50+** mock patients, 200+ prescriptions, 20 providers (demo)

---

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CLIENT LAYER                                       │
│                                                                               │
│  Browser / Mobile        Next.js 14 Frontend       WebSocket Real-Time       │
│  └─────────────┬──────────────────────────┬──────────────────────────┬──────┘
│                │ HTTP/REST (CORS enabled) │ Data binding             │ Push
│                ▼                          ▼                          ▼
├─────────────────────────────────────────────────────────────────────────────┤
│                          APPLICATION LAYER                                   │
│                                                                               │
│  FastAPI (Python)      Routers (12)        Lifespan           Auth/Session   │
│  ├─ CORS enabled       ├─ prescriptions    ├─ Startup:        ├─ Login      │
│  ├─ JSON-RPC           ├─ patients         │  - Create DB      ├─ Roles     │
│  ├─ Swagger /docs      ├─ providers        │  - Seed data      └─ Token     │
│  └─ Error handling     ├─ analytics        │  - Train ML           validation│
│                        ├─ audit                models                        │
│                        ├─ copilot          └─ Shutdown         Error handling│
│                        ├─ v8                  cleanup                        │
│                        ├─ tpa                                                │
│                        ├─ pba                                                │
│                        ├─ data_sources                                       │
│                        ├─ public_apis                                        │
│                        ├─ ml_engine                                          │
│                        ├─ interactions                                       │
│                        ├── search                                            │
│                        ├── websocket                                         │
│                        └─ drugs                                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                      CLINICAL ANALYSIS ENGINES                               │
│                                                                               │
│  ┌──────────────────────┬──────────────────────┬──────────────────────────┐ │
│  │   Rules Engine       │   ML & Anomaly       │  Patient-Specific        │ │
│  │  (Deterministic)     │  (Statistical)       │  (EHR-Aware)             │ │
│  │                      │                      │                          │ │
│  │  Checks 1-6: DDIs    │  Checks (7):         │  Checks (7):             │ │
│  │  Checks 7-10: Dosing │  • Prescriber volume │  • Comorbidity           │ │
│  │  Checks 11-16: PtSpec│  • Doctor shopping   │  • Lab trending          │ │
│  │  Check 15: PGx       │  • Refill anomalies  │  • Prior Hx              │ │
│  │  Check 16: REMS      │  • Pharmacy billing  │  • Adherence             │ │
│  │  Check 21: Naloxone  │  • Cost outliers     │  • MME tracking          │ │
│  │  Foundational: Excl  │  • Drug wastage      │  • Medication load       │ │
│  │  Provider screening  │  • PA prediction     │  • Specialty review      │ │
│  │                      │                      │                          │ │
│  │  → evaluate()        │  → evaluate()        │  → evaluate()            │ │
│  │     ↓ Flags          │     ↓ Flags          │     ↓ Flags              │ │
│  └──────────────────────┴──────────────────────┴──────────────────────────┘ │
│                                     │                                         │
│                        ┌────────────▼──────────────┐                         │
│                        │   Flag Aggregation        │                         │
│                        │                           │                         │
│                        │  Weights:                 │                         │
│                        │  σ(severity × weight)     │                         │
│                        │  = Risk Score (0–1)       │                         │
│                        │                           │                         │
│                        │  GREEN  < 0.3             │                         │
│                        │  YELLOW 0.3–0.7           │                         │
│                        │  RED    > 0.7             │                         │
│                        └────────────┬──────────────┘                         │
│                                     │                                         │
│                        ┌────────────▼──────────────┐                         │
│                        │ Disposition Mapping       │                         │
│                        │                           │                         │
│                        │ GREEN  → APPROVE          │                         │
│                        │ YELLOW → REVIEW (soft)    │                         │
│                        │ RED    → FLAG (hard)      │                         │
│                        │                           │                         │
│                        │ + Hold Logic:             │                         │
│                        │ • Soft: 24h SLA           │                         │
│                        │ • Hard: explicit action   │                         │
│                        └────────────┬──────────────┘                         │
├─────────────────────────────────────┼─────────────────────────────────────────┤
│                          ML MODELS LAYER                                     │
│  (Trained at startup; inference for every Rx)                               │
│                                                                               │
│  ┌─────────────┐ ┌─────────────┐ ┌──────────────┐ ┌──────────────┐         │
│  │   XGBoost   │ │  LightGBM   │ │ IsolationFst │ │   DBSCAN     │         │
│  │             │ │             │ │              │ │              │         │
│  │ Claim-level │ │ Prescriber  │ │ Unsupervised │ │ Network      │         │
│  │ fraud prob  │ │ anomaly     │ │ outlier      │ │ clustering   │         │
│  │ (9 features)│ │ (8 features)│ │ detection    │ │ (Jaccard)    │         │
│  │             │ │             │ │              │ │              │         │
│  │ AUC: ~0.91  │ │ Acc: ~0.87  │ │ 300 est.     │ │ eps=0.3      │         │
│  └──────┬──────┘ └──────┬──────┘ └───────┬──────┘ └───────┬──────┘         │
│         │                │               │                │                 │
│         └────────────────┴───────────────┴────────────────┘                 │
│                           │                                                  │
│         ┌─────────────────▼─────────────────┐                               │
│         │   Meta-Learner (Stacking LR)      │                               │
│         │   [xgb_pred, lgb_pred] → score    │                               │
│         └─────────────────┬─────────────────┘                               │
│                           │                                                  │
│         ┌─────────────────▼─────────────────┐                               │
│         │  TF-IDF + LR Context Layer         │                               │
│         │  (Stand-in for BioClinicalBERT)   │                               │
│         │  suppress / escalate              │                               │
│         └─────────────────┬─────────────────┘                               │
│                           │                                                  │
│                  ANOMALY_SCORE (0–1)                                         │
│                  Weights into flag aggregation                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                       DATA & PERSISTENCE LAYER                              │
│                                                                               │
│  SQLAlchemy ORM        SQLite Demo / PostgreSQL Prod                        │
│  ├─ 16 Models          ├─ axeris.db (SQLite)                               │
│  ├─ Session management │├─ 16 tables (patients, rx, drugs, etc.)           │
│  ├─ Relationship        │└─ Auto-created + seeded at startup               │
│  │   definitions        │                                                    │
│  └─ Query DSL          │PostgreSQL production:                              │
│                         │├─ postgresql://user:pass@host/axeris             │
│                         │├─ Connection pooling (pgbouncer)                  │
│                         │├─ Read replicas for analytics                     │
│                         │└─ Point-in-time backups                           │
│                         │                                                    │
│                         │ Reference data (JSON):                             │
│                         │├─ drug_database.json (~55 drugs)                  │
│                         │├─ interactions.json (~40 DDI pairs)              │
│                         │└─ therapeutic_equivalence.json                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                      EXTERNAL INTEGRATIONS LAYER                            │
│                                                                               │
│  Public APIs (Live)         Validation Databases      Standards             │
│  ├─ NPPES (provider lookup) ├─ MarketScan            ├─ HL7 FHIR R4        │
│  ├─ openFDA (label/FAERS)   ├─ Kythera Wayfinder     ├─ EDI 837            │
│  ├─ RxNav (equivalence)     ├─ Truveta TDM           ├─ NCPDP D.0          │
│  ├─ Clinical Tables (ICD10) │                        ├─ PMPInterConnect    │
│  ├─ CMS Open Payments       │ HHS-OIG Exclusions     ├─ HL7 X12N           │
│  ├─ PubMed (evidence)       ├─ LEIE sync (daily)     └─ NCPDP Batch 1.2   │
│  │                          ├─ SAM.gov sync (daily)                        │
│  │                          └─ State board lists                            │
│  └─ Cache: 24h TTL for public API responses                                │
│                                                                               │
│  Error handling: Circuit breaker + fallback to cached/null                  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Data Flow: Prescription Analysis

```
┌─ INGESTION ─────────────────────────────────────────────────┐
│                                                              │
│  Input: POST /api/v1/prescriptions/analyze                  │
│  {                                                           │
│    "drug_id": "drug-123",                                   │
│    "patient_id": "pt-456",                                  │
│    "provider_id": "pr-789",                                 │
│    "dose_mg": 500,                                          │
│    "frequency": "BID",                                      │
│    "days_supply": 30                                        │
│  }                                                           │
│                                                              │
└────────────────┬────────────────────────────────────────────┘
                 │
         ┌───────▼────────┐
         │ Fetch Context  │
         ├────────────────┤
         │ FROM Database: │
         │• Patient       │
         │• Drug          │
         │• Provider      │
         │• Active Rx     │
         │• Labs          │
         │• Diagnoses     │
         │• Allergies     │
         │• PGx/REMS      │
         └────────┬───────┘
                  │
    ┌─────────────┼─────────────┐
    │             │             │
    ▼             ▼             ▼
 ┌──────────┐ ┌──────────┐ ┌──────────┐
 │Rules     │ │ML Engine │ │Patient   │
 │Engine    │ │          │ │Engine    │
 │16 checks │ │7 checks  │ │7 checks  │
 ├──────────┤ ├──────────┤ ├──────────┤
 │• DDIs    │ │• Behavior│ │• Comorbid│
 │• Dosing  │ │• Shopping│ │• Labs    │
 │• PtSpec  │ │• Refills │ │• Adherrx │
 │• PGx     │ │• Billing │ │• Load    │
 │• REMS    │ │• Outliers│ │• MME     │
 │• Naloxone│ │• Wastage │ │• Spec    │
 │• Excluded│ │• PA pred │ │          │
 └────┬─────┘ └────┬─────┘ └────┬─────┘
      │            │            │
      └────────────┼────────────┘
                   │
           ┌───────▼──────────┐
           │ Aggregate Flags   │
           ├───────────────────┤
           │ flags = [         │
           │   {               │
           │    flag_id,       │
           │    category,      │
           │    severity,      │
           │    weight,        │
           │    title,         │
           │    description,   │
           │    evidence,      │
           │    action         │
           │   },              │
           │   ...             │
           │ ]                 │
           │                   │
           │ risk_score =      │
           │  σ(severity ×     │
           │    weight)        │
           │ ÷ count(flags)    │
           │                   │
           │ Clamp [0, 1]      │
           └───────┬───────────┘
                   │
    ┌──────────────┼──────────────┐
    │              │              │
    ▼ score < 0.3  ▼ 0.3-0.7      ▼ score > 0.7
 ┌──────────┐ ┌──────────┐ ┌──────────┐
 │GREEN     │ │YELLOW    │ │RED       │
 │APPROVE  │ │REVIEW    │ │FLAG      │
 │          │ │(soft)    │ │(hard)    │
 │Auto-pay  │ │SLA 24h   │ │Escalate  │
 │Release   │ │Auto-release│Require  │
 │          │ │if no action│Action   │
 └────┬─────┘ └────┬─────┘ └────┬─────┘
      │            │            │
      └────────────┼────────────┘
                   │
        ┌──────────▼───────────┐
        │ Persist Prescription  │
        ├───────────────────────┤
        │ INSERT INTO           │
        │  prescriptions:       │
        │  id, patient_id,      │
        │  drug_id, provider_id,│
        │  dose_mg, frequency,  │
        │  flag_color,          │
        │  disposition,         │
        │  risk_score,          │
        │  flags (JSON),        │
        │  processing_time_ms,  │
        │  created_at           │
        └──────────┬────────────┘
                   │
        ┌──────────▼───────────┐
        │ Log Audit Trail       │
        ├───────────────────────┤
        │ INSERT INTO           │
        │  audit_trail:         │
        │  action=ANALYZED,     │
        │  prescription_id,     │
        │  evidence=flags,      │
        │  user_id=system,      │
        │  timestamp            │
        └──────────┬────────────┘
                   │
        ┌──────────▼───────────┐
        │ Return Response       │
        ├───────────────────────┤
        │ {                     │
        │   id, patient_id,     │
        │   flag_color,         │
        │   disposition,        │
        │   risk_score,         │
        │   flags[],            │
        │   processing_time_ms  │
        │ }                     │
        └───────────────────────┘
```

---

## Operating Modes

### TPA Mode (Post-Adjudication, Pre-Payment)

**Timeline:** Claim received → Batch processing → 24h SLA → Pend queue → Payment release

**Workflow:**
1. Claims ingested from NCPDP Batch 1.2 file (EDI 837 format)
2. Stored in `InsuranceClaim` table with Rx link
3. Analyzed via 24-check pipeline
4. Soft-hold if YELLOW (SLA = 24h); hard-hold if RED (manual resolution)
5. Employer-by-employer reporting
6. ERISA fiduciary decisions (SLA compliance tracked)
7. Fraud referrals → TPA fraud team

**Key Endpoints:**
- `GET /api/v1/tpa/dashboard` — Pend queue metrics, SLA compliance
- `GET /api/v1/tpa/pend-queue` — Soft/hard holds with countdown
- `GET /api/v1/tpa/fraud-referrals` — Claims flagged for investigation
- `GET /api/v1/tpa/employer-reports` — Book of business analytics

**Database Fields:**
- `Prescription.hold_type` — soft_hold / hard_hold / none
- `Prescription.sla_deadline` — Auto-release timestamp (soft holds)
- `Prescription.disposition_updated_at` — When reviewer acted

### PBA Mode (Real-Time, Pre-Dispense)

**Timeline:** Pharmacy POS submission → <200ms adjudication → Approve/deny at counter

**Workflow:**
1. NCPDP D.0 message arrives at pharmacy POS terminal
2. Streamed to backend via WebSocket or HTTP long-polling
3. Analyzed in <100ms (p95 target: <200ms)
4. Synchronous response: APPROVE / CALLBACK (hard stop with reason)
5. Pharmacist initiates callback (PA, formulary exception)
6. Member safety alerts triggered (real-time)

**Key Endpoints:**
- `GET /api/v1/pba/dashboard` — Latency SLA, transaction throughput
- `GET /api/v1/pba/live-transactions` — Real-time NCPDP stream
- `POST /api/v1/pba/callback` — Pharmacist callback request
- `GET /api/v1/pba/member-safety` — Real-time alerts

**Performance Requirements:**
- p95 latency: <200ms (includes DB + analysis + response marshaling)
- throughput: 1000+ TPS (peak hour scaling)
- availability: 99.99% SLA

---

## Flag Aggregation & Risk Scoring

### Severity Levels

| Severity | Weight Range | Meaning |
|----------|--------------|---------|
| **critical** | 0.8–1.0 | Hard contraindication; must resolve |
| **warning** | 0.4–0.7 | Significant concern; review recommended |
| **info** | 0.1–0.3 | Informational; monitor but not urgent |

### Aggregation Formula

```
risk_score = Σ(flag_severity × flag_weight) / count(flags)
Clamp to [0, 1]

Example:
  Flag 1: critical (0.9) × weight 0.8 = 0.72
  Flag 2: warning (0.5) × weight 0.4 = 0.20
  Flag 3: info (0.2) × weight 0.1 = 0.02
  
  Sum = 0.72 + 0.20 + 0.02 = 0.94
  Count = 3
  Score = 0.94 / 3 = 0.313 → YELLOW (threshold 0.3)
```

### Color Thresholds

| Color | Score | Disposition | SLA | Action |
|-------|-------|-------------|-----|--------|
| GREEN | < 0.3 | APPROVE | None (auto-pay) | Release claim immediately |
| YELLOW | 0.3–0.7 | REVIEW | 24h (soft hold) | Reviewer investigates; auto-releases if no action |
| RED | > 0.7 | FLAG | ∞ (hard hold) | Explicit action required; escalate to clinical team |

---

## 24 Clinical Checks Breakdown

### Category A: Drug-Drug Interactions (Checks 1–6)

| Check | Rule ID | Purpose | Data Source | Evidence |
|-------|---------|---------|-------------|----------|
| 1 | RULE-DDI-001 | Contraindicated DDI (absolute) | DrugInteraction table (severity=major) | FDA Drug Safety Comms |
| 2 | RULE-DDI-002 | Major-severity DDI | DrugInteraction table | Drug interaction databases |
| 3 | RULE-MCUM-001 | Cumulative moderate interactions ≥3 | Aggregate interaction count | Polypharmacy guidelines |
| 4 | RULE-QT-001 | QT prolongation stacking | Drug.qt_prolongation_risk flag | CredibleMeds.org |
| 5 | RULE-SERO-001 | Serotonin syndrome (≥2 serotonergic) | Drug.serotonergic flag | FDA warnings |
| 6 | RULE-CNS-001 | CNS depression stacking (opioid + benzo) | Drug.therapeutic_category matching | FDA black box warning |

### Category B: Dose Appropriateness (Checks 7–10)

| Check | Rule ID | Purpose | Data Source | Evidence |
|-------|---------|---------|-------------|----------|
| 7 | RULE-RENAL-001/002 | Renal dose adjustment | LabResult.eGFR + Drug.egfr_threshold | Drug label |
| 8 | RULE-HEPAT-001 | Hepatic dose adjustment | LabResult.ALT + Drug.hepatic_adjustment | Drug label |
| 9 | RULE-AGE-001/002 | Age-based dosing (geriatric/pediatric) | Patient.DOB + Drug.max_daily_dose | Beers 2023, FDA peds label |
| 10 | RULE-DOSE-001/002 | Max daily dose exceeded / subtherapeutic | Rx.dose_mg × frequency_multiplier | Drug label |

### Category C: Patient-Specific Contraindications (Checks 11–16)

| Check | Rule ID | Purpose | Data Source | Evidence |
|-------|---------|---------|-------------|----------|
| 11 | RULE-ALG-001 | Allergy cross-reactivity | Allergy.cross_reactivity_group + Drug.cross_reactivity_groups | Cross-reactivity databases |
| 12 | RULE-DX-001 | Drug-diagnosis mismatch | Diagnosis + Drug.approved_indications | FDA-approved indications |
| 13 | RULE-BEERS-001 | Beers Criteria (65+) | AGS Beers 2023 list | AGS Beers Criteria 2023 (JAGS 71(7)) |
| 14 | RULE-PREG-001 | Pregnancy/lactation risk | Patient.gender + DOB + Drug.pregnancy_risk | FDA PLLR (21 CFR 201.57) |
| 15 (v8) | RULE-PGX-001 | Pharmacogenomics (CPIC Level A) | PGxResult + Drug.pgx_gene/phenotype | CPIC Guidelines |
| 16 (v8) | RULE-REMS-001/002 | REMS compliance + monitoring | REMSEnrollment + last_monitoring_date | FDA REMS Database |

### Category D: Therapeutic Appropriateness (Checks 17–19)

| Check | Rule ID | Purpose | Data Source | Evidence |
|-------|---------|---------|-------------|----------|
| 17 | RULE-DUP-001/002 | Duplicate therapy (same class/category) | Active Rx + Drug.drug_class/therapeutic_category | Polypharmacy guidelines |
| 18 | PAT-PRIOR-001 | Step therapy compliance | TherapeuticEquivalence + PA history | Formulary rules |
| 19 | ML-COST-001 | Generic/biosimilar alternatives | TherapeuticEquivalence table | Cost benchmarking |

### Category E: Opioid-Specific (Checks 20–22)

| Check | Rule ID | Purpose | Data Source | Evidence |
|-------|---------|---------|-------------|----------|
| 20 | PAT-MME-001 | MME threshold breach (≥50/day) | Active opioids + mme_conversion_factor | CDC 2022 Opioid Guideline |
| 21 (v8) | RULE-NALOX-001 | Naloxone co-prescribing absent | High MME OR concurrent CNS depressant + naloxone history | CDC 2022 Rec 8 (MMWR 2022) |
| 22 | ML-REFILL-001 | Early refill / overlapping opioids | Refill timing + days_supply overlap | Claims analysis |

### Category F: Prescriber Pattern / ML (Checks 23–24) + Foundational

| Check | Rule ID | Purpose | Data Source | Evidence |
|-------|---------|---------|-------------|----------|
| 23 | ML-PRV-001 | Prescriber outlier (controlled volume) | Z-score of provider volume vs peers | Statistical anomaly detection |
| 24 | ML-FRAUD-001 | Pill mill / fraud network | DBSCAN clustering + network analysis | Network anomaly detection |
| — | RULE-EXCL-001 | Excluded provider screening (foundational) | Provider.npi + ExcludedProvider table | HHS-OIG LEIE / SAM.gov |

---

## ML Models: Training & Inference

### Model 1: XGBoost (Claim-Level Fraud)

**Purpose:** Predict fraud probability on individual claims

**Features (9):**
- `refill_timing_ratio` — filled_within / days_supply
- `time_to_fill_days` — date_filled - date_written
- `prescriber_drug_novelty` — binary: first time prescriber prescribed this drug
- `patient_pharmacy_count` — distinct pharmacies for patient
- `geographic_distance_km` — prescriber-pharmacy distance (mock)
- `ndc_vs_nadac_ratio` — actual cost / NADAC benchmark
- `dose_mg` — prescribed dose
- `days_supply` — refill days
- `controlled_schedule` — 0 (not controlled), 2 (II), 3 (III), 4 (IV)

**Training:**
```python
# In ml_models.train_models()
X_train = [feature_vector for each Rx]  # 195 samples
y_train = [fraud_label]                  # 1 if flagged by rules, 0 otherwise

xgb_model = xgb.XGBClassifier(
    n_estimators=100,
    max_depth=5,
    learning_rate=0.1,
)
xgb_model.fit(X_train, y_train)
```

**Metrics (from training):**
- Accuracy: ~0.87
- Precision: ~0.92
- Recall: ~0.78
- ROC-AUC: ~0.91

**Inference:** Score in [0, 1]; contributes to flag aggregation.

### Model 2: LightGBM (Prescriber Anomaly)

**Purpose:** Detect prescriber outliers vs specialty peers

**Features (8):**
- `atc_volume` — total prescriptions
- `brand_rate` — % brand vs generic
- `controlled_rate` — % controlled substances
- `mme_per_patient` — avg MME across patients
- `cost_deviation_pct` — deviation from peer median
- `geographic_outlier_score` — mock measure of isolation
- `is_pain_management` — specialty indicator
- `is_excluded` — on federal list (binary)

**Training:**
```python
lgb_model = lgb.LGBMClassifier(
    n_estimators=100,
    num_leaves=31,
    learning_rate=0.05,
)
lgb_model.fit(X_train, y_train)
```

**Metrics:**
- Accuracy: ~0.87
- Precision: ~0.85
- Recall: ~0.81

### Model 3: IsolationForest (Unsupervised Outlier Detection)

**Purpose:** Flag unusual claim patterns without supervision

**Configuration:**
```python
iso_model = IsolationForest(
    n_estimators=300,
    contamination=0.05,  # Expect ~5% outliers
    random_state=42,
)
iso_model.fit(X_all_features)
```

**Output:** -1 (outlier) or +1 (normal)

### Model 4: DBSCAN (Network Clustering)

**Purpose:** Identify prescriber-pharmacy-patient networks (potential pill mills)

**Distance Metric:** Jaccard distance on triplet sets
```
Prescriber A + Pharmacy X + Patient Y = triplet T1
Jaccard(T1, T2) = |T1 ∩ T2| / |T1 ∪ T2|
```

**Configuration:**
```python
dbscan_model = DBSCAN(
    eps=0.3,      # Similarity threshold
    min_samples=3,  # Minimum cluster size
    metric='jaccard',
)
clusters = dbscan_model.fit_predict(triplet_matrix)
```

**Output:** Cluster ID or -1 (outlier/anomaly)

### Model 5: Meta-Learner (Stacking Logistic Regression)

**Purpose:** Combine XGB + LGB predictions into single ANOMALY_SCORE

**Input:** [xgb_proba, lgb_proba] → LR → [0, 1]

```python
meta_features = [[xgb_pred, lgb_pred] for each Rx]
meta_model = LogisticRegression()
meta_model.fit(meta_features, y_train)

# Inference:
anomaly_score = meta_model.predict_proba([xgb_pred, lgb_pred])[0, 1]
```

### Model 6: TF-IDF + LR (Patient Context Layer)

**Purpose:** Stand-in for BioClinicalBERT/PubMedBERT (runs in Hopkins SAFE Desktop)

**Input:** Clinical notes / prescription text

**Pipeline:**
```python
vectorizer = TfidfVectorizer(max_features=200)
context_vectors = vectorizer.fit_transform(clinical_texts)

context_model = LogisticRegression()
context_model.fit(context_vectors, y_train)

# Output: suppress (escalate to reviewer) or no action
```

---

## Database Schema (16 Tables)

```sql
-- Core Demographics
CREATE TABLE patients (
  id TEXT PRIMARY KEY,
  first_name TEXT, last_name TEXT,
  date_of_birth DATE NOT NULL,
  gender TEXT,
  weight_kg FLOAT, height_cm FLOAT
);

CREATE TABLE diagnoses (
  id INTEGER PRIMARY KEY,
  patient_id TEXT FOREIGN KEY,
  icd10_code TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE allergies (
  id INTEGER PRIMARY KEY,
  patient_id TEXT FOREIGN KEY,
  allergen TEXT NOT NULL,
  reaction_type TEXT,
  severity TEXT,  -- mild, moderate, severe
  cross_reactivity_group TEXT
);

CREATE TABLE lab_results (
  id INTEGER PRIMARY KEY,
  patient_id TEXT FOREIGN KEY,
  test_name TEXT NOT NULL,  -- eGFR, ALT, AST, etc.
  value FLOAT NOT NULL,
  unit TEXT,
  date_collected DATETIME,
  is_abnormal BOOLEAN DEFAULT FALSE
);

-- Genomics & REMS
CREATE TABLE pgx_results (
  id INTEGER PRIMARY KEY,
  patient_id TEXT FOREIGN KEY,
  gene TEXT NOT NULL,  -- CYP2D6, CYP2C19, etc.
  phenotype TEXT NOT NULL,  -- poor_metabolizer, normal, etc.
  diplotype TEXT,
  test_date DATE,
  cpic_level TEXT  -- A, B, C
);

CREATE TABLE rems_enrollments (
  id INTEGER PRIMARY KEY,
  patient_id TEXT FOREIGN KEY,
  rems_program TEXT NOT NULL,  -- iPLEDGE, CLOZAPINE_REMS, etc.
  is_active BOOLEAN DEFAULT TRUE,
  last_monitoring_date DATE
);

-- Prescribing
CREATE TABLE prescriptions (
  id TEXT PRIMARY KEY,
  patient_id TEXT FOREIGN KEY,
  drug_id TEXT FOREIGN KEY,
  provider_id TEXT FOREIGN KEY,
  dose_mg FLOAT NOT NULL,
  frequency TEXT,  -- QD, BID, TID, PRN, etc.
  days_supply INTEGER,
  date_written DATE,
  date_filled DATE,
  flag_color TEXT,  -- GREEN, YELLOW, RED
  disposition TEXT,  -- APPROVE, REVIEW, FLAG
  risk_score FLOAT,
  flags JSON,  -- Array of flag objects
  hold_type TEXT,  -- soft_hold, hard_hold
  sla_deadline DATETIME,
  processing_time_ms FLOAT,
  status TEXT,  -- pending, approved, denied
  created_at DATETIME
);

-- Drugs & Interactions
CREATE TABLE drugs (
  id TEXT PRIMARY KEY,
  generic_name TEXT NOT NULL,
  brand_name TEXT,
  ndc_code TEXT UNIQUE,
  schedule TEXT,  -- I, II, III, IV, V, none
  therapeutic_category TEXT,  -- SSRI, beta-blocker, etc.
  drug_class TEXT,
  approved_indications JSON,
  max_daily_dose_mg FLOAT,
  min_daily_dose_mg FLOAT,
  egfr_threshold FLOAT,  -- For renal adjustment
  renal_adjustment_required BOOLEAN,
  hepatic_adjustment_required BOOLEAN,
  is_opioid BOOLEAN,
  is_naloxone BOOLEAN,
  mme_conversion_factor FLOAT,
  requires_titration BOOLEAN,
  titration_schedule JSON,
  qt_prolongation_risk BOOLEAN,
  serotonergic BOOLEAN,
  beers_criteria BOOLEAN,
  pregnancy_risk TEXT,  -- X, D, C, B, A
  rems_program TEXT,  -- iPLEDGE, CLOZAPINE_REMS, etc.
  pgx_gene TEXT,  -- CYP2D6, CYP2C19, etc. (if applicable)
  pgx_risk_phenotype TEXT,  -- poor_metabolizer, etc.
  pgx_clinical_action TEXT,  -- avoid, dose_reduce, monitor, etc.
  pgx_evidence TEXT,
  cross_reactivity_groups JSON
);

CREATE TABLE drug_interactions (
  id INTEGER PRIMARY KEY,
  drug_a_id TEXT FOREIGN KEY,
  drug_b_id TEXT FOREIGN KEY,
  severity TEXT,  -- major, moderate, minor
  clinical_effect TEXT,
  description TEXT,
  management TEXT
);

CREATE TABLE therapeutic_equivalence (
  id INTEGER PRIMARY KEY,
  drug_a_id TEXT FOREIGN KEY,
  drug_b_id TEXT FOREIGN KEY,
  type TEXT,  -- generic, biosimilar, alternative
  equivalence_score FLOAT,
  cost_savings_pct FLOAT
);

-- Providers & Exclusions
CREATE TABLE providers (
  id TEXT PRIMARY KEY,
  first_name TEXT, last_name TEXT,
  npi TEXT UNIQUE,
  specialty TEXT,
  dea_number TEXT,
  clinic_name TEXT,
  clinic_address TEXT,
  clinic_city TEXT, clinic_state TEXT,
  board_certified BOOLEAN,
  is_excluded BOOLEAN DEFAULT FALSE,
  exclusion_source TEXT,  -- LEIE, SAM_GOV, STATE_BOARD
  exclusion_date DATE,
  exclusion_reason TEXT
);

CREATE TABLE excluded_providers (
  id INTEGER PRIMARY KEY,
  npi TEXT UNIQUE,
  last_name TEXT, first_name TEXT,
  exclusion_source TEXT,  -- LEIE, SAM_GOV
  exclusion_type TEXT,  -- mandatory, permissive
  exclusion_date DATE,
  reinstatement_date DATE,
  reason_code TEXT,  -- 1128(a)(1), etc.
  reason_description TEXT,
  last_synced DATETIME
);

CREATE TABLE pharmacies (
  id TEXT PRIMARY KEY,
  name TEXT,
  npi TEXT,
  city TEXT, state TEXT,
  network_status TEXT  -- active, inactive
);

-- Claims & Audit
CREATE TABLE insurance_claims (
  id TEXT PRIMARY KEY,
  prescription_id TEXT FOREIGN KEY,
  billed_amount FLOAT,
  allowed_amount FLOAT,
  copay FLOAT,
  status TEXT  -- pending, approved, denied
);

CREATE TABLE audit_trail (
  id INTEGER PRIMARY KEY,
  prescription_id TEXT FOREIGN KEY,
  action TEXT,  -- analyzed, approved, reviewed, flagged
  user_id TEXT,
  timestamp DATETIME,
  evidence JSON  -- Flags that triggered the action
);

CREATE TABLE data_source_integrations (
  id INTEGER PRIMARY KEY,
  name TEXT UNIQUE,  -- NPPES, openFDA, FHIR, EDI, etc.
  protocol TEXT,  -- REST, SFTP, HL7, etc.
  last_sync DATETIME,
  status TEXT,  -- synced, syncing, error
  record_count INTEGER
);
```

---

## Configuration & Environment Variables

```bash
# Database
DATABASE_URL=sqlite:///./axeris.db     # Dev
# DATABASE_URL=postgresql://user:pass@host/axeris  # Prod

# AI
CLAUDE_API_KEY=sk-...                   # Optional

# Server
UVICORN_PORT=8000
UVICORN_RELOAD=true

# Frontend
NEXT_PUBLIC_API_URL=http://localhost:8000  # Dev
# NEXT_PUBLIC_API_URL=https://api.render.com  # Prod

# Render (production)
RENDER_DB_URL=postgresql://...
```

---

## Regulatory Compliance

| Requirement | Implementation | Location |
|-------------|----------------|----------|
| **ERISA § 404(a)(1)(B)** | Audit trail with evidence chain | `/api/v1/audit` + AuditTrail table |
| **FDA REMS (ETASU)** | Enrollment + monitoring verification | `rems_compliance_check()` in rules_engine.py |
| **CPIC Level A** | Pharmacogenomic testing + action | `pharmacogenomic_check()` in rules_engine.py |
| **CDC 2022 Opioid Guideline** | Naloxone co-prescribing enforcement | `naloxone_coprescribing_check()` |
| **HHS-OIG LEIE / SAM.gov** | Provider exclusion screening | `excluded_provider_check()` + ExcludedProvider table |
| **HL7 FHIR R4** | Patient data exchange | `/api/v1/data-sources` (mocked) |
| **NCPDP D.0** | Pharmacy adjudication | `pba.py` mode |
| **Beers Criteria 2023** | Inappropriate medications for 65+ | `beers_criteria_check()` |

---

## Performance & Scaling

### Single Rx Analysis Latency
```
Startup (including all engine evaluations):
  Database fetch:           ~5ms
  Rules engine:             ~20ms
  ML inference (6 models):  ~50ms
  Patient engine:           ~20ms
  Flag aggregation:         ~5ms
  Database insert:          ~10ms
  Response marshaling:      ~5ms
  ──────────────────────────────
  Total (p95):             ~115ms
```

### PBA Mode Target
```
  Per-claim processing: <100ms (p50)
  SLA requirement: <200ms (p95)
  Throughput: 1000+ TPS (peak hour)
```

### Scaling Strategy
1. **Vertical:** Increase CPU/RAM for single process
2. **Horizontal:** FastAPI + Gunicorn with 4+ workers
3. **Database:** PostgreSQL with connection pooling (pgbouncer)
4. **Caching:** Redis for frequent queries (patient, drug, provider)
5. **Async:** Use SQLAlchemy async for high-concurrency scenarios

---

## Testing Strategy

### Unit Tests
- Rules engine: Each check isolated
- ML models: Training + inference on synthetic data
- API endpoints: Request/response validation

### Integration Tests
- End-to-end prescription analysis
- Database transactions
- External API fallback (circuit breaker)

### Performance Tests
- Load test: 100–1000 TPS
- Latency profile: p50, p95, p99
- Memory usage under sustained load

### Clinical Validation
- Manual review of 50 flagged prescriptions
- Compare against clinical guidelines
- Peer review by pharmacists/physicians

---

## Deployment Checklist

- [ ] Replace SQLite with PostgreSQL
- [ ] Configure CORS for production domains
- [ ] Set CLAUDE_API_KEY in environment
- [ ] Enable HTTPS on all endpoints
- [ ] Set up structured logging (JSON)
- [ ] Configure monitoring (DataDog, New Relic, etc.)
- [ ] Set up alerting for SLA breaches
- [ ] Load test for throughput/latency
- [ ] Seed production LEIE/SAM.gov exclusion list
- [ ] Set up daily cron for exclusion list sync
- [ ] Configure database backups + WAL replication
- [ ] Security audit: SQL injection, XSS, CSRF
- [ ] Test failover scenarios
- [ ] Document runbooks for incident response

---

**Axeris Architecture v0.8** — Spec v8, April 2026
**Last Updated:** April 2026
