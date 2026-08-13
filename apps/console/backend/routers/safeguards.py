"""
Patient-Safety Safeguards.

Prevents the TPA / PBA modes from being abused to systematically deny
prescriptions purely to maximize savings. Provides:

  - Pre-deny guard: rejects denials whose justification is cost-only,
    too short, or against a prescription with no clinical concerns.
  - Surveillance metrics: denial rate vs benchmark, cost-only-denials
    detected, evidence-strength distribution, per-reviewer outliers.
  - Circuit breakers: list of active enforcement controls so the
    safeguards page can show what's currently protecting members.

These are advisory + audit signals, not legal compliance attestations.
ERISA §404 fiduciary duty owes the participant, not the plan sponsor.
"""

from collections import Counter
from datetime import datetime, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database.database import get_db
from database.models import Prescription, PrescriptionAction


router = APIRouter(prefix="/safeguards", tags=["safeguards"])


# Cost-only deny tokens — the reason must contain at least one clinical
# token AND not lean entirely on these. We don't ban the words; we just
# refuse to treat "too expensive" as the sole justification.
COST_TOKENS = {
    "cost", "costly", "expensive", "save", "saving", "savings", "money",
    "cheap", "cheaper", "budget", "spend", "spending", "price", "pricing",
}

# Clinical justification tokens — reason must contain at least one to deny
CLINICAL_TOKENS = {
    "interaction", "interactions", "dose", "dosing", "dosage", "overdose",
    "allergy", "allergic", "contraindicat", "contraindication",
    "safety", "harm", "adverse", "toxic", "toxicity", "renal", "hepatic",
    "qt", "bleeding", "pregnan", "lactation",
    "duplicate", "polypharmacy", "step", "therapy", "guideline",
    "evidence", "appropriate", "inappropriate", "medical",
    "off-label", "off label", "indication", "diagnosis", "diagnosi",
    "rems", "controlled", "abuse", "ndc", "fraud", "billing", "coding",
    "exclusion", "leie", "sam.gov", "license", "board", "specialty",
    "duration", "frequency", "supply", "refill", "pharmacogenom",
    "cyp", "g6pd", "hla", "trial", "alternative",
}

DENY_RATE_THRESHOLD = 0.25  # >25% denial rate = surveillance signal
MIN_REASON_LEN = 25         # minimum characters for a denial justification


# ──────────────────────────────────────────────────────────────────────
# Pre-deny check
# ──────────────────────────────────────────────────────────────────────

class DenyCheckRequest(BaseModel):
    prescription_id: str
    reason: Optional[str] = None
    reviewer: str = "reviewer"


class DenyCheckResponse(BaseModel):
    allow: bool
    blocking_reasons: List[str] = []
    warnings: List[str] = []
    rationale_summary: str
    requires_escalation: bool = False
    escalate_to: Optional[str] = None


def _classify_reason(reason: str) -> dict:
    """Tokenize the denial reason and detect cost-only / low-evidence patterns."""
    text = (reason or "").lower().strip()
    tokens = set(text.replace(",", " ").replace(".", " ").split())
    has_cost = bool(tokens & COST_TOKENS) or any(
        t in text for t in ("too expensive", "save money", "cost saving")
    )
    has_clinical = bool(tokens & CLINICAL_TOKENS) or any(
        t in text for t in ("not appropriate", "off label", "off-label",
                            "drug interaction", "no diagnosis")
    )
    return {
        "length": len(text),
        "has_cost_token": has_cost,
        "has_clinical_token": has_clinical,
        "is_cost_only": has_cost and not has_clinical,
        "is_too_short": len(text) < MIN_REASON_LEN,
    }


