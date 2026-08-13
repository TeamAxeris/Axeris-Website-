from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional, List
from datetime import datetime, timedelta
import asyncio

from database.database import get_db
from database.models import (
    Prescription, Patient, Drug, Provider, PrescriptionAction,
    PGxResult, REMSEnrollment,
)
from schemas.prescription import (
    PrescriptionCreate, PrescriptionResponse, PrescriptionDetail,
    PrescriptionActionRequest, FlagSchema, PatientContext, PrescriberInfo,
    DiagnosisSchema, AllergySchema, LabResultSchema, ActiveMedicationSchema,
    PGxResultSchema, REMSEnrollmentSchema,
)
from engines import rules_engine, ml_engine, patient_engine
from engines.equivalence import find_alternatives
from config import (
    RED_SCORE_THRESHOLD, YELLOW_SCORE_THRESHOLD,
    COLOR_TO_DISPOSITION, SOFT_HOLD_SLA_HOURS, DEFAULT_OPERATING_MODE,
)

router = APIRouter(prefix="/prescriptions", tags=["prescriptions"])


def _analyze(rx: Prescription, patient: Patient, drug: Drug, db: Session):
    """Run all 3 engines and aggregate results (Axeris v8).

    Returns (flags, risk_score, flag_color, disposition, hold_type, sla_deadline, processing_time_ms, audit_trail).
    """
    import time
    start = time.time()
    all_flags = []
    all_flags.extend(rules_engine.evaluate(rx, patient, drug, db))
    all_flags.extend(ml_engine.evaluate(rx, patient, drug, db))
    all_flags.extend(patient_engine.evaluate(rx, patient, drug, db))
    processing_time_ms = int((time.time() - start) * 1000)

    # Calculate risk score
    if not all_flags:
        risk_score = 0.0
    else:
        total_weight = sum(f["weight"] for f in all_flags)
        risk_score = min(1.0, total_weight / 2.0)

    # Determine flag color
    if risk_score >= RED_SCORE_THRESHOLD:
        flag_color = "RED"
    elif risk_score >= YELLOW_SCORE_THRESHOLD:
        flag_color = "YELLOW"
    else:
        flag_color = "GREEN"

    # v8: APPROVE/REVIEW/FLAG disposition + hold logic
    disposition = COLOR_TO_DISPOSITION.get(flag_color, "REVIEW")
    if disposition == "APPROVE":
        hold_type = None
        sla_deadline = None
    elif disposition == "REVIEW":
        hold_type = "soft_hold"
        sla_deadline = datetime.now() + timedelta(hours=SOFT_HOLD_SLA_HOURS)
    else:  # FLAG
        hold_type = "hard_hold"
        sla_deadline = None  # No auto-release

    # v8: ERISA audit trail with engine-level evidence chain
    by_engine = {}
    for f in all_flags:
        eng = f.get("engine", "unknown")
        by_engine.setdefault(eng, []).append({
            "flag_id": f.get("flag_id"),
            "category": f.get("category"),
            "severity": f.get("severity"),
            "weight": f.get("weight"),
            "evidence_source": f.get("evidence_source"),
        })
    audit_trail = {
        "engines_fired": list(by_engine.keys()),
        "flags_by_engine": by_engine,
        "total_flags": len(all_flags),
        "risk_score": round(risk_score * 100),          # same 0-100 scale as the header
        "risk_score_raw": round(risk_score, 3),
        "disposition": disposition,
        "hold_type": hold_type,
        "processing_time_ms": processing_time_ms,
        "operating_mode": DEFAULT_OPERATING_MODE,
        "audit_timestamp": datetime.now().isoformat(),
        "erisa_section": "404(a)(1)(B) — fiduciary duty audit trail",
    }

    return all_flags, risk_score, flag_color, disposition, hold_type, sla_deadline, processing_time_ms, audit_trail


