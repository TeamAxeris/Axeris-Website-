# Axeris Backend — Python FastAPI

**Fast, scalable clinical decision support API** built on FastAPI, SQLAlchemy, and 6 real ML models.

---

## Quick Start

```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # or .venv\Scripts\activate on Windows
pip install -r requirements.txt

# Run with auto-reload for development
uvicorn main:app --reload --port 8000

# Production (Render, Railway, etc.)
gunicorn -w 4 -k uvicorn.workers.UvicornWorker main:app
```

**API** available at `http://localhost:8000`
**Docs** available at `http://localhost:8000/docs` (Swagger UI)

---

## Project Structure

```
backend/
├── main.py                    # FastAPI app, lifespan, routers
├── config.py                  # Thresholds, constants, env vars
├── requirements.txt           # pip dependencies
│
├── database/
│   ├── database.py            # SQLAlchemy engine + session factory
│   ├── models.py              # 16 ORM models (Patient, Prescription, Drug, etc.)
│   └── seed.py                # Synthetic data generator (50 patients, 200+ Rx)
│
├── engines/                   # 3-tier clinical analysis
│   ├── rules_engine.py        # 16 deterministic checks (A-D + PGx/REMS/naloxone)
│   ├── ml_engine.py           # 7 statistical pattern checks
│   ├── patient_engine.py      # 7 EHR-aware contextual checks
│   ├── ml_models.py           # 6 real sklearn-family models
│   └── equivalence.py         # Therapeutic alternative lookups
│
├── routers/                   # 12 API routers (80+ endpoints)
│   ├── prescriptions.py       # Core Rx CRUD + analysis
│   ├── patients.py            # Patient profiles + context
│   ├── providers.py           # Provider risk + peer comparison
│   ├── drugs.py               # Drug database + interactions
│   ├── analytics.py           # Dashboard KPIs + cohorts
│   ├── audit.py               # ERISA § 404 audit trail
│   ├── copilot.py             # AI chat + note generation
│   ├── interactions.py        # Drug interaction network
│   ├── v8.py                  # v8 features (PGx, REMS, etc.)
│   ├── tpa.py                 # TPA workflows (batch, pend queue)
│   ├── pba.py                 # PBA workflows (real-time, <200ms)
│   ├── data_sources.py        # Integration status manifest
│   ├── public_apis.py         # NPPES, openFDA, RxNav, etc.
│   ├── ml_engine_router.py    # Model status + predictions
│   ├── search.py              # Global search
│   └── websocket.py           # Real-time notifications
│
├── schemas/                   # Pydantic response models
│   ├── prescription.py
│   ├── patient.py
│   ├── provider.py
│   ├── drug.py
│   └── analytics.py
│
└── data/
    ├── drug_database.json     # ~55 drugs with clinical metadata
    └── interactions.json      # ~40 drug-drug interaction pairs
```

---

## Database & Models

### 16 ORM Tables

| Model | Purpose | Key Fields |
|-------|---------|-----------|
| `Patient` | Demographics + EHR context | id, DOB, gender, weight_kg, height_cm |
| `Prescription` | Rx record + disposition | drug_id, patient_id, provider_id, dose_mg, frequency, flag_color, disposition |
| `Drug` | Drug metadata + clinical properties | generic_name, brand_name, schedule, therapeutic_category, max_daily_dose_mg, contraindications |
| `DrugInteraction` | DDI database | drug_a_id, drug_b_id, severity (major/moderate/minor), clinical_effect, management |
| `Diagnosis` | ICD-10 codes + status | patient_id, icd10_code, description, is_active |
| `Allergy` | Patient allergies + cross-reactivity | patient_id, allergen, reaction_type, severity, cross_reactivity_group |
| `LabResult` | Vital labs (eGFR, ALT, etc.) | patient_id, test_name, value, unit, date_collected, is_abnormal |
| `Provider` | Prescriber + insurer context | npi, dea_number, specialty, clinic_name, board_certified, is_excluded |
| `ExcludedProvider` | HHS-OIG LEIE / SAM.gov | npi, exclusion_source, exclusion_date, reason_code, reinstatement_date |
| `Pharmacy` | Pharmacy network | id, name, npi, city, state, network_status |
| `InsuranceClaim` | Claim + adjudication | prescription_id, billed_amount, allowed_amount, copay, status |
| `PGxResult` | Pharmacogenomics tests | patient_id, gene (CYP2D6, etc.), phenotype (poor_metabolizer, etc.), diplotype |
| `REMSEnrollment` | REMS program enrollment | patient_id, rems_program (iPLEDGE, CLOZAPINE_REMS, etc.), is_active, last_monitoring_date |
| `TherapeuticEquivalence` | Generic/biosimilar alternatives | drug_a_id, drug_b_id, type (generic/biosimilar), equivalence_score, cost_savings_pct |
| `AuditTrail` | ERISA § 404 action log | prescription_id, action (flag, approve, review), user, timestamp, evidence |
| `DataSourceIntegration` | API/vendor status | name (NPPES, openFDA, etc.), protocol, last_sync, status, record_count |

