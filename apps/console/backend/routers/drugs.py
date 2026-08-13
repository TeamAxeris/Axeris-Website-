from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional, List

from database.database import get_db
from database.models import Drug, Patient
from schemas.drug import DrugResponse, DrugAlternatives
from schemas.prescription import AlternativeSchema
from engines.equivalence import find_alternatives

router = APIRouter(prefix="/drugs", tags=["drugs"])


@router.get("/", response_model=List[DrugResponse])
def search_drugs(
    q: Optional[str] = None,
    drug_class: Optional[str] = None,
    category: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
):
    limit = max(1, min(limit, 500))
    query = db.query(Drug)
    if q:
        query = query.filter(
            Drug.generic_name.ilike(f"%{q}%") |
            Drug.brand_name.ilike(f"%{q}%")
        )
    if drug_class:
        query = query.filter(Drug.drug_class == drug_class)
    if category:
        query = query.filter(Drug.therapeutic_category == category)

    drugs = query.offset(skip).limit(limit).all()
    return [DrugResponse(
        id=d.id,
        generic_name=d.generic_name,
        brand_name=d.brand_name,
        drug_class=d.drug_class,
        therapeutic_category=d.therapeutic_category,
        schedule=d.schedule,
        formulation=d.formulation,
        strength=d.strength,
        route=d.route,
        average_cost_per_unit=d.average_cost_per_unit,
        generic_available=d.generic_available,
        requires_titration=d.requires_titration,
        max_daily_dose_mg=d.max_daily_dose_mg,
        min_daily_dose_mg=d.min_daily_dose_mg,
    ) for d in drugs]


@router.get("/{drug_id}", response_model=DrugResponse)
def get_drug(drug_id: str, db: Session = Depends(get_db)):
    drug = db.get(Drug, drug_id)
    if not drug:
        raise HTTPException(404, "Drug not found")
    return DrugResponse(
        id=drug.id,
        generic_name=drug.generic_name,
        brand_name=drug.brand_name,
        drug_class=drug.drug_class,
        therapeutic_category=drug.therapeutic_category,
        schedule=drug.schedule,
        formulation=drug.formulation,
        strength=drug.strength,
        route=drug.route,
        average_cost_per_unit=drug.average_cost_per_unit,
        generic_available=drug.generic_available,
        requires_titration=drug.requires_titration,
        max_daily_dose_mg=drug.max_daily_dose_mg,
        min_daily_dose_mg=drug.min_daily_dose_mg,
    )


@router.get("/{drug_id}/alternatives", response_model=DrugAlternatives)
def get_drug_alternatives(
    drug_id: str,
    patient_id: Optional[str] = None,
    db: Session = Depends(get_db),
):
    drug = db.get(Drug, drug_id)
    if not drug:
        raise HTTPException(404, "Drug not found")

    patient = None
    if patient_id:
        patient = db.get(Patient, patient_id)

    if patient:
        alts = find_alternatives(drug, patient, db)
    else:
        # Without patient context, return all equivalences
        from database.models import TherapeuticEquivalence
        eqs = db.query(TherapeuticEquivalence).filter(
            (TherapeuticEquivalence.drug_a_id == drug.id) |
            (TherapeuticEquivalence.drug_b_id == drug.id)
        ).all()
        alts = []
        for eq in eqs:
            alt_id = eq.drug_b_id if eq.drug_a_id == drug.id else eq.drug_a_id
            alt_drug = db.get(Drug, alt_id)
            if alt_drug:
                alts.append({
                    "drug_id": alt_drug.id,
                    "generic_name": alt_drug.generic_name,
                    "brand_name": alt_drug.brand_name,
                    "equivalence_type": eq.equivalence_type,
                    "dose_conversion": eq.dose_conversion_factor,
                    "evidence_level": eq.evidence_level,
                    "estimated_savings_pct": eq.cost_difference_pct or 0,
                    "notes": eq.notes,
                })

    drug_resp = DrugResponse(
        id=drug.id,
        generic_name=drug.generic_name,
        brand_name=drug.brand_name,
        drug_class=drug.drug_class,
        therapeutic_category=drug.therapeutic_category,
        schedule=drug.schedule,
        formulation=drug.formulation,
        strength=drug.strength,
        route=drug.route,
        average_cost_per_unit=drug.average_cost_per_unit,
        generic_available=drug.generic_available,
        requires_titration=drug.requires_titration,
        max_daily_dose_mg=drug.max_daily_dose_mg,
        min_daily_dose_mg=drug.min_daily_dose_mg,
    )

    return DrugAlternatives(drug=drug_resp, alternatives=alts)
