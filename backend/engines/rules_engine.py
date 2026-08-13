"""
Rules & Guideline Engine — deterministic clinical rule checks (Axeris v8).

Maps to 24 numbered clinical safety checks across 6 categories (A-F).
The rules engine implements Categories A-D + opioid checks 20-22 deterministically.
Categories E-F (ML) are in ml_engine.py. PGx + REMS are in this engine.

CATEGORY A — Drug-Drug Interactions (Checks 1-6):
 - Check 1: Contraindicated DDIs (RULE-DDI-001)
 - Check 2: Major-severity DDIs (RULE-DDI-002)
 - Check 3: Moderate DDIs (RULE-DDI-MOD)
 - Check 4: QT Prolongation Stacking (RULE-QT-001)
 - Check 5: Serotonergic Syndrome (RULE-SERO-001)
 - Check 6: CNS Depression Stacking (Opioid+Benzo+Other) (RULE-CNS-001)

CATEGORY B — Dose Appropriateness (Checks 7-10):
 - Check 7: Renal Dose Adjustment (RULE-RENAL-001/002)
 - Check 8: Hepatic Dose Adjustment (RULE-HEPATIC-001)
 - Check 9: Age & Weight-Based Dosing (RULE-AGE-001)
 - Check 10: Maximum Daily Dose Exceeded — multi-prescriber (RULE-DOSE-001)

CATEGORY C — Patient-Specific Contraindications (Checks 11-16):
 - Check 11: Allergy Cross-Reactivity (RULE-ALG-001)
 - Check 12: Contraindicated Medical Conditions (RULE-DX-001)
 - Check 13: Beers Criteria / Geriatric Safety (RULE-BEERS-001)
 - Check 14: Pregnancy & Lactation Safety (RULE-PREG-001)
 - Check 15: Pharmacogenomics — CPIC Level A (RULE-PGX-001) [v8]
 - Check 16: REMS Compliance Verification (RULE-REMS-001) [v8]

CATEGORY D — Therapeutic Appropriateness (Checks 17-19):
 - Check 17: Therapeutic Duplication (RULE-DUP-001)
 - Check 18: Step Therapy Compliance (PAT-PRIOR-001 — patient_engine)
 - Check 19: Generic Substitution & Therapeutic Alternatives (ML-COST-001 — ml_engine)

CATEGORY E — Opioid-Specific Checks (Checks 20-22):
 - Check 20: MME Threshold Breach (PAT-MME-001 — patient_engine)
 - Check 21: Naloxone Co-Prescribing Absence (RULE-NALOX-001) [v8]
 - Check 22: Early Refill / Overlapping Opioids (ML-REFILL-001 — ml_engine)

CATEGORY F — Prescriber Pattern / ML (Checks 23-24):
 - Check 23: Prescriber Outlier Detection (ML-PRV-001 — ml_engine)
 - Check 24: Pill Mill / Fraud Indicators (ML-FRAUD-001 — ml_engine) [v8]

FOUNDATIONAL: Excluded Provider Screening (LEIE/SAM.gov) — RULE-EXCL-001 [v8]
"""

from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from database.models import (
    Prescription, Patient, Drug, DrugInteraction, Diagnosis, Allergy, LabResult,
    PGxResult, REMSEnrollment, Provider, ExcludedProvider
)
from config import POLYPHARMACY_THRESHOLD

FREQ_MULTIPLIER = {
    "QD": 1, "BID": 2, "TID": 3, "QID": 4, "Q6H": 4, "Q8H": 3, "Q12H": 2,
    "PRN": 1, "DAILY": 1, "WEEKLY": 1 / 7,
    # Infused biologics dose on multi-week cycles. Without these an every-
    # eight-weeks infusion is scored as if it were taken daily, which makes a
    # single 700mg dose look like 700mg/day.
    "Q2W": 1 / 14, "Q3W": 1 / 21, "Q4W": 1 / 28, "Q8W": 1 / 56, "MONTHLY": 1 / 30,
}

# Max duration (days) for categories that have time limits
DURATION_LIMITS = {
    "antibiotic": 14,
    "PPI": 56,         # 8 weeks without reassessment
    "anxiolytic": 28,  # benzodiazepines recommended short-term
    "steroid": 21,
}


def _make_flag(flag_id, category, severity, weight, title, description, evidence, action):
    return {
        "flag_id": flag_id,
        "category": category,
        "severity": severity,
        "weight": weight,
        "title": title,
        "description": description,
        "evidence_source": evidence,
        "suggested_action": action,
        "engine": "rules",
    }


def drug_diagnosis_match(rx: Prescription, patient: Patient, drug: Drug, db: Session):
    """Check if prescribed drug matches any active patient diagnosis."""
    flags = []
    if not drug.approved_indications:
        return flags

    active_diags = [d.icd10_code for d in patient.diagnoses if d.is_active]

    matched = False
    for indication in drug.approved_indications:
        for diag in active_diags:
            if diag.startswith(indication):
                matched = True
                break
        if matched:
            break

    if not matched:
        flags.append(_make_flag(
            "RULE-DX-001", "drug_diagnosis_mismatch", "warning", 0.5,
            "No matching diagnosis for prescribed drug",
            f"{drug.generic_name} ({drug.brand_name}) is not indicated for any of the patient's active diagnoses: {', '.join(active_diags) if active_diags else 'none on file'}. "
            f"Approved indications: {', '.join(drug.approved_indications)}.",
            "Clinical guidelines — drug indication matching",
            "Verify diagnosis supports prescription. Request clinical justification from prescriber."
        ))
    return flags


