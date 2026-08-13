"""Global search API — searches patients, drugs, providers, prescriptions."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import List, Optional

from database.database import get_db
from database.models import Patient, Drug, Provider, Prescription

router = APIRouter(prefix="/search", tags=["search"])


@router.get("/")
def global_search(
    q: str = Query(..., min_length=1, description="Search query"),
    limit: int = Query(20, le=50),
    db: Session = Depends(get_db),
):
    """Search across patients, drugs, providers, prescriptions — returns grouped results."""
    query = q.lower().strip()
    results = {
        "patients": [],
        "drugs": [],
        "providers": [],
        "prescriptions": [],
        "total": 0,
    }

    # Search patients
    patients = db.query(Patient).all()
    for p in patients:
        name = f"{p.first_name} {p.last_name}".lower()
        if query in name or query in p.id.lower():
            results["patients"].append({
                "id": p.id,
                "label": f"{p.first_name} {p.last_name}",
                "sublabel": f"DOB: {p.date_of_birth}" if p.date_of_birth else "",
                "type": "patient",
            })
            if len(results["patients"]) >= limit // 4:
                break

    # Search drugs
    drugs = db.query(Drug).all()
    for d in drugs:
        name_generic = (d.generic_name or "").lower()
        name_brand = (d.brand_name or "").lower()
        drug_class = (d.drug_class or "").lower()
        if query in name_generic or query in name_brand or query in drug_class or query in d.id.lower():
            results["drugs"].append({
                "id": d.id,
                "label": d.generic_name,
                "sublabel": f"{d.brand_name or ''} | {d.drug_class or ''}".strip(" |"),
                "type": "drug",
            })
            if len(results["drugs"]) >= limit // 4:
                break

    # Search providers
    providers = db.query(Provider).all()
    for pr in providers:
        name = f"{pr.first_name} {pr.last_name}".lower()
        specialty = (pr.specialty or "").lower()
        npi = (pr.npi or "").lower()
        if query in name or query in specialty or query in npi or query in pr.id.lower():
            results["providers"].append({
                "id": pr.id,
                "label": f"Dr. {pr.first_name} {pr.last_name}",
                "sublabel": pr.specialty or "",
                "type": "provider",
            })
            if len(results["providers"]) >= limit // 4:
                break

    # Search prescriptions by ID or drug name
    rxs = db.query(Prescription).limit(300).all()
    for rx in rxs:
        rx_id = rx.id.lower()
        drug = db.get(Drug, rx.drug_id)
        drug_name = drug.generic_name.lower() if drug else ""
        patient = db.get(Patient, rx.patient_id)
        patient_name = f"{patient.first_name} {patient.last_name}".lower() if patient else ""

        if query in rx_id or query in drug_name or query in patient_name:
            results["prescriptions"].append({
                "id": rx.id,
                "label": f"{rx.id} — {drug.generic_name if drug else rx.drug_id}",
                "sublabel": f"{patient.first_name} {patient.last_name}" if patient else "",
                "type": "prescription",
                "flag_color": rx.flag_color,
            })
            if len(results["prescriptions"]) >= limit // 4:
                break

    results["total"] = (
        len(results["patients"]) +
        len(results["drugs"]) +
        len(results["providers"]) +
        len(results["prescriptions"])
    )
    return results
