"""Audit trail API — returns full action history for prescriptions."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime

from database.database import get_db
from database.models import PrescriptionAction, Prescription, Patient, Drug, Provider

router = APIRouter(prefix="/audit", tags=["audit"])


@router.get("/")
def get_audit_trail(
    prescription_id: Optional[str] = None,
    provider_id: Optional[str] = None,
    patient_id: Optional[str] = None,
    action: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
):
    limit = max(1, min(limit, 500))
    """Get audit trail of all prescription actions (approve, deny, review, etc.)."""
    q = db.query(PrescriptionAction).order_by(PrescriptionAction.timestamp.desc())

    if prescription_id:
        q = q.filter(PrescriptionAction.prescription_id == prescription_id)
    if action:
        q = q.filter(PrescriptionAction.action == action)
    if provider_id or patient_id:
        rx_ids = db.query(Prescription.id)
        if provider_id:
            rx_ids = rx_ids.filter(Prescription.provider_id == provider_id)
        if patient_id:
            rx_ids = rx_ids.filter(Prescription.patient_id == patient_id)
        q = q.filter(PrescriptionAction.prescription_id.in_(rx_ids))

    total = q.count()
    actions = q.offset(skip).limit(limit).all()

    # Batch the related rows — was 4 round-trips per audit entry.
    rx_ids = {a.prescription_id for a in actions if a.prescription_id}
    rxs = (
        {r.id: r for r in db.query(Prescription).filter(Prescription.id.in_(rx_ids)).all()}
        if rx_ids else {}
    )
    patient_ids = {r.patient_id for r in rxs.values() if r.patient_id}
    drug_ids = {r.drug_id for r in rxs.values() if r.drug_id}
    provider_ids = {r.provider_id for r in rxs.values() if r.provider_id}
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

    results = []
    for act in actions:
        rx = rxs.get(act.prescription_id)
        patient = patients.get(rx.patient_id) if rx else None
        drug = drugs.get(rx.drug_id) if rx else None
        provider = providers.get(rx.provider_id) if rx else None

        results.append({
            "id": act.id,
            "prescription_id": act.prescription_id,
            "action": act.action,
            "reason": act.reason,
            "performed_by": act.performed_by,
            "timestamp": act.timestamp.isoformat() if act.timestamp else None,
            "patient_name": f"{patient.first_name} {patient.last_name}" if patient else "",
            "drug_name": drug.generic_name if drug else "",
            "provider_name": f"Dr. {provider.last_name}" if provider else "",
            "flag_color": rx.flag_color if rx else None,
            "risk_score": rx.risk_score if rx else None,
        })

    return {
        "total": total,
        "items": results,
    }


@router.get("/stats")
def get_audit_stats(db: Session = Depends(get_db)):
    """Get aggregate audit statistics."""
    total_actions = db.query(PrescriptionAction).count()
    approved = db.query(PrescriptionAction).filter(PrescriptionAction.action == "approve").count()
    denied = db.query(PrescriptionAction).filter(PrescriptionAction.action == "deny").count()
    reviews = db.query(PrescriptionAction).filter(PrescriptionAction.action == "request_review").count()
    sent = db.query(PrescriptionAction).filter(PrescriptionAction.action == "send_to_prescriber").count()

    return {
        "total_actions": total_actions,
        "approved": approved,
        "denied": denied,
        "reviews_requested": reviews,
        "sent_to_prescriber": sent,
        "approval_rate": round(approved / max(total_actions, 1) * 100, 1),
        "denial_rate": round(denied / max(total_actions, 1) * 100, 1),
    }