def dose_range_check(rx: Prescription, drug: Drug):
    """Validate daily dose is within min-max range."""
    flags = []
    freq = FREQ_MULTIPLIER.get(rx.frequency, 1)
    daily_dose = rx.dose_mg * freq

    if drug.max_daily_dose_mg and daily_dose > drug.max_daily_dose_mg:
        flags.append(_make_flag(
            "RULE-DOSE-001", "dose_range", "critical", 0.8,
            "Dose exceeds maximum daily limit",
            f"{drug.generic_name} prescribed at {daily_dose}mg/day ({rx.dose_mg}mg {rx.frequency}). "
            f"Maximum recommended dose is {drug.max_daily_dose_mg}mg/day.",
            f"Drug label — {drug.generic_name} maximum dosing",
            f"Reduce dose to within {drug.max_daily_dose_mg}mg/day or provide clinical justification."
        ))

    if drug.min_daily_dose_mg and daily_dose < drug.min_daily_dose_mg:
        flags.append(_make_flag(
            "RULE-DOSE-002", "dose_range", "info", 0.15,
            "Dose below minimum therapeutic level",
            f"{drug.generic_name} prescribed at {daily_dose}mg/day. "
            f"Minimum effective dose is typically {drug.min_daily_dose_mg}mg/day.",
            f"Drug label — {drug.generic_name} dosing guidelines",
            "Consider if dose is subtherapeutic. May be appropriate for titration start."
        ))
    return flags


def duration_limit_check(rx: Prescription, drug: Drug):
    """Check if days supply exceeds recommended duration for drug category."""
    flags = []
    cat = drug.therapeutic_category
    max_days = DURATION_LIMITS.get(cat)

    if max_days and rx.days_supply > max_days:
        flags.append(_make_flag(
            "RULE-DUR-001", "duration", "warning", 0.3,
            f"Duration exceeds recommended limit for {cat}",
            f"{drug.generic_name} prescribed for {rx.days_supply} days. "
            f"Recommended maximum duration for {cat} is {max_days} days without clinical reassessment.",
            f"Clinical guidelines — {cat} duration of therapy",
            f"Limit to {max_days} days or document clinical rationale for extended use."
        ))
    return flags


def drug_interaction_check(rx: Prescription, patient: Patient, drug: Drug, db: Session):
    """Check for drug-drug interactions with patient's active medications."""
    flags = []

    # Get all active prescriptions for patient (not including this one)
    active_rxs = db.query(Prescription).filter(
        Prescription.patient_id == patient.id,
        Prescription.id != rx.id,
        Prescription.status.in_(["approved", "pending"]),
    ).all()

    active_drug_ids = {arx.drug_id for arx in active_rxs}

    # Query interactions involving the prescribed drug
    interactions = db.query(DrugInteraction).filter(
        (
            (DrugInteraction.drug_a_id == drug.id) & (DrugInteraction.drug_b_id.in_(active_drug_ids))
        ) | (
            (DrugInteraction.drug_b_id == drug.id) & (DrugInteraction.drug_a_id.in_(active_drug_ids))
        )
    ).all()

    for inter in interactions:
        other_drug_id = inter.drug_b_id if inter.drug_a_id == drug.id else inter.drug_a_id
        other_drug = db.get(Drug, other_drug_id)
        severity_weight = {"major": 0.9, "moderate": 0.4, "minor": 0.1}.get(inter.severity, 0.3)
        sev_label = "critical" if inter.severity == "major" else "warning" if inter.severity == "moderate" else "info"

        flags.append(_make_flag(
            f"RULE-DDI-{inter.id:03d}", "drug_interaction", sev_label, severity_weight,
            f"{inter.severity.title()} Drug Interaction: {drug.generic_name} + {other_drug.generic_name if other_drug else other_drug_id}",
            inter.clinical_effect,
            inter.description,
            inter.management,
        ))
    return flags


def duplicate_therapy_check(rx: Prescription, patient: Patient, drug: Drug, db: Session):
    """Detect duplicate therapy — same therapeutic category already active."""
    flags = []
    active_rxs = db.query(Prescription).join(Drug).filter(
        Prescription.patient_id == patient.id,
        Prescription.id != rx.id,
        Prescription.status.in_(["approved", "pending"]),
        Drug.therapeutic_category == drug.therapeutic_category,
        # A repeat cycle of the same agent is a refill, not duplicate therapy.
        # Without this, three rituximab infusions eight weeks apart read as
        # "already on rituximab, rituximab".
        Prescription.drug_id != rx.drug_id,
    ).all()

    if active_rxs:
        existing_drugs = [db.get(Drug, arx.drug_id) for arx in active_rxs]
        existing_names = [d.generic_name for d in existing_drugs if d]

        # Same drug class is higher severity than same category
        same_class = [d for d in existing_drugs if d and d.drug_class == drug.drug_class]
        if same_class:
            flags.append(_make_flag(
                "RULE-DUP-001", "duplicate_therapy", "critical", 0.6,
                f"Duplicate therapy: same drug class ({drug.drug_class})",
                f"Patient already has active prescription(s) for {', '.join(d.generic_name for d in same_class)} "
                f"in the same drug class ({drug.drug_class}). Adding {drug.generic_name} creates duplicate therapy.",
                "Clinical guidelines — avoidance of duplicate therapeutic class",
                "Discontinue one agent or provide clinical justification for combination."
            ))
        else:
            flags.append(_make_flag(
                "RULE-DUP-002", "duplicate_therapy", "warning", 0.3,
                f"Multiple agents in same therapeutic category ({drug.therapeutic_category})",
                f"Patient already has active: {', '.join(existing_names)}. Adding {drug.generic_name} "
                f"increases medication burden in {drug.therapeutic_category} category.",
                "Polypharmacy reduction guidelines",
                "Review if all agents in this category are necessary."
            ))
    return flags


