# Axeris — AI Clinical Decision Support for Prescription Review

**Axeris** is a production-grade clinical decision support platform that analyzes prescriptions for safety, appropriateness, and cost-effectiveness. Built for health insurers, PBMs, and utilization management teams, Axeris sits between prescribing and payment to flag clinically inappropriate, unsafe, or wasteful prescriptions in real-time.

**Version:** v0.8 | **Spec:** v8 (April 2026) | **Status:** Full prototype with AI copilot, PGx, REMS, and dual operating modes

---

## Quick Facts

| Aspect | Details |
|--------|---------|
| **Clinical Coverage** | 24 numbered safety checks across 6 categories (A-F) |
| **Engines** | 3-tier: Rules (deterministic) + ML (statistical) + Patient Context (EHR-aware) |
| **ML Models** | 6 real sklearn-family models: XGBoost, LightGBM, IsolationForest, DBSCAN, Meta-LR, TF-IDF |
| **Operating Modes** | TPA (post-adjudication batch) + PBA (real-time pre-dispense, sub-200ms p95) |
| **Data Sources** | 9 live federal APIs + 3 validation databases (MarketScan, Kythera, Truveta) |
| **AI Integration** | Claude API with fallback demo mode; context-aware copilot |
| **Regulations** | ERISA § 404 audit trail, FDA REMS (ETASU), CPIC Level A PGx, CDC 2022 opioid guidelines |
| **Tech Stack** | Python 3.11+ FastAPI + SQLAlchemy | Next.js 14 TypeScript + Tailwind CSS |
| **Database** | SQLite (zero-setup demo; production uses PostgreSQL) |
| **Live Demo** | Frontend: https://proto2-mocha.vercel.app | API: https://proto2-80qe.onrender.com/docs |

---

## What It Does

### Clinical Analysis Pipeline
1. **Rules Engine** — Deterministic checks: drug-drug interactions, dose appropriateness, patient-specific contraindications, therapeutic duplication, pharmacogenomics (CPIC Level A), REMS compliance, naloxone co-prescribing, excluded provider screening
2. **ML & Anomaly Detection** — Statistical pattern analysis: prescriber behavior, doctor shopping, refill anomalies, pharmacy billing, cost outliers, drug wastage, pill mill/fraud networks
3. **Patient-Specific Reasoning** — EHR-aware contextual analysis: comorbidity assessment, lab value trending, prior treatment awareness, adherence analysis, medication load, opioid stewardship (MME tracking per CDC 2022)

### Flag System
Every prescription receives a **GREEN/YELLOW/RED** flag based on risk score (0–1):
- **GREEN (< 0.3)** → Auto-approve (APPROVE disposition)
- **YELLOW (0.3–0.7)** → Soft hold with 24h SLA (REVIEW disposition)
- **RED (> 0.7)** → Hard hold, explicit resolution required (FLAG disposition)

Each flag includes: rule violated, explanation, evidence source (FDA/CDC/CPIC/clinical guidelines), and suggested action.

### Key Features
- **11 Frontend Pages**: Dashboard, Prescriptions, Patients, Providers, Prior Auth, Formulary, Interactions, Analytics, Audit Trail, Settings, Checks
- **PBA/TPA Modes**: Real-time pharmacy adjudication (sub-200ms) + post-adjudication batch workflows
- **Pharmacogenomics (Check 15)**: CPIC Level A for CYP2D6, CYP2C19, HLA-B*57:01, TPMT, DPYD
- **REMS Compliance (Check 16)**: iPLEDGE, clozapine REMS, TIRF, sodium oxybate monitoring
- **Naloxone Co-Prescribing (Check 21)**: CDC 2022 Recommendation 8 enforcement
- **Excluded Provider Screening**: HHS-OIG LEIE / SAM.gov federal exclusion list matching
- **AI Copilot**: Claude API-powered natural language interface; generates clinical notes, formulary checks, PA letters
- **Data Sources Panel**: 10 integration status trackers (FHIR, EDI 837, NCPDP, PDMP, openFDA, RxNav, etc.)
- **Audit Trail**: ERISA § 404(a)(1)(B) compliant evidence chain for every decision
- **Dark Mode & Auth**: Full dark theme, role-based login context

