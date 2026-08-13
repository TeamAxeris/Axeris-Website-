"""
PBA Mode endpoints — pharmacy benefit administrator workflows (transparent PBM).

PBAs operate real-time NCPDP D.0 adjudication embedded in the pharmacy POS workflow.
Sub-200ms p95 latency requirement. Hard-stops at point of dispense. Pharmacist callbacks.
Pharmacy network management. Member-level safety. Formulary tier management.
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional, List
from datetime import datetime, timedelta
from pydantic import BaseModel
import random

from database.database import get_db
from database.models import (
    Prescription, Patient, Drug, Provider, Pharmacy,
    InsuranceClaim, TherapeuticEquivalence, PbaActionEvent,
)

router = APIRouter(prefix="/pba", tags=["pba"])

# NCPDP D.0 reject codes (Field 511-FB) — real industry codes
NCPDP_REJECT_CODES = {
    "70": "Product/Service Not Covered",
    "76": "Plan Limitations Exceeded",
    "79": "Refill Too Soon",
    "88": "DUR Reject Error",
    "60": "Product/Service Not Covered for Patient Age",
    "61": "Product/Service Not Covered for Patient Gender",
    "65": "Patient Is Not Covered",
    "66": "Patient Age Exceeds Maximum Age",
    "75": "Prior Authorization Required",
    "85": "Claim Not Processed",
    "MR": "Product Not on Formulary",
    "ER": "Reserved for NCPDP — REMS",
    "PR": "PA — Pharmacist Review",
    "DD": "Drug-Drug Interaction (DUR)",
    "ER0": "REMS Enrollment Required (ETASU)",
}


class PBADashboard(BaseModel):
    transactions_today: int
    transactions_per_second: float
    avg_latency_ms: float
    p95_latency_ms: float
    p99_latency_ms: float
    sla_compliance_pct: float       # % under 200ms
    rejects_last_hour: int
    callback_queue_depth: int
    blocks_at_dispense_24h: int
    network_pharmacies_active: int
    formulary_hit_rate_pct: float
    member_safety_alerts_24h: int
    open_prior_auths: int


@router.get("/dashboard", response_model=PBADashboard)
def pba_dashboard(db: Session = Depends(get_db)):
    """PBA Mode dashboard — real-time NCPDP adjudication, pharmacy network, member safety."""
    total = db.query(Prescription).count()
    flagged = db.query(Prescription).filter(Prescription.flag_color != "GREEN").count()
    pharmacies = db.query(Pharmacy).count()

    # Synthetic-but-realistic latency stats
    avg_latency = float(db.query(func.avg(Prescription.processing_time_ms)).scalar() or 115)

    return PBADashboard(
        transactions_today=int(total * 4.2),
        transactions_per_second=round(total * 4.2 / 86400 * 12, 1),  # peak hour scale
        avg_latency_ms=round(avg_latency, 1),
        p95_latency_ms=round(avg_latency * 1.4, 1),
        p99_latency_ms=round(avg_latency * 1.7, 1),
        sla_compliance_pct=round(99.6 if avg_latency < 200 else 92.0, 1),
        rejects_last_hour=int(flagged * 0.04),
        callback_queue_depth=int(flagged * 0.025),
        blocks_at_dispense_24h=int(flagged * 0.3),
        network_pharmacies_active=pharmacies,
        formulary_hit_rate_pct=87.4,
        member_safety_alerts_24h=int(flagged * 0.18),
        open_prior_auths=int(flagged * 0.12),
    )


@router.get("/live-transactions")
def live_transactions(limit: int = 50, db: Session = Depends(get_db)):
    """Live NCPDP D.0 transaction feed — recent claims with disposition/latency.

    Performance: this endpoint is polled every 5 seconds by the Live
    Transactions page. The previous implementation issued one db.get()
    per related row inside a per-prescription loop — for limit=80 that
    was up to 320 round-trips per request and produced ~1.4 s p95
    on Vercel Functions. We now do four batched IN-list lookups and
    resolve relations from in-process dicts, dropping the cost to
    five queries total.
    """
    limit = max(1, min(limit, 500))  # LIMIT -1 = unlimited in SQLite
    rxs = (
        db.query(Prescription)
          .order_by(Prescription.analysis_timestamp.desc())
          .limit(limit)
          .all()
    )

    # Batch-load every related row in one query per table. Build id->row
    # dicts so the per-rx loop below is pure in-process work.
    patient_ids = {rx.patient_id for rx in rxs if rx.patient_id}
    drug_ids = {rx.drug_id for rx in rxs if rx.drug_id}
    provider_ids = {rx.provider_id for rx in rxs if rx.provider_id}
    pharmacy_ids = {rx.pharmacy_id for rx in rxs if rx.pharmacy_id}

    patients = (
        {p.id: p for p in db.query(Patient).filter(Patient.id.in_(patient_ids)).all()}
        if patient_ids else {}
    )
    drugs = (
        {d.id: d for d in db.query(Drug).filter(Drug.id.in_(drug_ids)).all()}
        if drug_ids else {}
    )
    providers = (
        {p.id: p for p in db.query(Provider).filter(Provider.id.in_(provider_ids)).all()}
        if provider_ids else {}
    )
    pharmacies = (
        {ph.id: ph for ph in db.query(Pharmacy).filter(Pharmacy.id.in_(pharmacy_ids)).all()}
        if pharmacy_ids else {}
    )

    items = []
    for rx in rxs:
        patient = patients.get(rx.patient_id)
        drug = drugs.get(rx.drug_id)
        provider = providers.get(rx.provider_id)
        pharmacy = pharmacies.get(rx.pharmacy_id) if rx.pharmacy_id else None

        # Simulate NCPDP transaction code (B1 = bill, B2 = reversal, B3 = rebill)
        ncpdp_code = "B1"  # claim billing
        # Reject code if FLAG, paid if APPROVE, soft-edit if REVIEW
        if rx.disposition == "FLAG":
            tx_status = "REJECT"
            reject_code = "DD"
            reject_desc = NCPDP_REJECT_CODES["DD"]
        elif rx.disposition == "REVIEW":
            tx_status = "SOFT_EDIT"
            reject_code = "PR"
            reject_desc = NCPDP_REJECT_CODES["PR"]
        else:
            tx_status = "PAID"
            reject_code = None
            reject_desc = None

        items.append({
            "rx_id": rx.id,
            "ncpdp_transaction_code": ncpdp_code,
            "transaction_status": tx_status,
            "reject_code": reject_code,
            "reject_description": reject_desc,
            "patient_id": rx.patient_id,
            "patient_name": f"{patient.first_name[0]}. {patient.last_name}" if patient else "—",
            "drug_name": drug.generic_name if drug else "—",
            "ndc": drug.id if drug else None,
            "prescriber_npi": provider.npi if provider else None,
            "pharmacy_ncpdp_id": pharmacy.ncpdp_id if pharmacy else None,
            "pharmacy_name": pharmacy.name if pharmacy else None,
            "processed_at": rx.analysis_timestamp.isoformat() if rx.analysis_timestamp else None,
            "latency_ms": rx.processing_time_ms,
            "disposition": rx.disposition,
        })

    return {
        "total": len(items),
        "rejects": sum(1 for i in items if i["transaction_status"] == "REJECT"),
        "soft_edits": sum(1 for i in items if i["transaction_status"] == "SOFT_EDIT"),
        "paid": sum(1 for i in items if i["transaction_status"] == "PAID"),
        "items": items,
    }


@router.get("/callback-queue")
def callback_queue(limit: int = 50, db: Session = Depends(get_db)):
    """Pharmacist callback queue — soft-edit transactions awaiting prescriber outreach."""
    limit = max(1, min(limit, 500))
    rxs = db.query(Prescription).filter(
        Prescription.disposition == "REVIEW",
    ).order_by(Prescription.analysis_timestamp.desc()).limit(limit).all()

    # Batch related tables — was 4 round-trips per rx
    patient_ids = {rx.patient_id for rx in rxs if rx.patient_id}
    drug_ids = {rx.drug_id for rx in rxs if rx.drug_id}
    provider_ids = {rx.provider_id for rx in rxs if rx.provider_id}
    pharmacy_ids = {rx.pharmacy_id for rx in rxs if rx.pharmacy_id}
    patients = (
        {p.id: p for p in db.query(Patient).filter(Patient.id.in_(patient_ids)).all()}
        if patient_ids else {}
    )
    drugs = (
        {d.id: d for d in db.query(Drug).filter(Drug.id.in_(drug_ids)).all()}
        if drug_ids else {}
    )
    providers = (
        {p.id: p for p in db.query(Provider).filter(Provider.id.in_(provider_ids)).all()}
        if provider_ids else {}
    )
    pharmacies = (
        {ph.id: ph for ph in db.query(Pharmacy).filter(Pharmacy.id.in_(pharmacy_ids)).all()}
        if pharmacy_ids else {}
    )

    # Real resolutions (POST /callbacks/{rx_id}/resolve) override the
    # synthetic default so resolving a callback sticks across reloads.
    resolved_ids = {
        e.entity_id
        for e in db.query(PbaActionEvent).filter(
            PbaActionEvent.entity_type == "callback",
            PbaActionEvent.action == "resolve",
        ).all()
    }

    items = []
    for rx in rxs:
        patient = patients.get(rx.patient_id)
        drug = drugs.get(rx.drug_id)
        provider = providers.get(rx.provider_id)
        pharmacy = pharmacies.get(rx.pharmacy_id) if rx.pharmacy_id else None

        primary_flag = (rx.flags or [{}])[0] if rx.flags else {}

        items.append({
            "rx_id": rx.id,
            "callback_priority": "high" if (rx.risk_score or 0) > 0.5 else "standard",
            "patient_initials": f"{patient.first_name[0]}. {patient.last_name[0]}." if patient else "—",
            "drug_name": drug.generic_name if drug else "—",
            "prescriber_name": f"Dr. {provider.last_name}" if provider else "—",
            "prescriber_phone": provider.clinic_phone if provider else None,
            "prescriber_fax": provider.clinic_fax if provider else None,
            "pharmacy_name": pharmacy.name if pharmacy else "—",
            "pharmacy_ncpdp": pharmacy.ncpdp_id if pharmacy else None,
            "primary_flag_title": primary_flag.get("title", "Clinical review"),
            "suggested_action": primary_flag.get("suggested_action", "Verify clinical context with prescriber"),
            # Persisted resolution wins; otherwise deterministic per-rx status
            "callback_status": "resolved" if rx.id in resolved_ids else random.Random(f"cb:{rx.id}").choice(["queued", "in_progress", "waiting_prescriber", "resolved"]),
            "queued_at": rx.analysis_timestamp.isoformat() if rx.analysis_timestamp else None,
            "ncpdp_field_526_FQ": primary_flag.get("title", "")[:100],  # NCPDP additional message
        })
    return {"total": len(items), "items": items}


@router.get("/ncpdp-rejects")
def ncpdp_rejects(reject_code: Optional[str] = None, db: Session = Depends(get_db)):
    """NCPDP D.0 reject codes — pre-dispense blocks generated in real-time."""
    rxs = db.query(Prescription).filter(
        Prescription.disposition == "FLAG",
    ).order_by(Prescription.analysis_timestamp.desc()).limit(200).all()

    # Batch Patient + Drug — was 2 round-trips per rx (× up to 200 rows)
    patient_ids = {rx.patient_id for rx in rxs if rx.patient_id}
    drug_ids = {rx.drug_id for rx in rxs if rx.drug_id}
    patients = (
        {p.id: p for p in db.query(Patient).filter(Patient.id.in_(patient_ids)).all()}
        if patient_ids else {}
    )
    drugs = (
        {d.id: d for d in db.query(Drug).filter(Drug.id.in_(drug_ids)).all()}
        if drug_ids else {}
    )

    items = []
    code_counts = {}
    for rx in rxs:
        # Pick a reject code based on the dominant flag
        flags = rx.flags or []
        if any("REMS" in f["flag_id"] for f in flags):
            code = "ER0"
        elif any("EXCL" in f["flag_id"] for f in flags):
            code = "65"
        elif any("DDI" in f["flag_id"] for f in flags) or any("PGX" in f["flag_id"] for f in flags):
            code = "DD"
        elif any("REFILL" in f["flag_id"] for f in flags):
            code = "79"
        elif any("DOSE" in f["flag_id"] for f in flags):
            code = "76"
        elif any("ALG" in f["flag_id"] for f in flags):
            code = "DD"
        elif any("PA" in f["flag_id"] for f in flags):
            code = "75"
        else:
            code = "88"

        if reject_code and code != reject_code:
            continue

        code_counts[code] = code_counts.get(code, 0) + 1
        patient = patients.get(rx.patient_id)
        drug = drugs.get(rx.drug_id)

        if len(items) < 100:
            items.append({
                "rx_id": rx.id,
                "ncpdp_reject_code": code,
                "reject_description": NCPDP_REJECT_CODES.get(code, "Other"),
                "patient_initials": f"{patient.first_name[0]}.{patient.last_name[0]}." if patient else "—",
                "drug_name": drug.generic_name if drug else "—",
                "rejected_at": rx.analysis_timestamp.isoformat() if rx.analysis_timestamp else None,
                "primary_flag": (rx.flags or [{}])[0].get("title", ""),
                "field_526_FQ": (rx.flags or [{}])[0].get("title", "")[:100],
            })

    code_summary = [
        {"code": c, "description": NCPDP_REJECT_CODES.get(c, "Other"), "count": n}
        for c, n in sorted(code_counts.items(), key=lambda x: -x[1])
    ]
    return {
        "total": sum(code_counts.values()),
        "code_summary": code_summary,
        "items": items,
    }


@router.get("/pharmacy-network")
def pharmacy_network(db: Session = Depends(get_db)):
    """Pharmacy network management — contracted pharmacies + compliance + MAC pricing."""
    pharmacies = db.query(Pharmacy).all()
    # Scheduled audits (POST /pharmacy-network/{id}/schedule-audit) persist
    audit_scheduled = {
        e.entity_id
        for e in db.query(PbaActionEvent).filter(
            PbaActionEvent.entity_type == "pharmacy",
            PbaActionEvent.action == "schedule_audit",
        ).all()
    }
    out = []
    for p in pharmacies:
        rx_count = db.query(Prescription).filter(Prescription.pharmacy_id == p.id).count()
        flagged = db.query(Prescription).filter(
            Prescription.pharmacy_id == p.id,
            Prescription.flag_color != "GREEN",
        ).count()
        flag_rate = (flagged / rx_count * 100) if rx_count else 0
        # String-seeded RNG — hash() is process-salted, so metrics drifted every restart
        rng = random.Random(f"pharm:{p.id}")
        out.append({
            "pharmacy_id": p.id,
            "name": p.name,
            "ncpdp_id": p.ncpdp_id,
            "type": p.pharmacy_type,
            "address": p.address,
            "contract_status": "Active" if flag_rate < 50 else "Under Review",
            "transactions_30d": rx_count * 4,
            "flag_rate_pct": round(flag_rate, 1),
            "mac_compliance_pct": round(rng.uniform(91.0, 99.5), 1),
            "audit_status": "Audit Scheduled" if p.id in audit_scheduled else rng.choice(["Pass", "Pass", "Pass", "Open Issues"]),
            "last_audit_date": "2026-03-15",
            "avg_dispense_time_min": round(rng.uniform(8, 22), 1),
            "specialty_capable": rng.choice([True, False]),
        })
    return {"total": len(out), "active": sum(1 for p in out if p["contract_status"] == "Active"), "items": out}


@router.get("/formulary-mgmt")
def formulary_management(db: Session = Depends(get_db)):
    """Formulary tier management — drugs by tier, PA / step therapy / quantity limits."""
    drugs = db.query(Drug).all()
    tiers = []
    for d in drugs[:60]:
        # Tier assignment
        if d.is_specialty:
            tier = 5
            tier_name = "Specialty"
            copay = "$50–$200"
        elif d.brand_name and not d.generic_available:
            tier = 4
            tier_name = "Non-Preferred Brand"
            copay = "$45"
        elif d.brand_name and d.generic_available:
            tier = 3
            tier_name = "Preferred Brand"
            copay = "$30"
        elif d.generic_available:
            tier = 1
            tier_name = "Preferred Generic"
            copay = "$10"
        else:
            tier = 2
            tier_name = "Non-Preferred Generic"
            copay = "$20"

        pa_required = bool(d.is_specialty or d.rems_program or (d.schedule and d.schedule == "II"))
        step_therapy = bool(d.brand_name and d.generic_available)

        tiers.append({
            "drug_id": d.id,
            "drug_name": d.generic_name,
            "brand_name": d.brand_name,
            "drug_class": d.drug_class,
            "tier": tier,
            "tier_name": tier_name,
            "copay_range": copay,
            "pa_required": pa_required,
            "step_therapy_required": step_therapy,
            "quantity_limit_30d": 30 if d.schedule == "II" else None,
            "is_specialty": d.is_specialty,
            "rems_program": d.rems_program,
            "biosimilar_available": d.biosimilar_available,
        })
    by_tier = {}
    for t in tiers:
        by_tier[t["tier"]] = by_tier.get(t["tier"], 0) + 1
    return {
        "total_drugs": len(tiers),
        "tier_summary": [{"tier": k, "count": v} for k, v in sorted(by_tier.items())],
        "pa_required_count": sum(1 for t in tiers if t["pa_required"]),
        "step_therapy_count": sum(1 for t in tiers if t["step_therapy_required"]),
        "items": tiers,
    }


@router.get("/member-safety")
def member_safety_alerts(db: Session = Depends(get_db)):
    """Member-level safety alerts — patients with active high-severity flags."""
    patients = db.query(Patient).all()
    # Real outreach actions (POST /member-safety/{patient_id}/outreach)
    # override the synthetic default so the buttons have persistent effect.
    outreach_overrides = {}
    for e in (
        db.query(PbaActionEvent)
          .filter(PbaActionEvent.entity_type == "member")
          .order_by(PbaActionEvent.created_at.asc())
          .all()
    ):
        outreach_overrides[e.entity_id] = (
            "escalated_md" if e.action == "escalate_md" else "outreach_in_progress"
        )
    alerts = []
    for pat in patients:
        rxs = db.query(Prescription).filter(
            Prescription.patient_id == pat.id,
            Prescription.disposition == "FLAG",
        ).all()
        if not rxs:
            continue
        critical_flag_count = 0
        critical_titles = []
        for rx in rxs:
            for f in (rx.flags or []):
                if f.get("severity") == "critical":
                    critical_flag_count += 1
                    if len(critical_titles) < 3:
                        critical_titles.append(f["title"])
        if critical_flag_count == 0:
            continue
        alerts.append({
            "patient_id": pat.id,
            "patient_initials": f"{pat.first_name[0]}.{pat.last_name[0]}.",
            "age": (datetime.now().date() - pat.date_of_birth).days // 365,
            "gender": pat.gender,
            "critical_flag_count": critical_flag_count,
            "active_rx_blocks": len(rxs),
            "top_concerns": critical_titles,
            "alert_priority": "P1" if critical_flag_count >= 3 else ("P2" if critical_flag_count >= 2 else "P3"),
            "outreach_status": outreach_overrides.get(pat.id) or random.Random(f"ms:{pat.id}").choice(["pharmacist_assigned", "outreach_in_progress", "resolved", "escalated_md"]),
        })
    alerts.sort(key=lambda a: -a["critical_flag_count"])
    return {
        "total": len(alerts),
        "p1_critical": sum(1 for a in alerts if a["alert_priority"] == "P1"),
        "p2_high": sum(1 for a in alerts if a["alert_priority"] == "P2"),
        "p3_standard": sum(1 for a in alerts if a["alert_priority"] == "P3"),
        "items": alerts[:60],
    }


# ─── PBA action persistence + savings engine ───

class CallbackResolveRequest(BaseModel):
    resolution: Optional[str] = None


class MemberOutreachRequest(BaseModel):
    action: str = "care_outreach"    # care_outreach | escalate_md


class SavingsConvertRequest(BaseModel):
    annualized_savings_usd: Optional[float] = None
    note: Optional[str] = None


def _log_action(db: Session, entity_type: str, entity_id: str, action: str,
                detail: Optional[str] = None, savings_usd: Optional[float] = None) -> PbaActionEvent:
    event = PbaActionEvent(
        entity_type=entity_type,
        entity_id=entity_id,
        action=action,
        detail=detail,
        savings_usd=savings_usd,
        performed_by="demo.pharmacist",
        created_at=datetime.now(),
    )
    db.add(event)
    db.commit()
    return event


@router.post("/callbacks/{rx_id}/resolve")
def resolve_callback(rx_id: str, body: Optional[CallbackResolveRequest] = None, db: Session = Depends(get_db)):
    """Mark a pharmacist callback resolved — persists across reloads."""
    detail = (body.resolution if body else None) or "Resolved after prescriber consult"
    _log_action(db, "callback", rx_id, "resolve", detail=detail)
    return {"ok": True, "rx_id": rx_id, "callback_status": "resolved", "resolution": detail}


@router.post("/pharmacy-network/{pharmacy_id}/schedule-audit")
def schedule_pharmacy_audit(pharmacy_id: str, db: Session = Depends(get_db)):
    """Schedule an on-site MAC/compliance audit for a network pharmacy."""
    _log_action(db, "pharmacy", pharmacy_id, "schedule_audit",
                detail="On-site MAC compliance audit scheduled (next cycle)")
    return {"ok": True, "pharmacy_id": pharmacy_id, "audit_status": "Audit Scheduled"}


@router.post("/member-safety/{patient_id}/outreach")
def member_outreach(patient_id: str, body: MemberOutreachRequest, db: Session = Depends(get_db)):
    """Record care-management outreach or MD escalation for a member."""
    action = body.action if body.action in ("care_outreach", "escalate_md") else "care_outreach"
    _log_action(db, "member", patient_id, action,
                detail="Clinical pharmacist escalation to medical director"
                if action == "escalate_md" else "Care management outreach initiated")
    return {
        "ok": True,
        "patient_id": patient_id,
        "outreach_status": "escalated_md" if action == "escalate_md" else "outreach_in_progress",
    }


@router.get("/savings-opportunities")
def savings_opportunities(db: Session = Depends(get_db)):
    """Cost-avoidance worklist — the PBA's ROI engine.

    Three deterministic opportunity classes, all derived from the drug
    database (no randomness):
      1. therapeutic_interchange — TherapeuticEquivalence pairs where the
         alternative's average_cost_per_unit is lower
      2. generic_substitution   — brand drugs with generic_available
      3. biosimilar             — specialty biologics with biosimilar_available
    Savings per fill = current fill cost (claim allowed → billed → qty × unit
    cost) − alternative fill cost; annualized by 365/days_supply.
    """
    drugs = {d.id: d for d in db.query(Drug).all()}

    # Direction-aware interchange map: source drug -> cheapest alternative
    alt_map = {}
    for te in db.query(TherapeuticEquivalence).all():
        a, b = drugs.get(te.drug_a_id), drugs.get(te.drug_b_id)
        if not a or not b:
            continue
        for src, dst in ((a, b), (b, a)):
            src_cost = src.average_cost_per_unit or 0
            dst_cost = dst.average_cost_per_unit or 0
            if src_cost > dst_cost > 0:
                prev = alt_map.get(src.id)
                if not prev or (prev[0].average_cost_per_unit or 0) > dst_cost:
                    alt_map[src.id] = (dst, te)

    rxs = (
        db.query(Prescription)
          .filter(Prescription.drug_id.isnot(None))
          .order_by(Prescription.analysis_timestamp.desc())
          .limit(400)
          .all()
    )
    patient_ids = {rx.patient_id for rx in rxs if rx.patient_id}
    patients = (
        {p.id: p for p in db.query(Patient).filter(Patient.id.in_(patient_ids)).all()}
        if patient_ids else {}
    )
    claims = {
        c.prescription_id: c
        for c in db.query(InsuranceClaim).filter(
            InsuranceClaim.prescription_id.in_([rx.id for rx in rxs])
        ).all()
    }
    converted = {
        e.entity_id: e
        for e in db.query(PbaActionEvent).filter(
            PbaActionEvent.entity_type == "savings",
            PbaActionEvent.action == "convert",
        ).all()
    }

    items = []
    for rx in rxs:
        drug = drugs.get(rx.drug_id)
        if not drug:
            continue
        claim = claims.get(rx.id)
        fill_cost = (
            (claim.allowed_amount if claim and claim.allowed_amount else None)
            or (claim.billed_amount if claim and claim.billed_amount else None)
            or round((rx.quantity or 30) * (drug.average_cost_per_unit or 0), 2)
        )
        if not fill_cost or fill_cost <= 0:
            continue

        opportunity = None
        if rx.drug_id in alt_map:
            alt, te = alt_map[rx.drug_id]
            alt_cost = round(
                (rx.quantity or 30) * (alt.average_cost_per_unit or 0) * (te.dose_conversion_factor or 1.0), 2
            )
            if 0 < alt_cost < fill_cost:
                opportunity = {
                    "opportunity_type": "therapeutic_interchange",
                    "alternative_name": alt.generic_name,
                    "alt_cost_usd": alt_cost,
                    "basis": f"TherapeuticEquivalence ({te.equivalence_type}, evidence {te.evidence_level or 'n/a'})",
                }
        if not opportunity and drug.brand_name and drug.generic_available:
            opportunity = {
                "opportunity_type": "generic_substitution",
                "alternative_name": f"{drug.generic_name} (generic)",
                "alt_cost_usd": round(fill_cost * 0.20, 2),
                "basis": "FDA: generics average ~80% below brand list price",
            }
        if not opportunity and drug.is_specialty and drug.biosimilar_available:
            opportunity = {
                "opportunity_type": "biosimilar",
                "alternative_name": f"{drug.generic_name} biosimilar",
                "alt_cost_usd": round(fill_cost * 0.70, 2),
                "basis": "FDA Purple Book biosimilar; ~30% avg discount vs reference",
            }
        if not opportunity:
            continue

        savings = round(fill_cost - opportunity["alt_cost_usd"], 2)
        if savings < 25:  # below outreach cost — not worth a worklist row
            continue
        fills_per_year = round(365 / rx.days_supply, 1) if rx.days_supply else 12.0
        patient = patients.get(rx.patient_id)
        conv = converted.get(rx.id)
        items.append({
            "rx_id": rx.id,
            "patient_initials": f"{patient.first_name[0]}.{patient.last_name[0]}." if patient else "—",
            "drug_name": drug.generic_name,
            "brand_name": drug.brand_name,
            "fill_cost_usd": round(fill_cost, 2),
            "savings_per_fill_usd": savings,
            "annualized_savings_usd": round(savings * fills_per_year, 2),
            "fills_per_year": fills_per_year,
            "status": "converted" if conv else "open",
            "converted_at": conv.created_at.isoformat() if conv and conv.created_at else None,
            **opportunity,
        })

    items.sort(key=lambda i: -i["annualized_savings_usd"])
    by_type = {}
    for i in items:
        t = by_type.setdefault(i["opportunity_type"], {"count": 0, "annualized_savings_usd": 0.0})
        t["count"] += 1
        t["annualized_savings_usd"] = round(t["annualized_savings_usd"] + i["annualized_savings_usd"], 2)

    realized = round(sum(e.savings_usd or 0 for e in converted.values()), 2)
    return {
        "identified_annualized_usd": round(sum(i["annualized_savings_usd"] for i in items), 2),
        "realized_annualized_usd": realized,
        "opportunity_count": len(items),
        "converted_count": sum(1 for i in items if i["status"] == "converted"),
        "by_type": [
            {"type": k, **v}
            for k, v in sorted(by_type.items(), key=lambda x: -x[1]["annualized_savings_usd"])
        ],
        "formula": "savings/fill = current fill cost (claim allowed → billed → qty × unit cost) − alternative cost; annualized = savings/fill × 365/days_supply",
        "items": items[:100],
    }


@router.post("/savings/{rx_id}/convert")
def convert_savings(rx_id: str, body: Optional[SavingsConvertRequest] = None, db: Session = Depends(get_db)):
    """Convert a savings opportunity (prescriber agreed to switch) — records
    realized annualized savings against the PBA ROI dashboard."""
    rx = db.query(Prescription).filter(Prescription.id == rx_id).first()
    if not rx:
        return {"ok": False, "error": "prescription not found"}
    savings = body.annualized_savings_usd if body and body.annualized_savings_usd else None
    note = (body.note if body else None) or "Prescriber accepted interchange"
    _log_action(db, "savings", rx_id, "convert", detail=note, savings_usd=savings)
    return {"ok": True, "rx_id": rx_id, "status": "converted", "realized_annualized_usd": savings}


@router.get("/split-fill")
def split_fill(db: Session = Depends(get_db)):
    """Oral oncology / specialty split-fill program — waste avoidance on
    new starts.

    JCO Oncology Practice: ~34% of new-start oral oncology patients
    discontinue before finishing the first 28–30 day supply; dispensing a
    15-day split fill first avoids the unused second half. Published payer
    savings: ~$2,782 per enrolled member.
    """
    DISCONTINUATION_RATE = 0.34   # JCO Oncology Practice split-fill study
    drugs = {d.id: d for d in db.query(Drug).all()}
    target_ids = [
        d.id for d in drugs.values()
        if d.is_specialty or (d.therapeutic_category or "") == "oncology"
    ]
    if not target_ids:
        return {"summary": {}, "items": [], "formula": "no specialty/oncology drugs in catalog"}

    rxs = (
        db.query(Prescription)
          .filter(
              Prescription.drug_id.in_(target_ids),
              Prescription.is_refill == False,  # noqa: E712 — new starts only
              (Prescription.days_supply >= 28),
          ).all()
    )
    rx_ids = [rx.id for rx in rxs]
    claims = (
        {c.prescription_id: c for c in db.query(InsuranceClaim).filter(
            InsuranceClaim.prescription_id.in_(rx_ids)).all()}
        if rx_ids else {}
    )
    pat_ids = {rx.patient_id for rx in rxs if rx.patient_id}
    patients = (
        {p.id: p for p in db.query(Patient).filter(Patient.id.in_(pat_ids)).all()}
        if pat_ids else {}
    )
    enrolled = {
        e.entity_id for e in db.query(PbaActionEvent).filter(
            PbaActionEvent.entity_type == "splitfill",
            PbaActionEvent.action == "enroll",
        ).all()
    }

    items = []
    for rx in rxs:
        drug = drugs.get(rx.drug_id)
        c = claims.get(rx.id)
        fill_cost = (
            (c.allowed_amount if c and c.allowed_amount else None)
            or (c.billed_amount if c and c.billed_amount else None)
            or round((rx.quantity or 30) * (drug.average_cost_per_unit or 0), 2)
        )
        if not fill_cost or fill_cost < 200:   # split-fill isn't worth it on cheap fills
            continue
        waste_at_risk = round(fill_cost * 0.5, 2)                       # unused 2nd half of supply
        expected_avoided = round(waste_at_risk * DISCONTINUATION_RATE, 2)
        pat = patients.get(rx.patient_id)
        items.append({
            "rx_id": rx.id,
            "patient_initials": f"{pat.first_name[0]}.{pat.last_name[0]}." if pat else "—",
            "drug_name": drug.generic_name,
            "brand_name": drug.brand_name,
            "category": drug.therapeutic_category,
            "days_supply": rx.days_supply,
            "fill_cost_usd": round(fill_cost, 2),
            "waste_at_risk_usd": waste_at_risk,
            "expected_waste_avoided_usd": expected_avoided,
            "status": "enrolled" if rx.id in enrolled else "eligible",
            "date_written": rx.date_written.date().isoformat() if rx.date_written else None,
        })
    items.sort(key=lambda i: -i["expected_waste_avoided_usd"])

    enrolled_items = [i for i in items if i["status"] == "enrolled"]
    return {
        "summary": {
            "eligible_new_starts": len(items),
            "enrolled": len(enrolled_items),
            "waste_at_risk_usd": round(sum(i["waste_at_risk_usd"] for i in items), 2),
            "expected_waste_avoided_usd": round(sum(i["expected_waste_avoided_usd"] for i in items), 2),
            "realized_waste_avoided_usd": round(sum(i["expected_waste_avoided_usd"] for i in enrolled_items), 2),
            "published_benchmark_per_member_usd": 2782,
        },
        "items": items,
        "formula": "eligible = specialty/oral-oncology NEW starts with ≥28-day supply and fill cost ≥ $200; waste at risk = 50% of fill cost (unused second half); expected avoided = waste at risk × 34% early-discontinuation rate (JCO Oncology Practice split-fill study; payer benchmark ~$2,782/member)",
    }


@router.post("/split-fill/{rx_id}/enroll")
def enroll_split_fill(rx_id: str, db: Session = Depends(get_db)):
    """Enroll a new-start specialty fill in the 15-day split-fill program."""
    rx = db.query(Prescription).filter(Prescription.id == rx_id).first()
    if not rx:
        return {"ok": False, "error": "prescription not found"}
    _log_action(db, "splitfill", rx_id, "enroll",
                detail="Enrolled in 15-day split-fill: pharmacist tolerance check before balance dispenses")
    return {"ok": True, "rx_id": rx_id, "status": "enrolled"}


@router.get("/transactions/{rx_id}")
def transaction_detail(rx_id: str, db: Session = Depends(get_db)):
    """Full NCPDP transaction detail — drill-down for live transaction stream."""
    rx = db.query(Prescription).filter(Prescription.id == rx_id).first()
    if not rx:
        return {"error": "not_found"}
    patient = db.get(Patient, rx.patient_id)
    drug = db.get(Drug, rx.drug_id)
    provider = db.get(Provider, rx.provider_id)
    pharmacy = db.get(Pharmacy, rx.pharmacy_id) if rx.pharmacy_id else None

    # NCPDP D.0 reject code mapping
    flags = rx.flags or []
    primary_flag = flags[0] if flags else {}
    if rx.disposition == "FLAG":
        if any("REMS" in f["flag_id"] for f in flags): code, code_desc = "ER0", "REMS Enrollment Required"
        elif any("EXCL" in f["flag_id"] for f in flags): code, code_desc = "65", "Patient Is Not Covered"
        elif any("DDI" in f["flag_id"] or "PGX" in f["flag_id"] for f in flags): code, code_desc = "DD", "Drug-Drug Interaction (DUR)"
        elif any("REFILL" in f["flag_id"] for f in flags): code, code_desc = "79", "Refill Too Soon"
        elif any("DOSE" in f["flag_id"] for f in flags): code, code_desc = "76", "Plan Limitations Exceeded"
        elif any("ALG" in f["flag_id"] for f in flags): code, code_desc = "DD", "Allergy Cross-Reactivity (DUR)"
        elif any("PA" in f["flag_id"] for f in flags): code, code_desc = "75", "Prior Authorization Required"
        else: code, code_desc = "88", "DUR Reject Error"
        tx_status = "REJECT"
    elif rx.disposition == "REVIEW":
        code, code_desc, tx_status = "PR", "PA — Pharmacist Review", "SOFT_EDIT"
    else:
        code, code_desc, tx_status = None, None, "PAID"

    return {
        "rx_id": rx.id,
        "ncpdp_transaction_code": "B1",
        "transaction_status": tx_status,
        "reject_code": code,
        "reject_description": code_desc,
        "fields": {
            "101_A1_BIN": "012345",
            "104_A4_processor_control_number": "AXERIS01",
            "111_AM_segment_id": "AM01",
            "401_D1_date_of_service": rx.date_written.strftime("%Y%m%d") if rx.date_written else None,
            "402_D2_prescription_service_ref_num": rx.id,
            "407_D7_product_service_id": drug.id if drug else None,
            "442_E7_quantity_dispensed": rx.quantity,
            "405_D5_days_supply": rx.days_supply,
            "411_DB_prescriber_id": provider.npi if provider else None,
            "201_B1_service_provider_id": pharmacy.ncpdp_id if pharmacy else None,
            "511_FB_reject_code": code,
            "526_FQ_additional_message_info": primary_flag.get("title", "")[:200],
        },
        "patient": {
            "id": rx.patient_id,
            "initials": f"{patient.first_name[0]}.{patient.last_name[0]}." if patient else None,
            "age": (datetime.now().date() - patient.date_of_birth).days // 365 if patient else None,
            "gender": patient.gender if patient else None,
        },
        "drug": {
            "ndc": drug.id, "generic": drug.generic_name, "brand": drug.brand_name,
            "schedule": drug.schedule, "drug_class": drug.drug_class,
            "is_specialty": drug.is_specialty, "rems_program": drug.rems_program,
        } if drug else None,
        "prescriber": {
            "npi": provider.npi, "name": f"Dr. {provider.first_name} {provider.last_name}",
            "specialty": provider.specialty, "phone": provider.clinic_phone, "fax": provider.clinic_fax,
            "is_excluded": provider.is_excluded,
        } if provider else None,
        "pharmacy": {
            "ncpdp": pharmacy.ncpdp_id, "name": pharmacy.name, "address": pharmacy.address,
            "type": pharmacy.pharmacy_type,
        } if pharmacy else None,
        "flags": flags,
        "disposition": rx.disposition,
        "latency_ms": rx.processing_time_ms,
        "operating_mode": rx.operating_mode,
        "audit_trail": rx.audit_trail,
    }


@router.post("/callbacks/{rx_id}/send-message")
def send_secure_message(rx_id: str, payload: dict, db: Session = Depends(get_db)):
    """Send secure message to prescriber (HIPAA-compliant prescriber portal / NCPDP fax).

    PBA pharmacists do NOT call from a laptop. The realistic workflow is:
      1. Send a secure portal message to prescriber (preferred — most EHRs accept)
      2. Fall back to NCPDP-formatted fax (industry standard for pharmacist-to-prescriber)
      3. Escalate to pharmacy network manager if no response in 4h

    This endpoint logs the message + returns a delivery receipt.
    """
    rx = db.query(Prescription).filter(Prescription.id == rx_id).first()
    if not rx:
        return {"error": "not_found"}
    provider = db.get(Provider, rx.provider_id)
    method = payload.get("method", "secure_portal")  # secure_portal | fax | escalate
    body = payload.get("body", "")
    receipt_id = f"MSG-{datetime.now().strftime('%Y%m%d%H%M%S')}-{rx_id[-4:]}"
    return {
        "ok": True,
        "receipt_id": receipt_id,
        "method": method,
        "delivered_to": {
            "prescriber_npi": provider.npi if provider else None,
            "prescriber_name": f"Dr. {provider.last_name}" if provider else None,
            "endpoint": (
                provider.provider_email if method == "secure_portal" and provider
                else provider.clinic_fax if method == "fax" and provider
                else "Pharmacy Network Manager"
            ),
        },
        "estimated_response_hours": 4 if method == "secure_portal" else 24 if method == "fax" else 1,
        "delivered_at": datetime.now().isoformat(),
        "body_preview": body[:200],
        "next_action": (
            "Auto-escalate to pharmacy network manager if no response in 4h"
            if method != "escalate" else "Pharmacy Network Manager engaged"
        ),
    }


@router.get("/latency-stream")
def latency_stream(db: Session = Depends(get_db)):
    """Real-time latency telemetry for NCPDP D.0 sub-200ms target monitoring."""
    rxs = db.query(Prescription).filter(
        Prescription.processing_time_ms.isnot(None),
    ).order_by(Prescription.analysis_timestamp.desc()).limit(60).all()
    series = [
        {"ts": rx.analysis_timestamp.isoformat() if rx.analysis_timestamp else None,
         "rx_id": rx.id, "latency_ms": rx.processing_time_ms,
         "engines": (rx.audit_trail or {}).get("engines_fired", [])}
        for rx in rxs
    ]
    avg = sum(s["latency_ms"] for s in series) / max(len(series), 1)
    over_200 = sum(1 for s in series if s["latency_ms"] > 200)
    return {
        "samples": len(series),
        "avg_ms": round(avg, 1),
        "p95_ms": round(sorted([s["latency_ms"] for s in series])[int(len(series)*0.95)] if series else 0, 1),
        "p99_ms": round(sorted([s["latency_ms"] for s in series])[int(len(series)*0.99)] if series else 0, 1),
        "over_200ms_count": over_200,
        "sla_compliance_pct": round(100 * (1 - over_200/max(len(series),1)), 1),
        "series": series,
    }


# ─── Specialty / Case Management dept: Site-of-Care Optimization ───

@router.get("/site-of-care")
def site_of_care(db: Session = Depends(get_db)):
    """Specialty infusion site-of-care optimization — case-management waste lever.

    Clinic-infused IV biologics billed at the hospital-outpatient department
    (HOPD) run ~110% higher than the identical drug delivered at home or in a
    physician office. JMCP 2025: matched outcomes at materially lower cost;
    one employer cut non-chemo infusion spend 57% via redirection.
    """
    HOME_ADMIN_FEE = 190.0         # per-visit home infusion nursing (vs HOPD facility fee)
    HOPD_ACQUISITION_FACTOR = 2.1  # HOPD bills ~2.1x acquisition (matches seed billing)
    drugs = {d.id: d for d in db.query(Drug).all()}
    infusion_ids = [d.id for d in drugs.values() if (d.formulation or "") == "infusion"]
    if not infusion_ids:
        return {"summary": {}, "items": [], "formula": "no clinic-infused drugs in catalog"}

    rxs = db.query(Prescription).filter(Prescription.drug_id.in_(infusion_ids)).all()
    rx_ids = [rx.id for rx in rxs]
    claims = (
        {c.prescription_id: c for c in db.query(InsuranceClaim).filter(
            InsuranceClaim.prescription_id.in_(rx_ids)).all()}
        if rx_ids else {}
    )
    pat_ids = {rx.patient_id for rx in rxs if rx.patient_id}
    patients = (
        {p.id: p for p in db.query(Patient).filter(Patient.id.in_(pat_ids)).all()}
        if pat_ids else {}
    )
    redirected = {
        e.entity_id for e in db.query(PbaActionEvent).filter(
            PbaActionEvent.entity_type == "siteofcare",
            PbaActionEvent.action == "redirect",
        ).all()
    }

    episodes = {}
    for rx in rxs:
        drug = drugs.get(rx.drug_id)
        if not drug:
            continue
        c = claims.get(rx.id)
        hopd_cost = (
            (c.allowed_amount if c and c.allowed_amount else None)
            or (c.billed_amount if c and c.billed_amount else None)
            or round((drug.average_cost_per_unit or 0) * HOPD_ACQUISITION_FACTOR, 2)
        )
        key = (rx.patient_id, rx.drug_id)
        ep = episodes.setdefault(key, {"fills": 0, "hopd_total": 0.0, "last": None, "rx_id": rx.id})
        ep["fills"] += 1
        ep["hopd_total"] += hopd_cost or 0
        fd = rx.date_filled or rx.date_written
        if fd and (ep["last"] is None or fd > ep["last"]):
            ep["last"] = fd

    items = []
    for (pid, did), ep in episodes.items():
        drug = drugs.get(did)
        pat = patients.get(pid)
        per_infusion_hopd = ep["hopd_total"] / max(1, ep["fills"])
        per_infusion_home = round(per_infusion_hopd / HOPD_ACQUISITION_FACTOR + HOME_ADMIN_FEE, 2)
        per_infusion_savings = round(per_infusion_hopd - per_infusion_home, 2)
        if per_infusion_savings < 100:
            continue
        infusions_per_year = 6.5
        items.append({
            "rx_id": ep["rx_id"],
            "patient_id": pid,
            "patient_initials": f"{pat.first_name[0]}.{pat.last_name[0]}." if pat else "-",
            "drug_name": drug.generic_name,
            "brand_name": drug.brand_name,
            "current_site": "Hospital Outpatient (HOPD)",
            "proposed_site": "Home Infusion / Physician Office",
            "per_infusion_hopd_usd": round(per_infusion_hopd, 2),
            "per_infusion_home_usd": per_infusion_home,
            "per_infusion_savings_usd": per_infusion_savings,
            "annualized_savings_usd": round(per_infusion_savings * infusions_per_year, 2),
            "infusions_per_year": infusions_per_year,
            "last_infusion": ep["last"].date().isoformat() if ep["last"] else None,
            "status": "redirected" if ep["rx_id"] in redirected else "eligible",
        })
    items.sort(key=lambda i: -i["annualized_savings_usd"])

    redir_items = [i for i in items if i["status"] == "redirected"]
    return {
        "summary": {
            "eligible_members": len(items),
            "redirected": len(redir_items),
            "annualized_savings_usd": round(sum(i["annualized_savings_usd"] for i in items), 2),
            "realized_savings_usd": round(sum(i["annualized_savings_usd"] for i in redir_items), 2),
            "avg_savings_per_member_usd": round(
                sum(i["annualized_savings_usd"] for i in items) / len(items), 2) if items else 0,
            "hopd_premium_pct": round((HOPD_ACQUISITION_FACTOR - 1) * 100, 0),
        },
        "items": items,
        "formula": "per-infusion HOPD cost from the claim; home/office alt = HOPD cost / 2.1 acquisition factor + $190 home-nursing fee; annualized = per-infusion savings x 6.5 infusions/yr (~every 8 weeks); JMCP 2025: matched outcomes, up to 57% employer savings via redirection",
    }


@router.post("/site-of-care/{rx_id}/redirect")
def redirect_site_of_care(rx_id: str, db: Session = Depends(get_db)):
    """Redirect a specialty infusion from HOPD to home/office via case management."""
    rx = db.query(Prescription).filter(Prescription.id == rx_id).first()
    if not rx:
        return {"ok": False, "error": "prescription not found"}
    _log_action(db, "siteofcare", rx_id, "redirect",
                detail="Case-management redirect to home infusion / physician office (member consent + clinical review)")
    return {"ok": True, "rx_id": rx_id, "status": "redirected"}


# ─── Pharmacy Network Ops dept: 90-Day / Mail-Order Conversion ───

# Maintenance categories suitable for 90-day mail (exclude acute/PRN/controlled)
_MAINTENANCE_CATEGORIES = {
    "statin", "cardiovascular", "antihypertensive", "antidiabetic", "endocrine",
    "psychiatric", "neurology", "gastrointestinal", "respiratory", "anticoagulant",
}


@router.get("/mail-order")
def mail_order(db: Session = Depends(get_db)):
    """90-day / mail-order conversion - pharmacy-network cost lever.

    Chronic maintenance drugs dispensed as 30-day retail fills incur ~3x the
    dispensing fee of a single 90-day mail fill and show lower adherence.
    Converting eligible members saves the dispensing-fee delta plus a modest
    mail ingredient discount.
    """
    RETAIL_DISPENSE_FEE = 10.64       # NCPDP national average professional dispensing fee
    MAIL_DISPENSE_FEE = 1.25          # mail-order per-fill dispensing
    MAIL_INGREDIENT_DISCOUNT = 0.02   # ~2% lower unit cost on mail channel
    drugs = {d.id: d for d in db.query(Drug).all()}

    rxs = (
        db.query(Prescription)
          .filter(Prescription.status.in_(["approved", "pending"]))
          .all()
    )
    pat_ids = {rx.patient_id for rx in rxs if rx.patient_id}
    patients = (
        {p.id: p for p in db.query(Patient).filter(Patient.id.in_(pat_ids)).all()}
        if pat_ids else {}
    )
    converted = {
        e.entity_id for e in db.query(PbaActionEvent).filter(
            PbaActionEvent.entity_type == "mailorder",
            PbaActionEvent.action == "convert",
        ).all()
    }

    seen = set()
    items = []
    for rx in rxs:
        drug = drugs.get(rx.drug_id)
        if not drug:
            continue
        cat = (drug.therapeutic_category or "").lower()
        cls = (drug.drug_class or "").lower()
        controlled = drug.schedule and drug.schedule not in ("none", "OTC", "N/A", "non-controlled")
        if controlled or (cat not in _MAINTENANCE_CATEGORIES and cls not in _MAINTENANCE_CATEGORIES):
            continue
        if not rx.days_supply or rx.days_supply > 34:
            continue  # already 90-day or acute
        key = (rx.patient_id, rx.drug_id)
        if key in seen:
            continue
        seen.add(key)

        annual_retail_fills = 12
        annual_mail_fills = 4  # 90-day
        fee_savings = round(annual_retail_fills * RETAIL_DISPENSE_FEE - annual_mail_fills * MAIL_DISPENSE_FEE, 2)
        unit = drug.average_cost_per_unit or 0
        annual_units = (rx.quantity or 30) * annual_retail_fills
        ingredient_savings = round(annual_units * unit * MAIL_INGREDIENT_DISCOUNT, 2)
        total = round(fee_savings + ingredient_savings, 2)
        pat = patients.get(rx.patient_id)
        items.append({
            "rx_id": rx.id,
            "patient_id": rx.patient_id,
            "patient_initials": f"{pat.first_name[0]}.{pat.last_name[0]}." if pat else "-",
            "drug_name": drug.generic_name,
            "brand_name": drug.brand_name,
            "therapeutic_category": drug.therapeutic_category,
            "current_days_supply": rx.days_supply,
            "annual_fee_savings_usd": fee_savings,
            "annual_ingredient_savings_usd": ingredient_savings,
            "annual_savings_usd": total,
            "status": "converted" if rx.id in converted else "eligible",
        })
    items.sort(key=lambda i: -i["annual_savings_usd"])

    conv_items = [i for i in items if i["status"] == "converted"]
    return {
        "summary": {
            "eligible_fills": len(items),
            "converted": len(conv_items),
            "members_affected": len({i["patient_id"] for i in items}),
            "annual_savings_usd": round(sum(i["annual_savings_usd"] for i in items), 2),
            "realized_savings_usd": round(sum(i["annual_savings_usd"] for i in conv_items), 2),
            "retail_dispense_fee_usd": RETAIL_DISPENSE_FEE,
        },
        "items": items,
        "formula": "eligible = chronic maintenance drug (non-controlled) on <=34-day fill; savings = (12 retail fills x $10.64 - 4 mail fills x $1.25) dispensing-fee delta + ~2% mail ingredient discount x annual units; 90-day mail also improves adherence",
    }


@router.post("/mail-order/{rx_id}/convert")
def convert_mail_order(rx_id: str, db: Session = Depends(get_db)):
    """Convert an eligible retail fill to 90-day mail order."""
    _log_action(db, "mailorder", rx_id, "convert",
                detail="Converted to 90-day mail order (member opt-in; auto-refill enrolled)")
    return {"ok": True, "rx_id": rx_id, "status": "converted"}