def _build_patient_context(patient: Patient, db: Session) -> PatientContext:
    diagnoses = [DiagnosisSchema(
        icd10_code=d.icd10_code, description=d.description, is_active=d.is_active
    ) for d in patient.diagnoses if d.is_active]

    allergies = [AllergySchema(
        allergen=a.allergen, reaction_type=a.reaction_type, severity=a.severity
    ) for a in patient.allergies]

    labs = sorted(patient.lab_results, key=lambda l: l.date_collected or datetime.min, reverse=True)[:10]
    recent_labs = [LabResultSchema(
        test_name=l.test_name, value=l.value, unit=l.unit,
        date_collected=l.date_collected, is_abnormal=l.is_abnormal
    ) for l in labs]

    active_rxs = db.query(Prescription).filter(
        Prescription.patient_id == patient.id,
        Prescription.status.in_(["approved", "pending"]),
    ).all()
    active_meds = []
    seen_drugs = set()
    for arx in active_rxs:
        if arx.drug_id in seen_drugs:
            continue
        seen_drugs.add(arx.drug_id)
        adrug = db.get(Drug, arx.drug_id)
        active_meds.append(ActiveMedicationSchema(
            drug_id=arx.drug_id,
            drug_name=adrug.generic_name if adrug else arx.drug_id,
            dose_mg=arx.dose_mg,
            frequency=arx.frequency,
            status=arx.status,
        ))

    return PatientContext(
        diagnoses=diagnoses, allergies=allergies,
        recent_labs=recent_labs, active_medications=active_meds,
    )


def _build_prescriber_info(provider: Provider) -> PrescriberInfo:
    """Build full prescriber context for insurer review (v8: includes federal exclusion flags)."""
    return PrescriberInfo(
        provider_id=provider.id,
        first_name=provider.first_name,
        last_name=provider.last_name,
        specialty=provider.specialty,
        npi=provider.npi,
        dea_number=provider.dea_number,
        clinic_name=provider.clinic_name,
        clinic_address=provider.clinic_address,
        clinic_city=provider.clinic_city,
        clinic_state=provider.clinic_state,
        clinic_zip=provider.clinic_zip,
        clinic_phone=provider.clinic_phone,
        clinic_fax=provider.clinic_fax,
        provider_email=provider.provider_email,
        license_state=provider.license_state,
        board_certified=provider.board_certified,
        group_practice=provider.group_practice,
        is_excluded=provider.is_excluded,
        exclusion_source=provider.exclusion_source,
        exclusion_date=provider.exclusion_date,
        exclusion_reason=provider.exclusion_reason,
    )


def _rx_to_response(rx: Prescription, db: Session) -> PrescriptionResponse:
    patient = db.get(Patient, rx.patient_id)
    provider = db.get(Provider, rx.provider_id)
    drug = db.get(Drug, rx.drug_id)

    flags = None
    if rx.flags:
        flags = [FlagSchema(**f) for f in rx.flags]

    return PrescriptionResponse(
        id=rx.id,
        patient_id=rx.patient_id,
        provider_id=rx.provider_id,
        drug_id=rx.drug_id,
        dose_mg=rx.dose_mg,
        frequency=rx.frequency,
        quantity=rx.quantity,
        days_supply=rx.days_supply,
        refills_authorized=rx.refills_authorized,
        date_written=rx.date_written,
        flag_color=rx.flag_color,
        risk_score=rx.risk_score,
        flags=flags,
        status=rx.status,
        patient_name=f"{patient.first_name} {patient.last_name}" if patient else "",
        provider_name=f"Dr. {provider.last_name}" if provider else "",
        drug_name=f"{drug.generic_name} ({drug.brand_name})" if drug and drug.brand_name else (drug.generic_name if drug else ""),
        # v8 disposition fields
        disposition=rx.disposition,
        hold_type=rx.hold_type,
        sla_deadline=rx.sla_deadline,
        operating_mode=rx.operating_mode,
        processing_time_ms=rx.processing_time_ms,
        # Truveta TDM coding
        ndc11=rx.ndc11,
        rxnorm_code=rx.rxnorm_code,
        sig=rx.sig,
        route=rx.route,
    )