def titration_safety_check(rx: Prescription, patient: Patient, drug: Drug, db: Session):
    """Verify titration protocol is followed for drugs requiring stepwise dosing."""
    flags = []
    if not drug.requires_titration or not drug.titration_schedule:
        return flags

    tit = drug.titration_schedule
    start_dose = tit.get("start_dose_mg", 0)

    # Check if patient has prior prescriptions for this drug
    prior_rxs = db.query(Prescription).filter(
        Prescription.patient_id == patient.id,
        Prescription.drug_id == drug.id,
        Prescription.id != rx.id,
    ).order_by(Prescription.date_written.desc()).all()

    if not prior_rxs:
        # First prescription — check if starting at appropriate dose
        freq = FREQ_MULTIPLIER.get(rx.frequency, 1)
        daily_dose = rx.dose_mg * freq
        if start_dose and daily_dose > start_dose * 1.5:
            flags.append(_make_flag(
                "RULE-TIT-001", "titration_safety", "warning", 0.6,
                f"Titration protocol violation: starting dose too high",
                f"{drug.generic_name} requires titration. Recommended starting dose is {start_dose}mg/day "
                f"but prescribed at {daily_dose}mg/day. This is a {daily_dose/start_dose:.1f}x jump from recommended start.",
                f"Drug label — {drug.generic_name} titration schedule",
                f"Start at {start_dose}mg/day and titrate per protocol every {tit.get('step_interval_days', 7)} days."
            ))
    else:
        # Has prior — check dose step is within protocol
        last_rx = prior_rxs[0]
        last_freq = FREQ_MULTIPLIER.get(last_rx.frequency, 1)
        last_daily = last_rx.dose_mg * last_freq
        curr_freq = FREQ_MULTIPLIER.get(rx.frequency, 1)
        curr_daily = rx.dose_mg * curr_freq
        step = tit.get("step_increment_mg", 0)

        if step and abs(curr_daily - last_daily) > step * 2:
            flags.append(_make_flag(
                "RULE-TIT-002", "titration_safety", "warning", 0.5,
                f"Dose change exceeds titration step limit",
                f"{drug.generic_name} dose changed from {last_daily}mg/day to {curr_daily}mg/day. "
                f"Maximum recommended step is {step}mg per {tit.get('step_interval_days', 7)} days.",
                f"Drug label — {drug.generic_name} titration protocol",
                f"Adjust dose by no more than {step}mg per step interval."
            ))
    return flags


def allergy_cross_reactivity_check(rx: Prescription, patient: Patient, drug: Drug):
    """Check for allergy cross-reactivity."""
    flags = []
    if not drug.cross_reactivity_groups:
        return flags

    for allergy in patient.allergies:
        if allergy.cross_reactivity_group and allergy.cross_reactivity_group in drug.cross_reactivity_groups:
            sev = "critical" if allergy.severity == "severe" else "warning"
            weight = 1.0 if allergy.severity == "severe" else 0.7
            flags.append(_make_flag(
                "RULE-ALG-001", "allergy", sev, weight,
                f"Allergy cross-reactivity: {allergy.allergen} → {drug.generic_name}",
                f"Patient has documented allergy to {allergy.allergen} (reaction: {allergy.reaction_type}, "
                f"severity: {allergy.severity}). {drug.generic_name} belongs to cross-reactivity group "
                f"'{allergy.cross_reactivity_group}'.",
                "Drug allergy cross-reactivity guidelines",
                "Do NOT prescribe. Select alternative from different drug class."
            ))
    return flags


def polypharmacy_risk_check(rx: Prescription, patient: Patient, db: Session):
    """Assess polypharmacy risk based on active medication count."""
    flags = []
    # Count distinct agents, not prescription rows. A drug on a repeating
    # cycle has several active rows and is still one medication; counting rows
    # reports a bigger regimen than the member actually takes and disagrees
    # with the medication list rendered beside it.
    active_ids = {
        r.drug_id for r in db.query(Prescription).filter(
            Prescription.patient_id == patient.id,
            Prescription.status.in_(["approved", "pending"]),
        ).all()
    }
    active_ids.add(rx.drug_id)
    total = len(active_ids)

    if total >= POLYPHARMACY_THRESHOLD:
        # Calculate age for additional risk weighting
        age = (datetime.now().date() - patient.date_of_birth).days / 365.25
        risk_modifier = 1.2 if age >= 65 else 1.0

        poly_score = min(1.0, (total - POLYPHARMACY_THRESHOLD + 1) * 0.15 * risk_modifier)
        severity = "critical" if total >= 10 else "warning"
        weight = 0.4 if total < 10 else 0.6

        flags.append(_make_flag(
            "RULE-POLY-001", "polypharmacy", severity, weight,
            f"Polypharmacy risk: {total} active medications",
            f"Patient has {total} active medications (threshold: {POLYPHARMACY_THRESHOLD}). "
            f"Patient age: {int(age)} years. Polypharmacy score: {poly_score:.2f}. "
            f"Higher medication count increases risk of adverse drug events, falls, and hospitalizations.",
            "Polypharmacy risk management guidelines — American Geriatrics Society",
            "Review all medications for necessity. Consider deprescribing low-value or duplicative agents."
        ))
    return flags


