import os

# Single source of truth for the DB URL — overridable via AXERIS_DATABASE_URL
# (e.g. on Render set AXERIS_DATABASE_URL=postgresql://… for production).
_DEFAULT_DATABASE_URL = "sqlite:///./axeris.db"
DATABASE_URL = os.environ.get("AXERIS_DATABASE_URL", _DEFAULT_DATABASE_URL)

API_V1_PREFIX = "/api/v1"

# Flag color thresholds (risk score 0.0 - 1.0)
RED_SCORE_THRESHOLD = 0.7
YELLOW_SCORE_THRESHOLD = 0.3

# v8: APPROVE/REVIEW/FLAG dispositions + hold logic
# Color → Disposition mapping (per spec Part 9)
COLOR_TO_DISPOSITION = {
    "GREEN": "APPROVE",   # Auto-payment authorization
    "YELLOW": "REVIEW",   # Soft hold with SLA auto-release
    "RED": "FLAG",        # Hard hold — explicit resolution required
}

# Soft-hold SLA — auto-release after this many hours if no reviewer action
SOFT_HOLD_SLA_HOURS = 24      # REVIEW tier auto-releases after 24h
SOFT_HOLD_URGENT_SLA_HOURS = 4  # Urgent items (cost > $5K) escalated faster

# Operating mode (default for any newly-analyzed Rx)
DEFAULT_OPERATING_MODE = "TPA"   # TPA (post-adjudication, pre-payment) | PBA (real-time, pre-dispense)

# Clinical thresholds
POLYPHARMACY_THRESHOLD = 5  # Active meds count triggering polypharmacy scoring
CONTROLLED_SUBSTANCE_VOLUME_ZSCORE = 2.0  # Std devs above mean for outlier
EARLY_REFILL_DAYS = 7  # Days before expected refill = "early"
DOCTOR_SHOPPING_PROVIDER_THRESHOLD = 3  # Distinct controlled substance prescribers in 90 days
ADHERENCE_MPR_THRESHOLD = 0.8  # Medication possession ratio below this = poor adherence