---

## Technical Architecture

```
┌────────────────────────────────────────────────────────────────────────────┐
│                        Frontend (Next.js 14)                               │
│                    localhost:3000 (or Vercel prod)                         │
│                                                                             │
│  11 Pages | Dark Mode | Auth | AI Copilot | Settings (localStorage)       │
│  Components: FlagBadge, DispositionBadge, DataTable, DetailDrawer, etc.    │
└────────────────────────────────────────┬────────────────────────────────────┘
                                         │
                       HTTP/REST (CORS-enabled)
                                         │
┌────────────────────────────────────────▼────────────────────────────────────┐
│                      Backend (Python FastAPI)                              │
│                    localhost:8000 (or Render prod)                         │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │              3-ENGINE CLINICAL ANALYSIS PIPELINE                     │  │
│  │                                                                      │  │
│  │  Rules Engine        ML & Anomaly              Patient Context       │  │
│  │  ─────────────       ─────────────             ──────────────       │  │
│  │  • DDIs              • Prescriber behavior     • Comorbidity         │  │
│  │  • Dose ranges       • Doctor shopping        • Lab trending        │  │
│  │  • Allergies         • Refill anomalies       • Prior Hx            │  │
│  │  • PGx (CPIC)        • Pharmacy billing       • Adherence           │  │
│  │  • REMS              • Cost outliers          • MME tracking        │  │
│  │  • Naloxone          • Fraud detection        • Medication load     │  │
│  │  • Excluded Px       • Network clustering     • Specialty review    │  │
│  │                                                                      │  │
│  │              ↓          ↓          ↓                                │  │
│  │         GREEN / YELLOW / RED + Risk Score (0–1)                    │  │
│  │              ↓                                                      │  │
│  │         APPROVE / REVIEW / FLAG Disposition                        │  │
│  │              + Soft/Hard Hold Logic                                │  │
│  │                                                                      │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │         ML ENSEMBLE (6 Real sklearn-family Models)                   │  │
│  │                                                                      │  │
│  │  1. XGBoost (GBT)           — Claim-level fraud probability         │  │
│  │  2. LightGBM (GBDT)         — Prescriber anomaly vs peers           │  │
│  │  3. IsolationForest         — Outlier detection (300 estimators)    │  │
│  │  4. DBSCAN                  — Prescriber-pharmacy-patient networks  │  │
│  │  5. Meta-learner (LR)       — Stack XGB + LGB → ANOMALY_SCORE      │  │
│  │  6. TF-IDF + LR             — Patient context layer (stand-in for   │  │
│  │                               BioClinicalBERT running in Hopkins)   │  │
│  │                                                                      │  │
│  │  All trained at app startup on seeded data.                        │  │
│  │  Provides scoring, status, feature importance endpoints.           │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │         OPERATING MODES                                              │  │
│  │                                                                      │  │
│  │  TPA Mode (Post-adjudication, pre-payment)                          │  │
│  │  • Batch claim file processing (NCPDP Batch 1.2)                    │  │
│  │  • Pend queue with 24h SLA                                          │  │
│  │  • Employer-by-employer reporting                                   │  │
│  │  • ASA disputes, ERISA stewardship                                  │  │
│  │                                                                      │  │
│  │  PBA Mode (Real-time, pre-dispense)                                 │  │
│  │  • NCPDP D.0 adjudication embedded in pharmacy POS                  │  │
│  │  • Sub-200ms p95 latency requirement                                │  │
│  │  • Hard-stops at point of dispense                                  │  │
│  │  • Pharmacist callbacks                                             │  │
│  │  • Pharmacy network management                                      │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │         EXTERNAL INTEGRATIONS                                        │  │
│  │                                                                      │  │
│  │  Public APIs (Live):          Validation Databases:                │  │
│  │  • NPPES (provider lookup)    • MarketScan                          │  │
│  │  • openFDA (label/FAERS)      • Kythera Wayfinder                   │  │
│  │  • RxNav (drug equivalence)   • Truveta TDM                         │  │
│  │  • Clinical Tables (ICD-10)                                         │  │
│  │  • CMS Open Payments                                                │  │
│  │  • PubMed (evidence synthesis)                                      │  │
│  │                                                                      │  │
│  │  Standards:                                                         │  │
│  │  • HL7 FHIR R4, EDI 837, NCPDP D.0, PMPInterConnect               │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  Routers: prescriptions, patients, providers, analytics, drugs, search,    │
│           audit, interactions, copilot, v8, tpa, pba, data_sources,       │
│           public_apis, ml_engine, websocket                               │
└────────────────────────────────────────────────────────────────────────────┘
                                         │
                                    SQLite DB
                          (or PostgreSQL in production)
                           50 patients, 200+ Rx, 20 providers
```