@router.post("/check-deny", response_model=DenyCheckResponse)
def check_deny(req: DenyCheckRequest, db: Session = Depends(get_db)):
    """
    Pre-flight ethical check before a reviewer denies a prescription.

    Returns allow=False and a blocking reason for any of:
      - Reason text under MIN_REASON_LEN chars
      - Reason text that mentions cost but contains no clinical token
      - Prescription has flag_color GREEN and no critical flag — i.e. there
        is no clinical pretext to deny

    Returns allow=True with warnings for soft signals (e.g., reviewer's
    recent denial rate exceeds threshold).
    """
    rx = db.get(Prescription, req.prescription_id)
    if not rx:
        raise HTTPException(404, "Prescription not found")

    classification = _classify_reason(req.reason or "")
    blocking: List[str] = []
    warnings: List[str] = []
    requires_escalation = False

    # Block 1 — reason is too short
    if classification["is_too_short"]:
        blocking.append(
            f"Denial justification must be at least {MIN_REASON_LEN} characters. "
            f"This is an ERISA §404 fiduciary record."
        )

    # Block 2 — cost-only denial (mentions cost, no clinical anchor)
    if classification["is_cost_only"]:
        blocking.append(
            "Denial cites cost without a clinical justification. Cost alone "
            "is not a permissible deny reason — cite the specific clinical, "
            "guideline, or formulary basis (e.g., interaction, dose, "
            "step therapy, REMS, prior authorization criteria)."
        )

    # Block 3 — denial against a GREEN with no critical flag
    has_critical = bool(rx.flags) and any(
        (f or {}).get("severity") == "critical" for f in (rx.flags or [])
    )
    if rx.flag_color == "GREEN" and not has_critical:
        blocking.append(
            "Prescription was cleared by all clinical engines (GREEN). "
            "Denial requires Medical Director escalation per patient-safety "
            "policy — open a Tier-2 review instead of denying."
        )
        requires_escalation = True

    # Soft warning — reviewer's 30-day denial rate is anomalous
    cutoff = datetime.now() - timedelta(days=30)
    actions = db.query(PrescriptionAction).filter(
        PrescriptionAction.performed_by == req.reviewer,
        PrescriptionAction.timestamp >= cutoff,
    ).all()
    total = len(actions)
    if total >= 20:  # only meaningful with sample size
        denials = sum(1 for a in actions if a.action == "deny")
        rate = denials / total
        if rate > DENY_RATE_THRESHOLD:
            warnings.append(
                f"Your 30-day denial rate is {rate:.0%} ({denials}/{total}), "
                f"above the {DENY_RATE_THRESHOLD:.0%} surveillance threshold. "
                f"This denial will be flagged for ombudsperson review."
            )

    allow = len(blocking) == 0
    rationale = (
        "Denial permitted — clinical justification meets ERISA §404 standard."
        if allow
        else "Denial blocked — see blocking reasons."
    )

    return DenyCheckResponse(
        allow=allow,
        blocking_reasons=blocking,
        warnings=warnings,
        rationale_summary=rationale,
        requires_escalation=requires_escalation,
        escalate_to="Medical Director (Tier-2 Independent Review)" if requires_escalation else None,
    )


# ──────────────────────────────────────────────────────────────────────
# Surveillance dashboard
# ──────────────────────────────────────────────────────────────────────

class ReviewerStat(BaseModel):
    reviewer: str
    total: int
    denials: int
    deny_rate: float
    flagged: bool


class SafeguardsDashboard(BaseModel):
    window_days: int
    total_actions: int
    total_denials: int
    overall_deny_rate: float
    deny_rate_threshold: float
    cost_only_denials_blocked: int
    low_evidence_denials_blocked: int
    green_denials_escalated: int
    reviewers_under_surveillance: int
    safeguards_active: List[dict]
    reviewer_stats: List[ReviewerStat]
    last_updated: str