@router.post("/analyze", response_model=PrescriptionDetail)
def analyze_prescription(data: PrescriptionCreate, db: Session = Depends(get_db)):
    """Submit a new prescription for analysis."""
    patient = db.get(Patient, data.patient_id)
    if not patient:
        raise HTTPException(404, "Patient not found")
    drug = db.get(Drug, data.drug_id)
    if not drug:
        raise HTTPException(404, "Drug not found")
    provider = db.get(Provider, data.provider_id)
    if not provider:
        raise HTTPException(404, "Provider not found")

    rx_id = f"RX-NEW-{datetime.now().strftime('%Y%m%d%H%M%S')}"
    rx = Prescription(
        id=rx_id,
        patient_id=data.patient_id,
        provider_id=data.provider_id,
        pharmacy_id=data.pharmacy_id,
        drug_id=data.drug_id,
        dose_mg=data.dose_mg,
        frequency=data.frequency,
        quantity=data.quantity,
        days_supply=data.days_supply,
        refills_authorized=data.refills_authorized,
        date_written=datetime.now(),
        status="pending",
    )
    db.add(rx)
    db.flush()

    all_flags, risk_score, flag_color, disposition, hold_type, sla_deadline, ptime, audit = _analyze(rx, patient, drug, db)
    rx.flags = all_flags
    rx.risk_score = risk_score
    rx.flag_color = flag_color
    rx.disposition = disposition
    rx.hold_type = hold_type
    rx.sla_deadline = sla_deadline
    rx.processing_time_ms = ptime
    rx.audit_trail = audit
    rx.operating_mode = DEFAULT_OPERATING_MODE
    rx.analysis_timestamp = datetime.now()
    db.commit()

    alternatives = find_alternatives(drug, patient, db) if flag_color != "GREEN" else []
    context = _build_patient_context(patient, db)

    # Emit real-time WebSocket notification for new prescription
    try:
        from routers.websocket import notify_threadsafe
        notify_threadsafe(
            "new_prescription",
            {
                "prescription_id": rx_id,
                "patient_name": f"{patient.first_name} {patient.last_name}",
                "drug_name": drug.generic_name,
                "flag_color": flag_color,
                "risk_score": risk_score,
                "flag_count": len(all_flags),
            },
        )
    except Exception:
        pass

    resp = _rx_to_response(rx, db)
    prescriber = _build_prescriber_info(provider)
    pgx = [PGxResultSchema.model_validate(r) for r in patient.pgx_results]
    rems = [REMSEnrollmentSchema.model_validate(r) for r in patient.rems_enrollments]
    return PrescriptionDetail(
        **resp.model_dump(),
        alternatives=alternatives,
        patient_context=context,
        prescriber_info=prescriber,
        polypharmacy_score=None,
        titration_info=drug.titration_schedule,
        pgx_results=pgx,
        rems_enrollments=rems,
        audit_trail=rx.audit_trail,
    )