---

## Prerequisites & Quick Start

### System Requirements
- **Python 3.11+** (with pip and venv)
- **Node.js 18+** (with npm)
- **Git**

### Backend Setup (5 minutes)

```bash
cd backend
python -m venv .venv

# Windows
.venv\Scripts\activate

# macOS/Linux
source .venv/bin/activate

pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

The backend automatically:
- Creates SQLite database (`axeris.db`)
- Seeds 50 synthetic patients, 200+ prescriptions, 20 providers
- Trains 6 ML models on startup
- Starts API at `http://localhost:8000`
- Serves Swagger docs at `http://localhost:8000/docs`

**Troubleshooting:**
- If database schema changed, delete `axeris.db` before restart
- Python 3.13 users: See `backend/requirements.txt` for compatibility pins
- Windows PATH issue: `export PATH="/c/Program Files/nodejs:$PATH"`

### Frontend Setup (3 minutes)

```bash
cd frontend
npm install
npm run dev
```

Frontend starts at `http://localhost:3000`

### Login
Click **Quick Demo Login** or enter any email/password. No auth validation; for demo purposes.

---

## API Overview

**Base URL:** `/api/v1`

### Prescription Analysis
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/prescriptions` | List all prescriptions (filterable by flag, status, patient) |
| GET | `/prescriptions/{id}` | Single prescription with full analysis + flags |
| POST | `/prescriptions/analyze` | Submit new Rx for real-time analysis |
| POST | `/prescriptions/{id}/action` | Update disposition (APPROVE/REVIEW/FLAG) |

### Patient & Provider Intelligence
| GET | `/patients` | All patients with risk summary |
| GET | `/patients/{id}` | Full patient profile: diagnoses, allergies, labs, PGx, REMS |
| GET | `/providers` | Provider risk scoring + peer comparison |
| GET | `/providers/{id}` | Provider detail with controlled substance volume |

### Analytics & Reporting
| GET | `/analytics/dashboard` | KPIs: flags, savings, trends, fraud |
| GET | `/analytics/cohort/{condition}` | Cohort-level analysis by diagnosis |
| GET | `/audit` | ERISA § 404 audit trail with stats |

### AI & Clinical Features
| POST | `/copilot/chat` | Natural language Q&A against live data |
| POST | `/copilot/generate-note` | Clinical note generation (review summary, PA letter, denial rationale) |
| GET | `/copilot/formulary-check/{drug_id}` | Tier, PA requirements, therapeutic alternatives |
| GET | `/copilot/data-sources` | Integration status (FHIR, EDI, NCPDP, etc.) |

### Operating Modes
| GET | `/tpa/dashboard` | TPA mode: pend queue, SLA, employer reporting |
| GET | `/pba/dashboard` | PBA mode: latency, NCPDP rejects, pharmacist callbacks |
| GET | `/pba/live-transactions` | Real-time adjudication stream |

### ML & Validation
| GET | `/ml-engine/status` | Model training status + metrics |
| GET | `/ml-engine/predict` | Raw ML scoring (XGB, LGB, meta) |
| GET | `/public-apis/validate` | Live public API connectivity |

Full interactive docs: `http://localhost:8000/docs`