**Initialization:**
```python
# In lifespan startup:
Base.metadata.create_all(bind=engine)
seed_if_empty()
```

**Seed data** creates:
- 50 patients (5 archetypes: elderly diabetic, opioid-seeking, polypharmacy, perinatal, healthy)
- 200+ prescriptions (mix of GREEN, YELLOW, RED)
- 20 providers (including 4 suspicious "pill mill" clinics)
- 55 drugs (~40 interaction pairs)
- Lab results, diagnoses, allergies, PGx results, REMS enrollments

---

## Clinical Engines

### 1. Rules Engine (`rules_engine.py`) — Deterministic

**24 Checks across 6 Categories:**

| Category | Checks | Examples |
|----------|--------|----------|
| **A: DDIs** | 1–6 | Contraindicated DDI, major severity, moderate cumulative, QT stacking, serotonin syndrome, CNS depression |
| **B: Dosing** | 7–10 | Renal adjustment, hepatic adjustment, age-based (geriatric/pediatric), max daily dose |
| **C: Patient-Specific Contraindications** | 11–16 | Allergy cross-reactivity, drug-diagnosis mismatch, Beers criteria, pregnancy risk, **PGx (CPIC)**, **REMS** |
| **D: Therapeutic Appropriateness** | 17–19 | Duplicate therapy, step therapy, generic/biosimilar alternatives |
| **E: Opioid-Specific** | 20–22 | MME threshold, **naloxone co-prescribing**, early refill/overlapping |
| **F: Prescriber Pattern / ML** | 23–24 | Outlier detection, pill mill/fraud networks |
| **Foundational** | — | **Excluded provider screening (LEIE/SAM.gov)** |

**Key Functions:**
- `drug_interaction_check()` — Query `DrugInteraction` table for active patient medications
- `dose_range_check()` — Validate against `Drug.max_daily_dose_mg`, frequency multipliers
- `organ_function_dosing_check()` — eGFR/ALT trending; renal/hepatic adjustment required
- `allergy_cross_reactivity_check()` — Cross-match allergens with `drug.cross_reactivity_groups`
- `beers_criteria_check()` — AGS Beers Criteria 2023; patients 65+ only
- `pharmacogenomic_check()` — CPIC Level A (CYP2D6, CYP2C19, HLA-B*57:01, TPMT, DPYD); requires structured PGx test result
- `rems_compliance_check()` — iPLEDGE, clozapine REMS, TIRF, sodium oxybate; checks enrollment + monitoring date
- `naloxone_coprescribing_check()` — CDC 2022 Recommendation 8; triggers on MME ≥50/day or concurrent CNS depressant
- `excluded_provider_check()` — LEIE/SAM.gov cross-reference; hard stop with weight 1.0
- `evaluate(rx, patient, drug, db)` — Master function calling all checks in order

**Return Value:** List of flag dicts
```python
{
    "flag_id": "RULE-DDI-001",
    "category": "drug_interaction",
    "severity": "critical",  # critical, warning, info
    "weight": 0.9,           # Aggregated to final risk score
    "title": "Contraindicated DDI: warfarin + NSAIDs",
    "description": "...",
    "evidence_source": "FDA Drug Safety Communication",
    "suggested_action": "Select alternative NSAID or anticoagulant"
}
```

---

### 2. ML & Anomaly Engine (`ml_engine.py`) — Statistical

**7 Checks:**

| Check | Purpose | Method |
|-------|---------|--------|
| Prescriber behavior | Volume of controlled substances vs specialty peers | Z-score on peer cohort |
| Doctor shopping | Patients getting controlled Rx from 3+ prescribers in 90 days | Count distinct providers |
| Refill anomalies | Early refills, overlapping opioid prescriptions | Temporal pattern analysis |
| Pharmacy billing | Unusual billing/markup patterns | Cost deviation detection |
| Cost outliers | Brand used when generic available | NADAC benchmark comparison |
| Drug wastage | Abandoned/vial wastage (Checks 21a) | Refill gap + quantity patterns |
| PA outcome prediction | Prior auth approval likelihood | LightGBM predictor |