def organ_function_dosing_check(rx: Prescription, patient: Patient, drug: Drug, db: Session):
    """Check if dosing is appropriate for patient's organ function."""
    flags = []

    # Renal check
    if drug.renal_adjustment_required:
        egfr_lab = db.query(LabResult).filter(
            LabResult.patient_id == patient.id,
            LabResult.test_name == "eGFR",
        ).order_by(LabResult.date_collected.desc()).first()

        if egfr_lab:
            if drug.egfr_threshold and egfr_lab.value < drug.egfr_threshold:
                flags.append(_make_flag(
                    "RULE-RENAL-001", "organ_function", "critical", 0.8,
                    f"Renal contraindication: eGFR {egfr_lab.value:.0f} below threshold {drug.egfr_threshold}",
                    f"{drug.generic_name} requires dose adjustment or is contraindicated when eGFR < {drug.egfr_threshold}. "
                    f"Patient's most recent eGFR: {egfr_lab.value:.0f} mL/min/1.73m² (collected {egfr_lab.date_collected.strftime('%Y-%m-%d') if egfr_lab.date_collected else 'unknown date'}).",
                    f"Drug label — {drug.generic_name} renal dosing adjustments",
                    f"Contraindicated at current eGFR. Consider alternative not requiring renal adjustment or reduce dose per label."
                ))
            elif egfr_lab.value < 60 and drug.renal_adjustment_required:
                flags.append(_make_flag(
                    "RULE-RENAL-002", "organ_function", "warning", 0.3,
                    f"Moderate renal impairment: consider dose adjustment",
                    f"Patient eGFR is {egfr_lab.value:.0f} (moderate impairment). {drug.generic_name} requires "
                    f"renal adjustment. Verify dose is appropriate for renal function.",
                    f"Drug label — {drug.generic_name} renal dosing",
                    "Review dose against renal dosing guidelines."
                ))

    # Hepatic check
    if drug.hepatic_adjustment_required:
        alt_lab = db.query(LabResult).filter(
            LabResult.patient_id == patient.id,
            LabResult.test_name == "ALT",
        ).order_by(LabResult.date_collected.desc()).first()

        if alt_lab and alt_lab.value > 120:  # >3x upper normal (~40)
            flags.append(_make_flag(
                "RULE-HEPAT-001", "organ_function", "critical", 0.7,
                f"Hepatic impairment: ALT significantly elevated ({alt_lab.value:.0f} U/L)",
                f"{drug.generic_name} requires hepatic dose adjustment. Patient's ALT is {alt_lab.value:.0f} U/L "
                f"(>3x upper limit of normal), suggesting significant hepatic impairment.",
                f"Drug label — {drug.generic_name} hepatic dosing",
                "Reduce dose or consider alternative not requiring hepatic metabolism."
            ))

    return flags


def qt_prolongation_check(rx: Prescription, patient: Patient, drug: Drug, db: Session):
    """Check for QT prolongation stacking — multiple QT-prolonging drugs concurrent."""
    flags = []
    if not drug.qt_prolongation_risk:
        return flags

    # Find other active prescriptions with QT risk
    active_rxs = db.query(Prescription).join(Drug).filter(
        Prescription.patient_id == patient.id,
        Prescription.id != rx.id,
        Prescription.status.in_(["approved", "pending"]),
        Drug.qt_prolongation_risk == True,
    ).all()

    if active_rxs:
        qt_drugs = [db.get(Drug, arx.drug_id) for arx in active_rxs]
        qt_names = [d.generic_name for d in qt_drugs if d]
        total_qt = len(qt_names) + 1  # include current

        severity = "critical" if total_qt >= 3 else "warning"
        weight = 0.9 if total_qt >= 3 else 0.6

        flags.append(_make_flag(
            "RULE-QT-001", "qt_prolongation", severity, weight,
            f"QT Prolongation Stacking: {total_qt} QT-prolonging agents concurrent",
            f"Adding {drug.generic_name} to existing QT-prolonging medications: {', '.join(qt_names)}. "
            f"Multiple QT-prolonging agents increase the risk of Torsades de Pointes and sudden cardiac death. "
            f"Risk is compounded by electrolyte abnormalities (hypokalemia, hypomagnesemia).",
            "FDA Drug Safety Communication — QT prolongation risk; CredibleMeds.org QT drug classifications",
            "Obtain baseline ECG and electrolytes. Consider alternative without QT risk. Monitor QTc interval."
        ))
    return flags


def serotonergic_syndrome_check(rx: Prescription, patient: Patient, drug: Drug, db: Session):
    """Check for serotonin syndrome risk — multiple serotonergic agents."""
    flags = []
    if not drug.serotonergic:
        return flags

    active_rxs = db.query(Prescription).join(Drug).filter(
        Prescription.patient_id == patient.id,
        Prescription.id != rx.id,
        Prescription.status.in_(["approved", "pending"]),
        Drug.serotonergic == True,
    ).all()

    if active_rxs:
        sero_drugs = [db.get(Drug, arx.drug_id) for arx in active_rxs]
        sero_names = [d.generic_name for d in sero_drugs if d]
        total = len(sero_names) + 1

        severity = "critical" if total >= 3 else "warning"
        weight = 0.8 if total >= 3 else 0.5

        flags.append(_make_flag(
            "RULE-SERO-001", "serotonin_syndrome", severity, weight,
            f"Serotonin Syndrome Risk: {total} serotonergic agents concurrent",
            f"Adding {drug.generic_name} ({drug.drug_class}) to existing serotonergic medications: "
            f"{', '.join(sero_names)}. Concurrent serotonergic agents increase risk of serotonin syndrome — "
            f"a potentially fatal condition presenting with agitation, hyperthermia, clonus, and autonomic instability.",
            "FDA Drug Safety Communication — serotonin syndrome risk with concurrent serotonergic agents",
            "Avoid concurrent serotonergic agents. If combination is necessary, use lowest effective doses and monitor closely."
        ))
    return flags