---

## Project Structure

```
Proto1/
│
├── README.md                          ← You are here
│
├── backend/                           ← Python FastAPI
│   ├── main.py                        # App entry point, lifespan, routers
│   ├── config.py                      # Thresholds, flag colors, SLA settings
│   ├── requirements.txt               # pip dependencies
│   │
│   ├── database/
│   │   ├── database.py                # SQLAlchemy engine, session
│   │   ├── models.py                  # ORM: Patient, Prescription, Drug, etc.
│   │   └── seed.py                    # Synthetic data generation
│   │
│   ├── engines/                       # 3-tier clinical analysis
│   │   ├── rules_engine.py            # Deterministic checks (16 checks in Categories A-D, plus PGx/REMS/naloxone)
│   │   ├── ml_engine.py               # Statistical pattern detection (7 checks)
│   │   ├── patient_engine.py          # EHR-aware contextual analysis (7 checks)
│   │   ├── ml_models.py               # 6 real sklearn models: XGB, LGB, ISO, DBSCAN, Meta-LR, TF-IDF
│   │   └── equivalence.py             # Therapeutic equivalence lookups
│   │
│   ├── routers/                       # API endpoints (12 routers, 80+ endpoints)
│   │   ├── prescriptions.py           # Core Rx CRUD + analysis
│   │   ├── patients.py                # Patient profiles
│   │   ├── providers.py               # Provider risk + peer comparison
│   │   ├── drugs.py                   # Drug database + interactions
│   │   ├── analytics.py               # Dashboard KPIs + cohort analysis
│   │   ├── audit.py                   # ERISA § 404 audit trail
│   │   ├── copilot.py                 # AI chat + note generation
│   │   ├── interactions.py            # Drug interaction network
│   │   ├── v8.py                      # v8-specific endpoints (PGx, REMS, etc.)
│   │   ├── tpa.py                     # Third-party administrator workflows
│   │   ├── pba.py                     # Pharmacy benefit administrator (real-time)
│   │   ├── data_sources.py            # Integration status manifest
│   │   ├── public_apis.py             # NPPES, openFDA, RxNav, etc.
│   │   ├── ml_engine_router.py        # Model status + predictions
│   │   ├── search.py                  # Global search
│   │   └── websocket.py               # Real-time notifications
│   │
│   ├── schemas/                       # Pydantic response models
│   │   ├── prescription.py
│   │   ├── patient.py
│   │   ├── provider.py
│   │   ├── drug.py
│   │   └── analytics.py
│   │
│   └── data/                          # Static reference data
│       ├── drug_database.json         # ~55 drugs with clinical metadata
│       └── interactions.json          # ~40 drug-drug interaction pairs
│
├── frontend/                          ← Next.js 14 TypeScript
│   ├── package.json
│   ├── tsconfig.json
│   ├── next.config.js                 # API proxy rewrites
│   ├── tailwind.config.ts             # Design system
│   │
│   ├── src/
│   │   ├── app/
│   │   │   ├── layout.tsx             # Root layout, providers
│   │   │   ├── page.tsx               # Dashboard
│   │   │   ├── prescriptions/
│   │   │   │   ├── page.tsx           # List + filters
│   │   │   │   └── [id]/page.tsx      # Detail + AI copilot
│   │   │   ├── patients/, providers/, prior-auth/, formulary/
│   │   │   ├── interactions/, analytics/, audit/, settings/
│   │   │   ├── checks/                # Clinical checks reference
│   │   │   ├── pba/ (PBA mode pages)
│   │   │   └── tpa/ (TPA mode pages)
│   │   │
│   │   ├── components/
│   │   │   ├── layout/
│   │   │   │   ├── AppShell.tsx       # Nav, sidebar, copilot
│   │   │   │   ├── Sidebar.tsx
│   │   │   │   ├── Header.tsx
│   │   │   │   ├── ModeBar.tsx        # TPA/PBA mode switcher
│   │   │   │   └── GlobalSearch.tsx
│   │   │   ├── dashboard/
│   │   │   │   ├── MetricsCards.tsx
│   │   │   │   ├── FlagDistribution.tsx
│   │   │   │   ├── PrescriptionFlow.tsx
│   │   │   │   └── RecentAlerts.tsx
│   │   │   ├── prescriptions/
│   │   │   │   ├── FlagBadge.tsx
│   │   │   │   └── DispositionBadge.tsx
│   │   │   ├── ui/
│   │   │   │   ├── DataTable.tsx      # Reusable table component
│   │   │   │   ├── DetailDrawer.tsx
│   │   │   │   ├── CopilotPanel.tsx   # Floating AI chat
│   │   │   │   ├── DataSourceBadge.tsx
│   │   │   │   └── ToastContainer.tsx
│   │   │   └── auth/
│   │   │       └── LoginScreen.tsx
│   │   │
│   │   ├── context/
│   │   │   ├── AuthContext.tsx        # User + role
│   │   │   ├── ModeContext.tsx        # TPA/PBA mode
│   │   │   ├── ThemeContext.tsx       # Dark mode
│   │   │   ├── SettingsContext.tsx    # User preferences
│   │   │   └── ToastContext.tsx       # Notifications
│   │   │
│   │   ├── hooks/
│   │   │   └── useWebSocket.ts        # Real-time updates
│   │   │
│   │   ├── lib/
│   │   │   └── api.ts                 # Typed fetch wrapper
│   │   │
│   │   └── types/
│   │       └── index.ts               # TypeScript definitions
│   │
│   └── public/                        # Static assets
│
└── docs/                              ← Documentation
    ├── ARCHITECTURE.md                # System design + data flow
    ├── CLINICAL_CHECKS.md             # All 24 checks with evidence sources
    ├── screenshots/                   # UI previews
    └── (API docs auto-generated at /docs)
```