**Key Models:** Trained at app startup via `ml_models.train_models()`

---

### 3. Patient-Specific Engine (`patient_engine.py`) — EHR-Aware

**7 Checks:**

| Check | Purpose | Data Source |
|-------|---------|-------------|
| Comorbidity assessment | Drug contraindicated for active diagnosis | ICD-10 codes + contraindication mapping |
| Lab trending | Declining renal/hepatic function | LabResult table (3-sample trend) |
| Prior treatment failure | Knows if patient failed this drug before | Prescription history |
| Adherence analysis | Low MPR (Medication Possession Ratio) | Refill history |
| Medication load (CNS) | CNS depressant burden | Active Rx count by class |
| MME tracking | Opioid cumulative dosing + CDC 2022 | Morphine milligram equivalent calculation |
| Specialty review | Specialty drug (e.g., biologic) safety | Drug classification |

**Key Function:** `evaluate(rx, patient, db)` → list of flags

---

### 4. ML Models (`ml_models.py`) — 6 Real sklearn Models

All trained at app startup on seeded data. Persist in module-level globals (`_state` dict).

| # | Model | Purpose | Features | Output |
|---|-------|---------|----------|--------|
| 1 | **XGBoost** | Claim-level fraud probability | refill_timing_ratio, time_to_fill_days, prescriber_drug_novelty, patient_pharmacy_count, geographic_distance_km, ndc_vs_nadac_ratio, dose_mg, days_supply, controlled_schedule | Probability (0–1) |
| 2 | **LightGBM** | Prescriber anomaly vs specialty peers | atc_volume, brand_rate, controlled_rate, mme_per_patient, cost_deviation_pct, geographic_outlier_score, is_pain_management, is_excluded | Binary (normal/anomaly) |
| 3 | **IsolationForest** | Outlier detection (unsupervised) | All CLAIM_FEATURES | Outlier score (–1 / +1) |
| 4 | **DBSCAN** | Prescriber-pharmacy-patient network clustering | Prescriber × Pharmacy × Patient triplets; Jaccard distance | Cluster ID (–1 = outlier) |
| 5 | **Meta-learner (LR)** | Stack XGB + LGB predictions | [xgb_pred, lgb_pred] | ANOMALY_SCORE (0–1) |
| 6 | **TF-IDF + LR** | Patient context layer (stand-in for BERT) | Clinical note / prescription text | suppress / escalate |

**Training Endpoint:**
```python
GET /api/v1/ml-engine/status
```
Returns:
```json
{
  "trained": true,
  "trained_at": "2026-04-24T12:34:56Z",
  "models": {
    "claim_xgboost": {
      "n_training_samples": 195,
      "accuracy": 0.87,
      "precision": 0.92,
      "recall": 0.78,
      "roc_auc": 0.91
    },
    ...
  }
}
```

---

## API Endpoints (80+ Total)

### Core: Prescriptions

```python
GET /api/v1/prescriptions
  Query: ?patient_id=..., ?flag_color=RED, ?status=pending, ?provider_id=..., ?limit=50
  → List[PrescriptionResponse]

GET /api/v1/prescriptions/{id}
  → PrescriptionResponse (with all flags, calculations, copilot quick questions)

POST /api/v1/prescriptions/analyze
  Body: { "drug_id": "...", "patient_id": "...", "dose_mg": 500, "frequency": "QID", ... }
  → PrescriptionResponse (immediately analyzed)

POST /api/v1/prescriptions/{id}/action
  Body: { "action": "APPROVE" | "REVIEW" | "FLAG", "notes": "...", "user_id": "..." }
  → AuditTrailEntry
```

### Intelligence: Patients, Providers, Drugs

```python
GET /api/v1/patients
  → List[PatientResponse]

GET /api/v1/patients/{id}
  → PatientDetailResponse { patient, diagnoses[], allergies[], lab_results[], pgx_results[], rems_enrollments[], rx_history[] }

GET /api/v1/providers
  → List[ProviderResponse]

GET /api/v1/providers/{id}
  → ProviderDetailResponse { provider, controlled_volume, specialty_peers[], risk_score }

GET /api/v1/drugs
  Query: ?search=metformin, ?class=SSRI
  → List[DrugResponse]

GET /api/v1/drugs/{id}/interactions
  → List[DrugInteraction]

GET /api/v1/interactions/network
  → GraphData { nodes[], edges[] } for visualization
```