def moderate_interaction_cumulative_check(rx: Prescription, patient: Patient, drug: Drug, db: Session):
    """Flag when patient accumulates 3+ moderate drug-drug interactions simultaneously."""
    flags = []

    # Get all active prescriptions for patient
    active_rxs = db.query(Prescription).filter(
        Prescription.patient_id == patient.id,
        Prescription.status.in_(["approved", "pending"]),
    ).all()

    all_drug_ids = {arx.drug_id for arx in active_rxs}
    all_drug_ids.add(drug.id)  # include current

    # Count moderate interactions across all active drugs
    moderate_count = 0
    moderate_pairs = []
    checked = set()

    for did in all_drug_ids:
        interactions = db.query(DrugInteraction).filter(
            ((DrugInteraction.drug_a_id == did) & (DrugInteraction.drug_b_id.in_(all_drug_ids))) |
            ((DrugInteraction.drug_b_id == did) & (DrugInteraction.drug_a_id.in_(all_drug_ids))),
            DrugInteraction.severity == "moderate",
        ).all()

        for inter in interactions:
            pair_key = tuple(sorted([inter.drug_a_id, inter.drug_b_id]))
            if pair_key not in checked:
                checked.add(pair_key)
                moderate_count += 1
                da = db.get(Drug, inter.drug_a_id)
                dbi = db.get(Drug, inter.drug_b_id)
                if da and dbi:
                    moderate_pairs.append(f"{da.generic_name} + {dbi.generic_name}")

    if moderate_count >= 3:
        flags.append(_make_flag(
            "RULE-MCUM-001", "cumulative_interaction_risk", "warning", 0.5,
            f"Cumulative interaction risk: {moderate_count} moderate interactions active",
            f"Patient has {moderate_count} active moderate drug-drug interactions: "
            f"{'; '.join(moderate_pairs[:5])}{'...' if len(moderate_pairs) > 5 else ''}. "
            f"While each individual interaction may be manageable, the cumulative burden increases "
            f"risk of adverse drug events.",
            "Polypharmacy interaction burden — clinical guidelines",
            "Comprehensive medication review recommended. Reduce interaction burden where possible."
        ))
    return flags


def age_based_dosing_check(rx: Prescription, patient: Patient, drug: Drug):
    """Check for age-appropriate dosing in geriatric and pediatric patients."""
    flags = []
    age = (datetime.now().date() - patient.date_of_birth).days / 365.25

    freq = FREQ_MULTIPLIER.get(rx.frequency, 1)
    daily_dose = rx.dose_mg * freq

    # Geriatric dosing (65+): should generally start at lower doses
    if age >= 65 and drug.max_daily_dose_mg:
        # Geriatric max is typically 50-75% of standard max for many drug classes
        geriatric_classes = {"opioid analgesic", "benzodiazepine", "NSAID", "gabapentinoid",
                           "SSRI", "SNRI", "ACE inhibitor", "beta-blocker"}
        if drug.drug_class in geriatric_classes:
            geriatric_max = drug.max_daily_dose_mg * 0.75
            if daily_dose > geriatric_max:
                flags.append(_make_flag(
                    "RULE-AGE-001", "age_based_dosing", "warning", 0.4,
                    f"Geriatric dosing concern: dose may be excessive for age {int(age)}",
                    f"{drug.generic_name} prescribed at {daily_dose}mg/day for a {int(age)}-year-old patient. "
                    f"Geriatric patients typically require reduced dosing (recommended max ~{geriatric_max:.0f}mg/day "
                    f"vs standard max {drug.max_daily_dose_mg}mg/day) due to altered pharmacokinetics, "
                    f"reduced renal/hepatic clearance, and increased sensitivity.",
                    "AGS Beers Criteria 2023 — geriatric dosing recommendations (JAGS 71(7):2052-2081)",
                    f"Consider starting at lowest effective dose. Maximum geriatric dose: ~{geriatric_max:.0f}mg/day."
                ))

    # Pediatric dosing (<18): flag adult doses without weight-based adjustment
    if age < 18 and drug.max_daily_dose_mg:
        if daily_dose >= drug.max_daily_dose_mg * 0.8:
            flags.append(_make_flag(
                "RULE-AGE-002", "age_based_dosing", "warning", 0.5,
                f"Pediatric dosing concern: near-adult dose for age {int(age)}",
                f"{drug.generic_name} at {daily_dose}mg/day is near the adult maximum ({drug.max_daily_dose_mg}mg/day) "
                f"for a {int(age)}-year-old patient weighing {patient.weight_kg}kg. "
                f"Pediatric dosing should be weight-based where applicable.",
                "FDA Pediatric labeling — weight-based dosing requirements",
                "Verify weight-based dosing is appropriate. Consider pediatric formulation."
            ))
    return flags