---

## Key Technical Decisions

### Why SQLite for Demo, PostgreSQL for Production
SQLite requires zero setup and self-seeds. In production, scale to PostgreSQL with connection pooling (pgbouncer) and read replicas for analytics queries.

### Why 6 Real ML Models Instead of Mocks
The platform trains actual XGBoost, LightGBM, IsolationForest, DBSCAN, stacking LR, and TF-IDF models at startup. This demonstrates production ML architecture (feature engineering, hyperparameter selection, evaluation metrics). BioClinicalBERT/PubMedBERT run in Hopkins' SAFE Desktop or HuggingFace Inference API in production.

### Why TPA + PBA Modes
- **TPA** = traditional post-adjudication review (allows 24h SLA, batch file ingestion)
- **PBA** = transparent PBM pre-dispense (sub-200ms p95 latency, hard-stops at pharmacy)

Different workflows, same 24-check engine; mode is runtime configurable.

### Why ERISA § 404 Audit Trail
Every flag, action, and AI-generated note is logged with timestamp, user, reason, evidence. CYA: if a claim is disputed, you have irrefutable proof of due process.

### Why No Secrets in Repo
Claude API key goes in environment (`.env` ignored). App falls back to simulated responses if key missing (demo mode).

---

## Testing & Deployment

### Local Testing
```bash
# Backend tests
cd backend
pytest tests/  # (if test suite exists)

# Frontend tests
cd frontend
npm run test
```

### Deployment

**Frontend (Vercel):**
```bash
cd frontend
vercel deploy
```
Live at: https://proto2-mocha.vercel.app

**Backend (Render):**
- Push to GitHub
- Connect Render project to repo
- Set `RENDER_DB_URL` (PostgreSQL) in env vars
- Deploy from dashboard
Live at: https://proto2-80qe.onrender.com

---

## Documentation Files

