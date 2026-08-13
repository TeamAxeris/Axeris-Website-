"""Drug interaction network API for visualization."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import Optional

from database.database import get_db
from database.models import DrugInteraction, Drug, Prescription, Patient

router = APIRouter(prefix="/interactions", tags=["interactions"])


@router.get("/network")
def get_interaction_network(
    patient_id: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """
    Returns a graph of drug interactions for visualization.
    If patient_id is specified, only shows drugs relevant to that patient.
    """
    nodes = []
    edges = []
    seen_drugs = set()

    if patient_id:
        # Get patient's active medications
        rxs = db.query(Prescription).filter(
            Prescription.patient_id == patient_id,
            Prescription.status.in_(["pending", "approved"]),
        ).all()
        drug_ids = list(set(rx.drug_id for rx in rxs))
    else:
        drug_ids = None

    interactions = db.query(DrugInteraction).all()
    for inter in interactions:
        # If patient filter, only include relevant interactions
        if drug_ids is not None:
            if inter.drug_a_id not in drug_ids and inter.drug_b_id not in drug_ids:
                continue

        # Add nodes
        for did in [inter.drug_a_id, inter.drug_b_id]:
            if did not in seen_drugs:
                drug = db.get(Drug, did)
                if drug:
                    is_patient_drug = drug_ids is not None and did in drug_ids
                    nodes.append({
                        "id": did,
                        "label": drug.generic_name,
                        "brand": drug.brand_name,
                        "category": drug.therapeutic_category,
                        "drug_class": drug.drug_class,
                        "schedule": drug.schedule,
                        "is_patient_drug": is_patient_drug,
                    })
                    seen_drugs.add(did)

        edges.append({
            "source": inter.drug_a_id,
            "target": inter.drug_b_id,
            "severity": inter.severity,
            "description": inter.description,
            "clinical_effect": inter.clinical_effect,
            "management": inter.management,
        })

    return {
        "nodes": nodes,
        "edges": edges,
        "total_interactions": len(edges),
        "total_drugs": len(nodes),
    }


@router.get("/check")
def check_interaction(
    drug_a_id: str = Query(...),
    drug_b_id: str = Query(...),
    db: Session = Depends(get_db),
):
    """Check if two specific drugs have a known interaction."""
    interaction = db.query(DrugInteraction).filter(
        ((DrugInteraction.drug_a_id == drug_a_id) & (DrugInteraction.drug_b_id == drug_b_id)) |
        ((DrugInteraction.drug_a_id == drug_b_id) & (DrugInteraction.drug_b_id == drug_a_id))
    ).first()

    if not interaction:
        return {"interaction_found": False, "drug_a_id": drug_a_id, "drug_b_id": drug_b_id}

    drug_a = db.get(Drug, drug_a_id)
    drug_b = db.get(Drug, drug_b_id)

    return {
        "interaction_found": True,
        "drug_a": {"id": drug_a_id, "name": drug_a.generic_name if drug_a else drug_a_id},
        "drug_b": {"id": drug_b_id, "name": drug_b.generic_name if drug_b else drug_b_id},
        "severity": interaction.severity,
        "description": interaction.description,
        "clinical_effect": interaction.clinical_effect,
        "management": interaction.management,
    }