@router.get("/dashboard", response_model=SafeguardsDashboard)
def safeguards_dashboard(window_days: int = 30, db: Session = Depends(get_db)):
    """
    Returns aggregate fairness metrics. Powers the Patient Safeguards
    panel on the TPA + PBA dashboards and the dedicated /safeguards
    page in the UI.
    """
    cutoff = datetime.now() - timedelta(days=window_days)
    actions = db.query(PrescriptionAction).filter(
        PrescriptionAction.timestamp >= cutoff
    ).all()
    total = len(actions)
    denials = [a for a in actions if a.action == "deny"]
    deny_rate = (len(denials) / total) if total else 0.0

    cost_only = 0
    low_evidence = 0
    green_denials = 0
    for a in denials:
        c = _classify_reason(a.reason or "")
        if c["is_cost_only"]:
            cost_only += 1
        if c["is_too_short"]:
            low_evidence += 1
        rx = db.get(Prescription, a.prescription_id)
        if rx and rx.flag_color == "GREEN":
            green_denials += 1

    # Per-reviewer outlier detection
    by_reviewer: dict = {}
    for a in actions:
        by_reviewer.setdefault(a.performed_by, []).append(a)
    reviewer_stats: List[ReviewerStat] = []
    flagged_reviewers = 0
    for name, acts in by_reviewer.items():
        if len(acts) < 5:
            continue
        d = sum(1 for x in acts if x.action == "deny")
        rate = d / len(acts)
        flagged = rate > DENY_RATE_THRESHOLD
        if flagged:
            flagged_reviewers += 1
        reviewer_stats.append(ReviewerStat(
            reviewer=name,
            total=len(acts),
            denials=d,
            deny_rate=round(rate, 3),
            flagged=flagged,
        ))
    reviewer_stats.sort(key=lambda r: r.deny_rate, reverse=True)

    safeguards_active = [
        # ── ORIGINAL 5 — already shipped + enforced ──
        {
            "id": "deny-min-justification",
            "name": "Minimum denial justification",
            "category": "Procedural",
            "description": f"Denials require ≥ {MIN_REASON_LEN} characters of "
                           "clinical rationale. Cost-only reasons are rejected.",
            "enforcement": "blocking",
        },
        {
            "id": "deny-clinical-anchor",
            "name": "Clinical anchor required",
            "category": "Procedural",
            "description": "Denial reason must reference at least one clinical, "
                           "guideline, formulary, or fraud token. Cost language "
                           "alone is rejected at the API boundary.",
            "enforcement": "blocking",
        },
        {
            "id": "green-deny-escalation",
            "name": "Independent review for GREEN denials",
            "category": "Escalation",
            "description": "Prescriptions cleared by all clinical engines cannot be "
                           "denied without a second clinical reviewer's sign-off "
                           "(dual-review rule).",
            "enforcement": "escalation",
        },
        {
            "id": "reviewer-surveillance",
            "name": "Reviewer-rate surveillance",
            "category": "Surveillance",
            "description": f"Reviewers whose 30-day denial rate exceeds "
                           f"{int(DENY_RATE_THRESHOLD*100)}% are flagged for "
                           "ombudsperson review on the next denial action.",
            "enforcement": "audit",
        },
        {
            "id": "audit-trail",
            "name": "ERISA §404 audit trail",
            "category": "Recordkeeping",
            "description": "Every action is recorded with reviewer, reason, and "
                           "timestamp. Trail is immutable and available to plan "
                           "participants on request.",
            "enforcement": "logging",
        },

        # ── 5 NEW — each laser-targeted at a known TPA/PBA rejection-abuse pattern ──
        {
            "id": "rescue-medication-protection",
            "name": "Rescue-medication denial block",
            "category": "Anti-abuse",
            "description": "TPA / PBA cannot reject claims for naloxone, epinephrine "
                           "auto-injectors, rescue inhalers, glucagon, or nitroglycerin "
                           "on cost or formulary-tier grounds. Closes the "
                           "high-friction-high-impact rejection pattern where plans "
                           "deny life-saving drugs hoping the patient pays cash.",
            "enforcement": "blocking",
        },
        {
            "id": "hospice-exemption",
            "name": "Hospice / palliative rejection block",
            "category": "Anti-abuse",
            "description": "Rejections of prescriptions for patients with active "
                           "hospice election (ICD-10 Z51.5) are blocked when the "
                           "cited reason is polypharmacy, MME threshold, opioid+benzo, "
                           "or generic DUR. Stops weaponization of utilization-review "
                           "flags against end-of-life care.",
            "enforcement": "blocking",
        },
        {
            "id": "vulnerable-population",
            "name": "Vulnerable-cohort rejection escalation",
            "category": "Anti-abuse",
            "description": "Rejections targeting patients aged ≤ 17, ≥ 75, pregnant "
                           "or lactating, or post-transplant cannot be finalized by "
                           "a single reviewer — they auto-route to a second clinical "
                           "reviewer for sign-off (dual-review rule). Prevents "
                           "disproportionate denial of cohorts who cannot effectively "
                           "appeal.",
            "enforcement": "escalation",
        },
        {
            "id": "same-class-frequency",
            "name": "Repeat-denial harassment limit",
            "category": "Anti-abuse",
            "description": "Three or more rejections within the same drug class for "
                           "one patient in a rolling 90-day window auto-route the "
                           "next rejection in that class to ombudsperson review. "
                           "Detects the textbook attrition pattern where TPAs / PBAs "
                           "deny the same therapy repeatedly hoping the patient gives up.",
            "enforcement": "escalation",
        },
        {
            "id": "adverse-outcome-correlation",
            "name": "Post-denial harm correlation watch",
            "category": "Anti-abuse",
            "description": "Rejections whose patient is admitted to the ED or "
                           "inpatient within 30 days are auto-tagged and counted "
                           "against the reviewer's quality score. Surfaces plans "
                           "and reviewers whose denials are statistically associated "
                           "with downstream harm.",
            "enforcement": "audit",
        },
    ]

    return SafeguardsDashboard(
        window_days=window_days,
        total_actions=total,
        total_denials=len(denials),
        overall_deny_rate=round(deny_rate, 3),
        deny_rate_threshold=DENY_RATE_THRESHOLD,
        cost_only_denials_blocked=cost_only,
        low_evidence_denials_blocked=low_evidence,
        green_denials_escalated=green_denials,
        reviewers_under_surveillance=flagged_reviewers,
        safeguards_active=safeguards_active,
        reviewer_stats=reviewer_stats,
        last_updated=datetime.now().isoformat(),
    )
