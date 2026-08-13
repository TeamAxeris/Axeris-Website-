from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List
from datetime import datetime, timedelta

from database.database import get_db
from database.models import (
    Patient, Prescription, Drug, DrugInteraction, Diagnosis, Allergy, LabResult, Encounter
)
from schemas.patient import (
    PatientResponse, PatientDetail, MedicationTimelineEntry, InteractionMapEntry
)
from schemas.prescription import (
    DiagnosisSchema, AllergySchema, LabResultSchema,
    PrescriptionResponse, ActiveMedicationSchema
)
from config import POLYPHARMACY_THRESHOLD, DOCTOR_SHOPPING_PROVIDER_THRESHOLD

router = APIRouter(prefix="/patients", tags=["patients"])

CONTROLLED_SCHEDULES = {"II", "III", "IV"}


def _patient_to_response(p: Patient, db: Session) -> PatientResponse:
    active_diags = [DiagnosisSchema(
        icd10_code=d.icd10_code, description=d.description, is_active=d.is_active
    ) for d in p.diagnoses if d.is_active]

    active_rx_count = db.query(Prescription).filter(
        Prescription.patient_id == p.id,
        Prescription.status.in_(["approved", "pending"]),
    ).count()

    # Doctor shopping check
    ninety_days_ago = datetime.now() - timedelta(days=90)
    distinct_providers = db.query(
        func.count(func.distinct(Prescription.provider_id))
    ).filter(
        Prescription.patient_id == p.id,
        Prescription.date_written >= ninety_days_ago,
    ).join(Drug).filter(
        Drug.schedule.in_(CONTROLLED_SCHEDULES)
    ).scalar() or 0

    # Polypharmacy score
    poly_score = None
    if active_rx_count >= POLYPHARMACY_THRESHOLD:
        age = (datetime.now().date() - p.date_of_birth).days / 365.25
        modifier = 1.2 if age >= 65 else 1.0
        poly_score = min(1.0, (active_rx_count - POLYPHARMACY_THRESHOLD + 1) * 0.15 * modifier)

    # Adherence score (simple MPR)
    one_year_ago = datetime.now() - timedelta(days=365)
    filled_rxs = db.query(Prescription).filter(
        Prescription.patient_id == p.id,
        Prescription.date_filled.isnot(None),
        Prescription.date_filled >= one_year_ago,
    ).all()
    adherence = None
    if len(filled_rxs) >= 3:
        total_days = sum(r.days_supply for r in filled_rxs)
        adherence = min(1.0, total_days / 365)

    return PatientResponse(
        id=p.id,
        first_name=p.first_name,
        last_name=p.last_name,
        date_of_birth=p.date_of_birth,
        gender=p.gender,
        race=p.race,
        ethnicity=p.ethnicity,
        marital_status=p.marital_status,
        preferred_language=p.preferred_language,
        state=p.state,
        postal_code=p.postal_code,
        is_deceased=bool(p.is_deceased),
        active_diagnoses=active_diags,
        allergy_count=len(p.allergies),
        active_medication_count=active_rx_count,
        polypharmacy_risk_score=poly_score,
        adherence_score=adherence,
        doctor_shopping_flag=distinct_providers >= DOCTOR_SHOPPING_PROVIDER_THRESHOLD,
    )


@router.get("/", response_model=List[PatientResponse])
def list_patients(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    skip, limit = max(0, skip), max(1, min(limit, 500))
    patients = db.query(Patient).offset(skip).limit(limit).all()
    return [_patient_to_response(p, db) for p in patients]


@router.get("/{patient_id}", response_model=PatientDetail)
def get_patient(patient_id: str, db: Session = Depends(get_db)):
    p = db.get(Patient, patient_id)
    if not p:
        raise HTTPException(404, "Patient not found")

    base = _patient_to_response(p, db)

    allergies = [AllergySchema(
        allergen=a.allergen, reaction_type=a.reaction_type, severity=a.severity
    ) for a in p.allergies]

    labs = sorted(p.lab_results, key=lambda l: l.date_collected or datetime.min, reverse=True)[:20]
    lab_results = [LabResultSchema(
        test_name=l.test_name, value=l.value, unit=l.unit,
        date_collected=l.date_collected, is_abnormal=l.is_abnormal
    ) for l in labs]

    # Prescriptions
    from routers.prescriptions import _rx_to_response
    all_rxs = db.query(Prescription).filter(Prescription.patient_id == p.id).all()
    rx_responses = [_rx_to_response(rx, db) for rx in all_rxs]

    # Medication timeline
    timeline = []
    for rx in all_rxs:
        drug = db.get(Drug, rx.drug_id)
        end_date = None
        if rx.date_filled and rx.days_supply:
            end_date = rx.date_filled + timedelta(days=rx.days_supply)
        timeline.append(MedicationTimelineEntry(
            drug_name=drug.generic_name if drug else rx.drug_id,
            drug_id=rx.drug_id,
            start_date=rx.date_filled or rx.date_written,
            end_date=end_date,
            dose_mg=rx.dose_mg,
            frequency=rx.frequency,
            status=rx.status,
        ))

    # Interaction map (active meds only)
    active_drug_ids = list({rx.drug_id for rx in all_rxs if rx.status in ("approved", "pending")})
    interactions = []
    for i, d1 in enumerate(active_drug_ids):
        for d2 in active_drug_ids[i+1:]:
            inter = db.query(DrugInteraction).filter(
                ((DrugInteraction.drug_a_id == d1) & (DrugInteraction.drug_b_id == d2)) |
                ((DrugInteraction.drug_a_id == d2) & (DrugInteraction.drug_b_id == d1))
            ).first()
            if inter:
                da = db.get(Drug, d1)
                db2 = db.get(Drug, d2)
                interactions.append(InteractionMapEntry(
                    drug_a=da.generic_name if da else d1,
                    drug_b=db2.generic_name if db2 else d2,
                    severity=inter.severity,
                    description=inter.clinical_effect,
                ))

    # Truveta TDM Encounter history
    from schemas.patient import EncounterSchema
    enc_rows = sorted(
        db.query(Encounter).filter(Encounter.patient_id == p.id).all(),
        key=lambda e: e.start_date or datetime.min, reverse=True,
    )
    encounters = [EncounterSchema(
        id=e.id, encounter_class=e.encounter_class, status=e.status,
        start_date=e.start_date, end_date=e.end_date, facility_name=e.facility_name,
        admit_source=e.admit_source, discharge_disposition=e.discharge_disposition,
    ) for e in enc_rows]

    return PatientDetail(
        **base.model_dump(),
        allergies=allergies,
        lab_results=lab_results,
        prescriptions=rx_responses,
        medication_timeline=timeline,
        interaction_map=interactions,
        encounters=encounters,
    )


@router.get("/{patient_id}/medications", response_model=List[ActiveMedicationSchema])
def get_patient_medications(patient_id: str, db: Session = Depends(get_db)):
    p = db.get(Patient, patient_id)
    if not p:
        raise HTTPException(404, "Patient not found")

    active_rxs = db.query(Prescription).filter(
        Prescription.patient_id == p.id,
        Prescription.status.in_(["approved", "pending"]),
    ).all()

    meds = []
    for rx in active_rxs:
        drug = db.get(Drug, rx.drug_id)
        meds.append(ActiveMedicationSchema(
            drug_id=rx.drug_id,
            drug_name=drug.generic_name if drug else rx.drug_id,
            dose_mg=rx.dose_mg,
            frequency=rx.frequency,
            status=rx.status,
        ))
    return meds