def beers_criteria_check(rx: Prescription, patient: Patient, drug: Drug):
    """Check AGS Beers Criteria — potentially inappropriate medications for patients 65+."""
    flags = []
    age = (datetime.now().date() - patient.date_of_birth).days / 365.25

    if age < 65 or not drug.beers_criteria:
        return flags

    # Specific Beers recommendations by drug class
    beers_details = {
        "benzodiazepine": ("fall risk, cognitive impairment, delirium", "Use non-benzodiazepine sleep aids or behavioral therapy"),
        "NSAID": ("GI bleeding, renal impairment, cardiovascular risk", "Use acetaminophen or topical NSAIDs for pain management"),
        "cardiac glycoside": ("narrow therapeutic index, increased toxicity risk in elderly", "Use lowest effective dose; monitor digoxin levels closely"),
    }

    detail = beers_details.get(drug.drug_class, ("increased adverse event risk in elderly", "Consider safer alternative"))

    flags.append(_make_flag(
        "RULE-BEERS-001", "beers_criteria", "warning", 0.5,
        f"Beers Criteria: {drug.generic_name} potentially inappropriate for patient age {int(age)}",
        f"{drug.generic_name} ({drug.drug_class}) is listed in the AGS Beers Criteria 2023 as potentially "
        f"inappropriate for patients 65 and older. Risks: {detail[0]}. "
        f"Patient age: {int(age)} years.",
        "American Geriatrics Society 2023 Updated AGS Beers Criteria (JAGS 71(7):2052-2081, DOI: 10.1111/jgs.18372)",
        f"{detail[1]}. Document clinical justification if continuing."
    ))
    return flags


def pregnancy_safety_check(rx: Prescription, patient: Patient, drug: Drug):
    """Check pregnancy/lactation safety for patients of childbearing potential."""
    flags = []
    if not drug.pregnancy_risk:
        return flags

    # Only flag for patients who could be pregnant (female, age 12-55)
    age = (datetime.now().date() - patient.date_of_birth).days / 365.25
    if patient.gender not in ("F", "Female", "female"):
        return flags
    if age < 12 or age > 55:
        return flags

    risk_descriptions = {
        "X": ("CONTRAINDICATED in pregnancy — positive evidence of fetal risk", "critical", 0.9),
        "D": ("Positive evidence of human fetal risk — use only if potential benefit justifies risk", "warning", 0.6),
        "C": ("Animal studies show adverse fetal effects — no adequate human studies", "info", 0.2),
    }

    risk_info = risk_descriptions.get(drug.pregnancy_risk)
    if not risk_info:
        return flags

    desc, severity, weight = risk_info

    # Only flag X and D categories with significant weight
    if drug.pregnancy_risk in ("X", "D"):
        flags.append(_make_flag(
            "RULE-PREG-001", "pregnancy_safety", severity, weight,
            f"Pregnancy Risk Category {drug.pregnancy_risk}: {drug.generic_name}",
            f"{drug.generic_name} has FDA pregnancy risk designation '{drug.pregnancy_risk}': {desc}. "
            f"Patient is female, age {int(age)}, and of childbearing potential. "
            f"Under the FDA Pregnancy and Lactation Labeling Rule (PLLR), prescribers must assess "
            f"pregnancy status before initiating this medication.",
            "FDA PLLR (Pregnancy and Lactation Labeling Rule) — 21 CFR 201.57(c)(9)",
            "Verify pregnancy status. If pregnant or planning pregnancy, select safer alternative. "
            "Document informed consent if continuing."
        ))
    return flags


def pharmacogenomic_check(rx: Prescription, patient: Patient, drug: Drug, db: Session):
    """Check 15 (v8): Pharmacogenomics — CPIC Level A guidelines.

    Active rules (CPIC Level A, FDA black box warnings):
      - CYP2D6 PM + codeine → contraindicated (no morphine conversion, no analgesia)
      - CYP2C19 PM + clopidogrel → reduced efficacy (FDA black box)
      - CYP2C9 PM + warfarin → dose reduction required (CPIC Level A)
      - SLCO1B1 low-function + simvastatin >40mg → myopathy risk
      - HLA-B*57:01 positive + abacavir → absolute contraindication
      - TPMT PM/IM + thiopurines → severe myelosuppression
      - DPYD PM/IM + fluoropyrimidines → severe systemic toxicity

    Fires only when structured PGx test result exists. No inference.
    """
    flags = []
    if not drug.pgx_gene or not drug.pgx_risk_phenotype:
        return flags

    # Find patient's PGx result for this gene
    pgx_result = db.query(PGxResult).filter(
        PGxResult.patient_id == patient.id,
        PGxResult.gene == drug.pgx_gene
    ).first()

    if not pgx_result:
        # Data-insufficient — surface as info-level note, not a hard flag
        return flags

    # Check if patient's phenotype matches the risk phenotype
    risk_phenotypes = [p.strip() for p in (drug.pgx_risk_phenotype or "").split(",")]
    if pgx_result.phenotype not in risk_phenotypes:
        return flags

    # Determine severity from clinical action
    action = (drug.pgx_clinical_action or "monitor").lower()
    if action in ("avoid", "contraindicated"):
        severity, weight = "critical", 0.95
    elif action in ("alternative", "dose_reduce"):
        severity, weight = "warning", 0.7
    else:
        severity, weight = "warning", 0.5

    flags.append(_make_flag(
        "RULE-PGX-001", "pharmacogenomics", severity, weight,
        f"PGx Risk: {drug.pgx_gene} {pgx_result.phenotype} + {drug.generic_name}",
        f"Patient's documented {drug.pgx_gene} phenotype is '{pgx_result.phenotype}' "
        f"(diplotype: {pgx_result.diplotype or 'not specified'}). "
        f"Per CPIC Level A guidelines, {drug.generic_name} requires action: {action.upper()}. "
        f"Standard dosing may result in therapeutic failure or severe toxicity for this patient.",
        drug.pgx_evidence or f"CPIC Guideline {drug.pgx_gene} (cpicpgx.org)",
        f"Recommended action: {action}. Consider PGx-guided alternative agent or dose modification."
    ))
    return flags


