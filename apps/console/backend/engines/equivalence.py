"""
Therapeutic Equivalence Validation — finds safe, equivalent alternatives.
"""

from sqlalchemy.orm import Session
from database.models import Drug, Patient, TherapeuticEquivalence, Prescription
from engines import rules_engine


def find_alternatives(drug: Drug, patient: Patient, db: Session):
    """Find cheaper or safer therapeutic alternatives, filtered by patient safety."""
    equivalences = db.query(TherapeuticEquivalence).filter(
        (TherapeuticEquivalence.drug_a_id == drug.id) |
        (TherapeuticEquivalence.drug_b_id == drug.id)
    ).all()

    alternatives = []
    for eq in equivalences:
        alt_drug_id = eq.drug_b_id if eq.drug_a_id == drug.id else eq.drug_a_id
        alt_drug = db.get(Drug, alt_drug_id)
        if not alt_drug:
            continue

        # Quick safety check for this patient
        safety_issues = []
        # Check allergy
        for allergy in patient.allergies:
            if (allergy.cross_reactivity_group and alt_drug.cross_reactivity_groups
                    and allergy.cross_reactivity_group in alt_drug.cross_reactivity_groups):
                safety_issues.append(f"Allergy cross-reactivity: {allergy.allergen}")

        # Skip if critical safety issue
        if any("Allergy" in s for s in safety_issues):
            continue

        alternatives.append({
            "drug_id": alt_drug.id,
            "generic_name": alt_drug.generic_name,
            "brand_name": alt_drug.brand_name,
            "equivalence_type": eq.equivalence_type,
            "dose_conversion": eq.dose_conversion_factor,
            "evidence_level": eq.evidence_level,
            "estimated_savings_pct": eq.cost_difference_pct or 0,
            "notes": eq.notes,
        })

    return sorted(alternatives, key=lambda a: a["estimated_savings_pct"], reverse=True)