- **`README.md`** (this file) — Project overview, quick start, architecture
- **`backend/README.md`** — API docs, engine architecture, ML details, env vars
- **`frontend/README.md`** — Page map, component library, design system
- **`docs/ARCHITECTURE.md`** — Full system diagrams, data flow, tech choices
- **`docs/CLINICAL_CHECKS.md`** — All 24 checks with FDA/CDC/CPIC sources

---

## Compliance & Standards

| Standard | Coverage | Location |
|----------|----------|----------|
| **ERISA § 404(a)(1)(B)** | Audit trail with evidence chain | `/api/v1/audit` |
| **FDA REMS (ETASU)** | iPLEDGE, clozapine, TIRF, sodium oxybate | `rules_engine.py:rems_compliance_check()` |
| **CPIC Level A** | CYP2D6, CYP2C19, HLA-B*57:01, TPMT, DPYD | `rules_engine.py:pharmacogenomic_check()` |
| **CDC 2022 Opioid Guidelines** | Naloxone co-prescribing, MME tracking | `rules_engine.py:naloxone_coprescribing_check()` + `patient_engine.py` |
| **HL7 FHIR R4** | Patient data exchange format | `/api/v1/data-sources` |
| **EDI 837** | Insurance claim submission | Data model |
| **NCPDP D.0** | Real-time pharmacy adjudication | `pba.py` |
| **HHS-OIG LEIE / SAM.gov** | Excluded provider screening | `rules_engine.py:excluded_provider_check()` |

---

## Known Limitations (Demo Version)

1. **Synthetic Data Only** — All patients, prescriptions, and providers are fictional. Not clinically valid.
2. **SQLite Storage** — Single-file database; no concurrent write support. Use PostgreSQL in production.
3. **Claude API Key Optional** — Copilot falls back to simulated responses if key missing.
4. **No Real FHIR/EDI Ingestion** — Data sources are mocked. Production uses real connectors.
5. **BioClinicalBERT Proxy** — TF-IDF + LR stand-in for full BERT model (lives in Hopkins SAFE Desktop in real deployment).
6. **Mock LEIE/SAM.gov Sync** — Excluded provider list seeded; real deployment syncs daily.

---

## Glossary

| Term | Definition |
|------|-----------|
| **RED/YELLOW/GREEN** | Flag colors; correspond to APPROVE/REVIEW/FLAG dispositions |
| **TPA** | Third-Party Administrator; post-adjudication batch workflows |
| **PBA** | Pharmacy Benefit Administrator; real-time pre-dispense adjudication |
| **ERISA** | Employee Retirement Income Security Act; governs self-funded plans |
| **SLA** | Service Level Agreement; soft-hold auto-release after 24h |
| **Soft Hold** | REVIEW tier; auto-releases after SLA unless escalated |
| **Hard Hold** | FLAG tier; requires explicit reviewer action to resolve |
| **REMS** | Risk Evaluation and Mitigation Strategy; FDA-mandated monitoring |
| **ETASU** | Elements to Assure Safe Use; REMS + enrollment requirements |
| **CPIC** | Clinical Pharmacogenetics Research Network; level A = actionable evidence |
| **MME** | Morphine Milligram Equivalent; opioid potency standardization |
| **PGx** | Pharmacogenomics; genetic testing + drug metabolism matching |
| **LEIE** | List of Excluded Individuals & Entities (HHS-OIG) |
| **Disposition** | Final action: APPROVE, REVIEW, or FLAG |

---

## Support & Contributing

**Questions?** See:
- API docs: http://localhost:8000/docs
- Clinical checks: `docs/CLINICAL_CHECKS.md`
- Architecture: `docs/ARCHITECTURE.md`

**Report Issues:** Create an issue in the repo or contact the maintainer.

---

## Disclaimer

This is a **prototype using simulated data**. All patient information, prescriptions, provider details, and clinical data are **fictional** and generated for demonstration only. **Not for clinical use without review by licensed pharmacists and physicians.** AI responses require human expert verification. Use only in development/training environments.

---

**Axeris v0.8** — AI Clinical Decision Support Platform
**Built for:** Health Insurers, PBMs, and Utilization Management Teams
**Last Updated:** April 2026