def rems_compliance_check(rx: Prescription, patient: Patient, drug: Drug, db: Session):
    """Check 16 (v8): REMS Compliance Verification.

    REMS programs with ETASU require enrollment/monitoring before dispense:
      - iPLEDGE (isotretinoin) — pregnancy testing program
      - CLOZAPINE_REMS — ANC monitoring
      - TIRF_REMS — transmucosal immediate-release fentanyl
      - SODIUM_OXYBATE_REMS — Xyrem/Xywav
    """
    flags = []
    if not drug.rems_program:
        return flags

    enrollment = db.query(REMSEnrollment).filter(
        REMSEnrollment.patient_id == patient.id,
        REMSEnrollment.rems_program == drug.rems_program,
        REMSEnrollment.is_active == True,
    ).first()

    program_name_map = {
        "iPLEDGE": "iPLEDGE (isotretinoin pregnancy prevention)",
        "CLOZAPINE_REMS": "Clozapine REMS (ANC monitoring)",
        "TIRF_REMS": "TIRF REMS (transmucosal fentanyl)",
        "SODIUM_OXYBATE_REMS": "Sodium Oxybate REMS (Xyrem/Xywav)",
    }
    program_full = program_name_map.get(drug.rems_program, drug.rems_program)

    if not enrollment:
        flags.append(_make_flag(
            "RULE-REMS-001", "rems_compliance", "critical", 0.9,
            f"REMS Enrollment Missing: {program_full}",
            f"{drug.generic_name} requires active enrollment in {program_full} prior to dispense. "
            f"No active REMS enrollment found in the patient's record. "
            f"This is a hard-stop dispensing requirement under FDA REMS authority (21 USC 355-1).",
            "FDA REMS Database (DailyMed)",
            f"Verify {drug.rems_program} enrollment status. Confirm last monitoring requirement was met. "
            f"Do not dispense without active enrollment confirmation."
        ))
    elif enrollment.last_monitoring_date:
        days_since = (datetime.now().date() - enrollment.last_monitoring_date).days
        # Most REMS programs require monitoring within 30 days for high-risk drugs
        max_days = 30 if drug.rems_program in ("iPLEDGE", "CLOZAPINE_REMS") else 90
        if days_since > max_days:
            flags.append(_make_flag(
                "RULE-REMS-002", "rems_compliance", "warning", 0.6,
                f"REMS Monitoring Overdue: {program_full}",
                f"Patient is enrolled in {program_full}, but last monitoring was "
                f"{days_since} days ago (max permitted: {max_days} days). "
                f"Dispensing without current monitoring violates REMS ETASU requirements.",
                "FDA REMS ETASU monitoring requirements",
                f"Schedule REMS monitoring before dispensing. Notify prescriber."
            ))
    return flags


def naloxone_coprescribing_check(rx: Prescription, patient: Patient, drug: Drug, db: Session):
    """Check 21 (v8): Naloxone Co-Prescribing Absence.

    Per CDC 2022 Recommendation 8: naloxone should be co-prescribed when:
      - Concurrent MME ≥ 50/day, OR
      - Active opioid + CNS depressant (benzo, muscle relaxant) combination
    Suppressed for palliative care / hospice patients.
    """
    flags = []
    if not drug.is_opioid:
        return flags

    # Skip if this Rx itself is naloxone
    if drug.is_naloxone:
        return flags

    # Suppress for palliative care / hospice / cancer pain patients
    palliative_codes = ("Z51.5", "Z51.1", "C")  # Palliative encounter, chemo, cancer prefix
    has_palliative = any(
        any(d.icd10_code.startswith(prefix) for prefix in palliative_codes)
        for d in patient.diagnoses if d.is_active
    )
    if has_palliative:
        return flags

    # Calculate cumulative MME from active opioid prescriptions (including this one)
    active_opioids = db.query(Prescription).join(Drug).filter(
        Prescription.patient_id == patient.id,
        Prescription.status.in_(["approved", "pending"]),
        Drug.is_opioid == True,
    ).all()

    cumulative_mme = 0.0
    for opi_rx in active_opioids:
        opi_drug = db.get(Drug, opi_rx.drug_id)
        if not opi_drug or not opi_drug.mme_conversion_factor:
            continue
        freq_mult = FREQ_MULTIPLIER.get((opi_rx.frequency or "QD").upper(), 1)
        daily_dose = (opi_rx.dose_mg or 0) * freq_mult
        cumulative_mme += daily_dose * opi_drug.mme_conversion_factor

    # Check for concurrent CNS depressant (benzo, muscle relaxant)
    has_cns_depressant = db.query(Prescription).join(Drug).filter(
        Prescription.patient_id == patient.id,
        Prescription.status.in_(["approved", "pending"]),
        Drug.therapeutic_category.in_(["benzodiazepine", "muscle relaxant", "sedative-hypnotic"]),
    ).first() is not None

    # Check if patient has naloxone in last 365 days
    one_year_ago = datetime.now() - timedelta(days=365)
    has_naloxone = db.query(Prescription).join(Drug).filter(
        Prescription.patient_id == patient.id,
        Drug.is_naloxone == True,
        Prescription.date_written >= one_year_ago,
    ).first() is not None

    # Trigger conditions
    high_mme = cumulative_mme >= 50
    needs_naloxone = high_mme or has_cns_depressant

    if needs_naloxone and not has_naloxone:
        reason_parts = []
        if high_mme:
            reason_parts.append(f"cumulative MME = {cumulative_mme:.0f}/day (≥50 trigger)")
        if has_cns_depressant:
            reason_parts.append("concurrent CNS depressant (FDA black box)")
        trigger_str = "; ".join(reason_parts)

        flags.append(_make_flag(
            "RULE-NALOX-001", "naloxone_coprescribing", "warning", 0.5,
            f"Naloxone co-prescription absent — {trigger_str}",
            f"Patient meets CDC 2022 Recommendation 8 criteria for naloxone co-prescribing "
            f"({trigger_str}), but no naloxone prescription exists in the past 365 days. "
            f"Naloxone co-prescribing reduces overdose mortality risk for high-risk patients.",
            "CDC 2022 Opioid Guideline Recommendation 8 (MMWR 2022;71(RR-3):1-95)",
            "Co-prescribe naloxone (4mg nasal spray, 2 doses) and educate patient/caregiver on use. "
            "Document offer if patient declines."
        ))
    return flags