### Analytics & Reporting

```python
GET /api/v1/analytics/dashboard
  → DashboardMetrics {
    total_prescriptions, flagged_pct, green_pct, yellow_pct, red_pct,
    estimated_savings_usd, fraud_referrals, avg_review_turnaround_hours
  }

GET /api/v1/analytics/cohort/{icd10_code}
  → CohortAnalysis { avg_age, female_pct, avg_meds, risk_distribution, ... }

GET /api/v1/analytics/trend
  Query: ?days=30
  → TimeSeriesData { dates[], flag_counts[], savings[] }

GET /api/v1/audit
  Query: ?days=7, ?action=flag, ?limit=100
  → List[AuditTrailEntry] { timestamp, user_id, action, prescription_id, evidence }
```

### AI Copilot

```python
POST /api/v1/copilot/chat
  Body: { "message": "Is there a cheaper alternative to this statin?", "context": { "prescription_id": "...", "patient_id": "..." } }
  → { "response": "Yes, atorvastatin is...", "sources": [...] }

POST /api/v1/copilot/generate-note
  Query: ?type=review_summary | denial_rationale | approval_rationale | pa_letter
  Body: { "prescription_id": "..." }
  → { "note": "...", "generated_at": "..." }

GET /api/v1/copilot/formulary-check/{drug_id}
  → { "tier": 2, "copay": 35, "pa_required": true, "alternatives": [...] }

GET /api/v1/copilot/prior-auth-status
  → List[PAQueueEntry]

GET /api/v1/copilot/quick-questions
  Query: ?prescription_id=...
  → ["Is there a generic?", "Check renal dosing?", "REMS enrollment?"]
```

### Operating Modes

```python
GET /api/v1/tpa/dashboard
  → TPADashboard { pend_queue_total, soft_holds, hard_holds, employer_count, quarterly_recovered_usd, ... }

GET /api/v1/tpa/pend-queue
  → List[PendQueueEntry] with SLA deadline, urgency, recommendation

GET /api/v1/pba/dashboard
  → PBADashboard { transactions_today, avg_latency_ms, p95_latency_ms, sla_compliance_pct, rejects_last_hour, ... }

GET /api/v1/pba/live-transactions
  Query: ?limit=100
  → Stream of real-time NCPDP D.0 adjudication events
```

### External Integrations

```python
GET /api/v1/data-sources
  → List[DataSourceStatus] { name, protocol, last_sync, status, record_count }

GET /api/v1/public-apis/nppes?npi=...
  → NPPESResult { npi, name, specialty, ... }

GET /api/v1/public-apis/openfda/faers?drug_id=...
  → List[FAERSReport]

GET /api/v1/public-apis/rxnav?drug_id=...
  → List[TherapeuticEquivalent]

GET /api/v1/public-apis/validate
  → { "nppes": true, "openfda": true, "rxnav": true, ... }
```

---

## Configuration (`config.py`)

```python
# Database
DATABASE_URL = "sqlite:///./axeris.db"  # Switch to PostgreSQL in production

# API
API_V1_PREFIX = "/api/v1"

# Flag color thresholds (risk score 0–1)
RED_SCORE_THRESHOLD = 0.7
YELLOW_SCORE_THRESHOLD = 0.3

# Disposition mapping
COLOR_TO_DISPOSITION = {
    "GREEN": "APPROVE",
    "YELLOW": "REVIEW",
    "RED": "FLAG",
}

# SLA settings
SOFT_HOLD_SLA_HOURS = 24       # Auto-release after 24h if not escalated
SOFT_HOLD_URGENT_SLA_HOURS = 4 # For claims > $5K

# Operating mode
DEFAULT_OPERATING_MODE = "TPA"  # or "PBA"

# Clinical thresholds
POLYPHARMACY_THRESHOLD = 5                          # Active meds triggering risk
CONTROLLED_SUBSTANCE_VOLUME_ZSCORE = 2.0           # Std devs above peer mean
EARLY_REFILL_DAYS = 7                              # Days before expected = "early"
DOCTOR_SHOPPING_PROVIDER_THRESHOLD = 3             # Distinct providers in 90 days
ADHERENCE_MPR_THRESHOLD = 0.8                      # Medication possession ratio
```

