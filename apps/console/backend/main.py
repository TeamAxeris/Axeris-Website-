from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from contextlib import asynccontextmanager

from database.database import engine, Base
from routers import prescriptions, patients, providers, analytics, drugs
from routers import search, audit, interactions, websocket as ws_router
from routers import copilot, v8, tpa, pba, data_sources, public_apis, ml_engine_router, safeguards, notifications
from config import API_V1_PREFIX


def _train_models_background():
    """Train the sklearn models off the request path. The server starts
    serving immediately; model-backed endpoints report trained=false until
    this thread finishes (they all handle that state gracefully)."""
    try:
        from engines import ml_models
        status = ml_models.train_models()
        if status.get("trained"):
            print(f"[Axeris] ML models trained (background): xgboost={status['models']['xgboost']['n_training_samples']} "
                  f"samples, lightgbm={status['models']['lightgbm']['n_training_samples']} samples, "
                  f"isolation_forest={status['models']['isolation_forest']['n_training_samples']} samples, "
                  f"dbscan_clusters={status['models']['dbscan']['n_clusters_found']}, "
                  f"meta_learner={status['models']['meta_learner_lr']['n_training_samples']} samples, "
                  f"context_layer={status['models']['patient_context_layer']['n_training_samples']} samples")
        else:
            print(f"[Axeris] ML training skipped: {status.get('reason', 'unknown')}")
    except Exception as e:
        print(f"[Axeris] ML training error (non-fatal): {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: create tables + seed (blocking — endpoints need data),
    # then train ML models in a background thread (non-blocking — the
    # training pass previously held the whole API offline for its duration,
    # which read as an "insanely long" demo start).
    Base.metadata.create_all(bind=engine)
    from database.seed import seed_if_empty
    seed_if_empty()
    # Capture the event loop so threadpool request handlers can schedule
    # WebSocket broadcasts safely (see routers.websocket.notify_threadsafe).
    ws_router.capture_main_loop()
    import threading
    threading.Thread(target=_train_models_background, name="ml-train", daemon=True).start()
    yield
    # Shutdown


app = FastAPI(
    title="Axeris",
    description="AI Clinical Decision Support for Prescription Review (v8 — April 2026)",
    version="0.8.0",
    lifespan=lifespan,
)

import os
_allowed_origins = os.environ.get("AXERIS_CORS_ORIGINS", "").split(",")
_allowed_origins = [o.strip() for o in _allowed_origins if o.strip()]
if not _allowed_origins:
    # Demo defaults — explicit allow-list per security review
    _allowed_origins = [
        "http://localhost:3000",
        "https://proto2-mocha.vercel.app",
    ]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    # Any localhost port during local dev, so the trailing-slash redirect a
    # proxied fetch triggers doesn't get blocked when the frontend runs on a
    # non-default port (e.g. 3001/3002 when 3000 is taken).
    allow_origin_regex=r"http://localhost:\d+",
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# Compress JSON payloads — list endpoints shrink ~10x over the wire
app.add_middleware(GZipMiddleware, minimum_size=1000)


@app.middleware("http")
async def add_cache_and_security_headers(request, call_next):
    """Short private cache on GET reads (the frontend's stale-while-revalidate
    layer refreshes in the background) + baseline security headers."""
    response = await call_next(request)
    if request.method == "GET" and request.url.path.startswith("/api/v1"):
        response.headers.setdefault("Cache-Control", "private, max-age=30, stale-while-revalidate=300")
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
    return response

# Core routers
app.include_router(prescriptions.router, prefix=API_V1_PREFIX)
app.include_router(patients.router, prefix=API_V1_PREFIX)
app.include_router(providers.router, prefix=API_V1_PREFIX)
app.include_router(analytics.router, prefix=API_V1_PREFIX)
app.include_router(drugs.router, prefix=API_V1_PREFIX)

# New dynamic feature routers
app.include_router(search.router, prefix=API_V1_PREFIX)
app.include_router(audit.router, prefix=API_V1_PREFIX)
app.include_router(interactions.router, prefix=API_V1_PREFIX)
app.include_router(copilot.router, prefix=API_V1_PREFIX)

# v8 (April 2026) — Pharmacogenomics, REMS, Excluded Provider Screening, Pill Mill/Fraud
app.include_router(v8.router, prefix=API_V1_PREFIX)

# Mode-specific routers — TPA Mode (post-adjudication batch) + PBA Mode (real-time NCPDP D.0)
app.include_router(tpa.router, prefix=API_V1_PREFIX)
app.include_router(pba.router, prefix=API_V1_PREFIX)

# Validation data source manifest (Truveta, Kythera + public APIs)
app.include_router(data_sources.router, prefix=API_V1_PREFIX)

# Live public APIs — openFDA, RxNav, Clinical Tables, CMS Open Payments, PubMed
app.include_router(public_apis.router, prefix=API_V1_PREFIX)

# Real ML engine status + predictions (sklearn IsolationForest + GradientBoostingClassifier)
app.include_router(ml_engine_router.router, prefix=API_V1_PREFIX)

# Patient-safety safeguards: pre-deny guard + reviewer-rate surveillance + ERISA §404 controls
app.include_router(safeguards.router, prefix=API_V1_PREFIX)

# Aggregated notifications feed for the header bell
app.include_router(notifications.router, prefix=API_V1_PREFIX)

# WebSocket (no prefix)
app.include_router(ws_router.router)


@app.get("/")
def root():
    return {
        "name": "Axeris",
        "version": "0.8.0",
        "spec_version": "v8 — April 2026",
        "description": "AI Clinical Decision Support for Prescription Review",
        "docs": "/docs",
        "features": [
            "24 numbered clinical safety checks across 6 categories (A-F)",
            "3-engine architecture (Rules + ML + Patient Context)",
            "APPROVE / REVIEW / FLAG disposition with soft/hard hold logic",
            "TPA Mode (post-adjudication) + PBA Mode (real-time pre-dispense)",
            "Pharmacogenomics (CPIC Level A) — CYP2D6, CYP2C19, HLA-B*57:01, TPMT, DPYD",
            "REMS Compliance (iPLEDGE, clozapine REMS, TIRF, sodium oxybate)",
            "Naloxone Co-Prescribing (CDC 2022 Recommendation 8)",
            "Pill Mill / Fraud Network Detection (DBSCAN-style)",
            "Foundational LEIE / SAM.gov excluded provider screening",
            "ERISA § 404(a)(1)(B) audit trail with evidence chain",
            "AI Clinical Copilot (Claude API)",
            "5 monitoring modules: Opioid Stewardship, Adherence, Specialty, PA, Wastage",
            "Real-time WebSocket notifications",
        ],
    }