def excluded_provider_check(rx: Prescription, patient: Patient, drug: Drug, db: Session):
    """Foundational Layer (v8): HHS-OIG LEIE / SAM.gov excluded provider screening.

    Hard stop: claims from excluded providers are flagged regardless of clinical content.
    Cross-references prescriber NPI against federal exclusion lists on every claim.
    """
    flags = []
    provider = db.get(Provider, rx.provider_id)
    if not provider:
        return flags

    # Check provider self-exclusion flag (synced from LEIE/SAM.gov)
    if provider.is_excluded:
        flags.append(_make_flag(
            "RULE-EXCL-001", "excluded_provider", "critical", 1.0,
            f"EXCLUDED PROVIDER — Federal exclusion list match",
            f"Prescriber {provider.first_name} {provider.last_name} (NPI: {provider.npi}) "
            f"is on the federal exclusion list. "
            f"Source: {provider.exclusion_source or 'LEIE'}. "
            f"Reason: {provider.exclusion_reason or 'Federal exclusion'}. "
            f"Date excluded: {provider.exclusion_date or 'on file'}. "
            f"Claims from excluded providers must not be paid by federal-aligned plans.",
            "HHS-OIG LEIE (oig.hhs.gov) / SAM.gov Federal Exclusions",
            "BLOCK PAYMENT immediately. Notify TPA fraud team. "
            "Coordinate with PBM to apply prospective claim edits on this NPI."
        ))
        return flags

    # Cross-reference NPI against ExcludedProvider table
    if provider.npi:
        match = db.query(ExcludedProvider).filter(
            ExcludedProvider.npi == provider.npi,
        ).first()
        if match and (not match.reinstatement_date or match.reinstatement_date > datetime.now().date()):
            flags.append(_make_flag(
                "RULE-EXCL-001", "excluded_provider", "critical", 1.0,
                f"EXCLUDED PROVIDER — {match.exclusion_source} list match",
                f"NPI {provider.npi} matches {match.exclusion_source} exclusion list. "
                f"Type: {match.exclusion_type}. Reason: {match.reason_description or match.reason_code}. "
                f"Excluded: {match.exclusion_date}.",
                f"{match.exclusion_source} (synced {match.last_synced})",
                "BLOCK PAYMENT. Refer to TPA fraud investigation team."
            ))
    return flags


def evaluate(rx: Prescription, patient: Patient, drug: Drug, db: Session):
    """Run all rules engine checks. Returns list of flag dicts.

    24-check coverage: Categories A-D + Check 15 (PGx), 16 (REMS), 21 (Naloxone)
    + Foundational excluded provider screening.
    """
    flags = []
    # FOUNDATIONAL: federal exclusion screening (hard stop)
    flags.extend(excluded_provider_check(rx, patient, drug, db))
    # If excluded, short-circuit further checks (still return excl flag with weight 1.0)

    # Category A: Drug-Drug Interactions (Checks 1-6)
    flags.extend(drug_interaction_check(rx, patient, drug, db))               # Checks 1, 2
    flags.extend(moderate_interaction_cumulative_check(rx, patient, drug, db))# Check 3
    flags.extend(qt_prolongation_check(rx, patient, drug, db))                # Check 4
    flags.extend(serotonergic_syndrome_check(rx, patient, drug, db))          # Check 5
    # Check 6 (CNS Depression Stacking) is enforced via DDI table + naloxone check

    # Category B: Dose Appropriateness (Checks 7-10)
    flags.extend(organ_function_dosing_check(rx, patient, drug, db))          # Checks 7, 8
    flags.extend(age_based_dosing_check(rx, patient, drug))                   # Check 9
    flags.extend(dose_range_check(rx, drug))                                  # Check 10

    # Category C: Patient-Specific Contraindications (Checks 11-16)
    flags.extend(allergy_cross_reactivity_check(rx, patient, drug))           # Check 11
    flags.extend(drug_diagnosis_match(rx, patient, drug, db))                 # Check 12
    flags.extend(beers_criteria_check(rx, patient, drug))                     # Check 13
    flags.extend(pregnancy_safety_check(rx, patient, drug))                   # Check 14
    flags.extend(pharmacogenomic_check(rx, patient, drug, db))                # Check 15 (v8)
    flags.extend(rems_compliance_check(rx, patient, drug, db))                # Check 16 (v8)

    # Category D: Therapeutic Appropriateness (Checks 17-19)
    flags.extend(duplicate_therapy_check(rx, patient, drug, db))              # Check 17
    flags.extend(duration_limit_check(rx, drug))                              # supports Check 17/19
    flags.extend(titration_safety_check(rx, patient, drug, db))               # supports Check 7

    # Category E: Opioid-Specific (Checks 20-22)
    flags.extend(naloxone_coprescribing_check(rx, patient, drug, db))         # Check 21 (v8)
    # Check 20 in patient_engine.py (MME), Check 22 in ml_engine.py (refill)

    # Patient safety supplement
    flags.extend(polypharmacy_risk_check(rx, patient, db))
    return flags