**Environment Variables:**
```bash
DATABASE_URL=postgresql://user:pass@localhost/axeris  # Production
CLAUDE_API_KEY=sk-...                                 # Optional; app falls back to demo mode if missing
RENDER_DB_URL=...                                     # Render PostgreSQL URL
```

---

## Lifespan & Startup

```python
@asynccontextmanager
async def lifespan(app: FastAPI):
    # STARTUP
    Base.metadata.create_all(bind=engine)
    seed_if_empty()
    
    # Train real ML models on seeded data
    try:
        from engines import ml_models
        status = ml_models.train_models()
        if status.get("trained"):
            print(f"[Axeris] ML models trained: {status['models']}")
        else:
            print(f"[Axeris] ML training skipped: {status.get('reason')}")
    except Exception as e:
        print(f"[Axeris] ML training error (non-fatal): {e}")
    
    yield
    
    # SHUTDOWN
    # (cleanup, if needed)
```

---

## Running Locally

### Development Mode (with auto-reload)
```bash
uvicorn main:app --reload --port 8000
```
Logs:
```
[Axeris] ML models trained: claim=195 samples, prescriber=195 samples
INFO:     Uvicorn running on http://127.0.0.1:8000
INFO:     Application startup complete
```

### Production Mode (gunicorn)
```bash
gunicorn -w 4 -k uvicorn.workers.UvicornWorker main:app --bind 0.0.0.0:8000
```

### With PostgreSQL (Render, Railway, etc.)
```bash
# Create database
createdb axeris

# Set env var
export DATABASE_URL="postgresql://user:password@localhost/axeris"

# Run
uvicorn main:app --port 8000
```

---

## Testing (if applicable)

```bash
# Pytest (if test suite exists)
pytest tests/ -v

# Manual endpoint testing
curl http://localhost:8000/docs  # Swagger UI
curl http://localhost:8000/api/v1/prescriptions | jq
```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| `sqlite3.OperationalError: database is locked` | Delete `axeris.db`, restart |
| `ModuleNotFoundError: No module named 'engines'` | Ensure running from `backend/` directory |
| `CLAUDE_API_KEY missing` | Export key: `export CLAUDE_API_KEY=sk-...` or app uses demo mode |
| Copilot returns "Simulated response" | Claude API key not set; falls back to mock |
| ML models not training | Check logs; if seed data < 50 samples, training skips |
| Port 8000 in use | `lsof -i :8000` and kill, or use `--port 8001` |

---

## Deployment Checklist

- [ ] Replace SQLite with PostgreSQL (`DATABASE_URL`)
- [ ] Set `CLAUDE_API_KEY` in env vars
- [ ] Configure CORS origins (currently `["*"]`)
- [ ] Set up logging (structured JSON, not prints)
- [ ] Enable HTTPS on all endpoints
- [ ] Configure database backups + replication
- [ ] Set up monitoring (APM, error tracking)
- [ ] Load test (especially PBA sub-200ms requirement)
- [ ] Seed production LEIE/SAM.gov excluded provider list
- [ ] Sync real FHIR/EDI connectors

---

## Key Files Reference

| File | Purpose |
|------|---------|
| `main.py` | FastAPI app, lifespan, router registration |
| `config.py` | All configurable thresholds + env vars |
| `database/models.py` | 16 ORM models; modify to extend schema |
| `engines/rules_engine.py` | 24-check deterministic logic |
| `engines/ml_engine.py` | 7 statistical checks |
| `engines/patient_engine.py` | 7 EHR-aware checks |
| `engines/ml_models.py` | 6 real ML models (XGB, LGB, ISO, DBSCAN, Meta-LR, TF-IDF) |
| `routers/prescriptions.py` | Rx CRUD + analysis |
| `routers/copilot.py` | AI chat + note generation (Claude API) |

---

## Next Steps

1. **Extend Clinical Rules** → Add domain-specific checks to `rules_engine.py`
2. **Connect Real Data Sources** → Replace mock FHIR/EDI connectors with real SFTP/API clients
3. **Deploy to Production** → Render/Railway with PostgreSQL
4. **Set Up Monitoring** → DataDog / New Relic for latency, error tracking
5. **Load Testing** → Locust / K6 for PBA sub-200ms SLA validation
6. **LEIE Sync** → Daily cron job to update `ExcludedProvider` table from SAM.gov

---

**Axeris Backend v0.8** — AI Clinical Decision Support API
**Built on:** FastAPI, SQLAlchemy, scikit-learn, XGBoost, LightGBM
**Last Updated:** April 2026