@router.get("/", response_model=List[PrescriptionResponse])
def list_prescriptions(
    flag_color: Optional[str] = None,
    status: Optional[str] = None,
    provider_id: Optional[str] = None,
    patient_id: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    # Clamp caller-controlled paging — SQLite treats LIMIT -1 as unlimited
    skip = max(0, skip)
    limit = max(1, min(limit, 500))
    q = db.query(Prescription)
    if flag_color:
        q = q.filter(Prescription.flag_color == flag_color.upper())
    if status:
        q = q.filter(Prescription.status == status)
    if provider_id:
        q = q.filter(Prescription.provider_id == provider_id)
    if patient_id:
        q = q.filter(Prescription.patient_id == patient_id)

    q = q.order_by(Prescription.date_written.desc())
    rxs = q.offset(skip).limit(limit).all()
    return [_rx_to_response(rx, db) for rx in rxs]


@router.get("/{prescription_id}", response_model=PrescriptionDetail)
def get_prescription(prescription_id: str, db: Session = Depends(get_db)):
    rx = db.get(Prescription, prescription_id)
    if not rx:
        raise HTTPException(404, "Prescription not found")

    patient = db.get(Patient, rx.patient_id)
    drug = db.get(Drug, rx.drug_id)

    alternatives = []
    if rx.flag_color and rx.flag_color != "GREEN" and patient and drug:
        alternatives = find_alternatives(drug, patient, db)

    context = _build_patient_context(patient, db) if patient else None

    provider = db.get(Provider, rx.provider_id)
    prescriber = _build_prescriber_info(provider) if provider else None

    resp = _rx_to_response(rx, db)
    pgx = [PGxResultSchema.model_validate(r) for r in patient.pgx_results] if patient else []
    rems = [REMSEnrollmentSchema.model_validate(r) for r in patient.rems_enrollments] if patient else []
    return PrescriptionDetail(
        **resp.model_dump(),
        alternatives=alternatives,
        patient_context=context,
        prescriber_info=prescriber,
        polypharmacy_score=None,
        titration_info=drug.titration_schedule if drug else None,
        pgx_results=pgx,
        rems_enrollments=rems,
        audit_trail=rx.audit_trail,
    )


@router.post("/{prescription_id}/action")
def prescription_action(
    prescription_id: str,
    action_req: PrescriptionActionRequest,
    db: Session = Depends(get_db),
):
    rx = db.get(Prescription, prescription_id)
    if not rx:
        raise HTTPException(404, "Prescription not found")

    valid_actions = {"approve", "deny", "request_review", "send_to_prescriber"}
    if action_req.action not in valid_actions:
        raise HTTPException(400, f"Invalid action. Must be one of: {valid_actions}")

    # Patient-safety safeguard — server-side guard against abusive denials.
    # Mirror logic in routers/safeguards.py to keep policy centralized.
    if action_req.action == "deny":
        from routers.safeguards import _classify_reason, MIN_REASON_LEN
        c = _classify_reason(action_req.reason or "")
        if c["is_too_short"]:
            raise HTTPException(422, {
                "code": "deny_blocked_low_evidence",
                "message": (
                    f"Denial justification must be at least {MIN_REASON_LEN} "
                    f"characters and cite a clinical, formulary, guideline, or "
                    f"fraud rationale. ERISA §404 fiduciary record."
                ),
            })
        if c["is_cost_only"]:
            raise HTTPException(422, {
                "code": "deny_blocked_cost_only",
                "message": (
                    "Cost alone is not a permissible deny reason. Cite the "
                    "specific clinical, guideline, or formulary basis "
                    "(interaction, dose, step therapy, REMS, PA criteria, etc.)."
                ),
            })
        has_critical = bool(rx.flags) and any(
            (f or {}).get("severity") == "critical" for f in (rx.flags or [])
        )
        if rx.flag_color == "GREEN" and not has_critical:
            raise HTTPException(422, {
                "code": "deny_blocked_green_no_critical",
                "message": (
                    "Prescription was cleared by all clinical engines (GREEN). "
                    "Open a Medical Director (Tier-2) independent review "
                    "instead of denying."
                ),
            })

    status_map = {
        "approve": "approved",
        "deny": "denied",
        "request_review": "review",
        "send_to_prescriber": "review",
    }
    rx.status = status_map[action_req.action]

    action_record = PrescriptionAction(
        prescription_id=prescription_id,
        action=action_req.action,
        reason=action_req.reason,
        performed_by="reviewer",
        timestamp=datetime.now(),
    )
    db.add(action_record)
    db.commit()

    # Emit real-time WebSocket notification
    try:
        from routers.websocket import notify_threadsafe
        patient = db.get(Patient, rx.patient_id)
        drug = db.get(Drug, rx.drug_id)
        notify_threadsafe(
            "prescription_action",
            {
                "prescription_id": prescription_id,
                "action": action_req.action,
                "new_status": rx.status,
                "patient_name": f"{patient.first_name} {patient.last_name}" if patient else "",
                "drug_name": drug.generic_name if drug else "",
                "flag_color": rx.flag_color,
                "reason": action_req.reason,
            },
        )
    except Exception:
        pass  # Don't fail the action if WS notification fails

    return {"status": "ok", "prescription_id": prescription_id, "new_status": rx.status}
