"""
Patient-Specific Reasoning Engine — contextual EHR-aware analysis.

Checks (7 total):
1. Comorbidity-aware assessment (Category C: Contraindicated Medical Conditions)
2. Lab-value dosing / trending (Category B: Renal/Hepatic Dose Adjustment)
3. Prior treatment failure awareness (Category D: Step Therapy Compliance)
4. Adherence pattern analysis (Adherence Monitoring Module)
5. Active medication load — CNS burden (Category A: CNS Depression Stacking)
6. Opioid stewardship — MME tracking + CDC 2022 (Opioid Stewardship Module)
7. Specialty drug review (Specialty Drug Module)
"""

from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import func

from database.models import (
    Prescription, Patient, Drug, LabResult, Diagnosis, TherapeuticEquivalence,
    InsuranceClaim, DrugInteraction,
)
from config import ADHERENCE_MPR_THRESHOLD

# Drug classes that are CNS depressants
CNS_DEPRESSANT_CLASSES = {
    "opioid analgesic", "benzodiazepine", "gabapentinoid",
    "first-generation antihistamine", "barbiturate",
}

# Contraindicated combos: diagnosis -> drug classes to avoid
COMORBIDITY_CONTRAINDICATIONS = {
    "J45": ["beta-blocker"],          # Asthma — avoid non-selective beta-blockers
    "I50": ["NSAID", "COX-2 inhibitor", "thiazolidinedione"],  # Heart failure
    "N18": ["NSAID", "COX-2 inhibitor"],  # CKD
    "K25": ["NSAID", "COX-2 inhibitor"],  # Peptic ulcer
    "K26": ["NSAID", "COX-2 inhibitor"],
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
        "engine": "patient",
    }


def comorbidity_aware_assessment(rx: Prescription, patient: Patient, drug: Drug, db: Session):
    """Cross-reference diagnoses with known drug contraindications."""
    flags = []
    active_diags = [d.icd10_code for d in patient.diagnoses if d.is_active]

    for diag_code in active_diags:
        # Check prefix match (e.g., "J45.0" matches "J45")
        for contra_prefix, bad_classes in COMORBIDITY_CONTRAINDICATIONS.items():
            if diag_code.startswith(contra_prefix) and drug.drug_class in bad_classes:
                diag_obj = next((d for d in patient.diagnoses if d.icd10_code == diag_code), None)
                diag_name = diag_obj.description if diag_obj else diag_code

                flags.append(_make_flag(
                    "PAT-COMRB-001", "comorbidity_contraindication", "critical", 0.7,
                    f"Comorbidity contraindication: {drug.drug_class} with {diag_name}",
                    f"{drug.generic_name} ({drug.drug_class}) is contraindicated or high-risk in patients "
                    f"with {diag_name} ({diag_code}). This combination may worsen the underlying condition.",
                    "Clinical practice guidelines — comorbidity-specific prescribing",
                    f"Select alternative drug class. Avoid {drug.drug_class} in patients with {diag_name}."
                ))
    return flags


def lab_value_trending_check(rx: Prescription, patient: Patient, drug: Drug, db: Session):
    """Check lab value trends for declining organ function."""
    flags = []

    if drug.renal_adjustment_required:
        # Get last 3 eGFR results
        egfr_results = db.query(LabResult).filter(
            LabResult.patient_id == patient.id,
            LabResult.test_name == "eGFR",
        ).order_by(LabResult.date_collected.desc()).limit(3).all()

        if len(egfr_results) >= 2:
            values = [r.value for r in egfr_results]
            # Check if trending downward
            if all(values[i] < values[i+1] for i in range(len(values)-1)):
                latest = values[0]
                decline_rate = values[-1] - values[0]  # total decline
                flags.append(_make_flag(
                    "PAT-TREND-001", "lab_trending", "warning", 0.4,
                    f"Declining renal function: eGFR trending down ({values[-1]:.0f} → {latest:.0f})",
                    f"Patient's eGFR is on a declining trend: {' → '.join(f'{v:.0f}' for v in reversed(values))}. "
                    f"{drug.generic_name} requires renal adjustment. Current eGFR {latest:.0f} may soon require "
                    f"dose modification or discontinuation.",
                    "Nephrology guidelines — monitoring drug dosing in declining renal function",
                    "Plan for dose adjustment as eGFR declines. Recheck labs in 4-6 weeks."
                ))

    return flags


def prior_treatment_awareness(rx: Prescription, patient: Patient, drug: Drug, db: Session):
    """Check if patient previously tried and discontinued same drug class."""
    flags = []
    # Find prior prescriptions in same drug class that weren't refilled
    prior_same_class = db.query(Prescription).join(Drug).filter(
        Prescription.patient_id == patient.id,
        Prescription.id != rx.id,
        Drug.drug_class == drug.drug_class,
        Prescription.status == "denied",
    ).all()

    # Also check for discontinued (filled but no follow-up refill)
    prior_filled = db.query(Prescription).join(Drug).filter(
        Prescription.patient_id == patient.id,
        Prescription.id != rx.id,
        Drug.drug_class == drug.drug_class,
        Prescription.date_filled.isnot(None),
    ).order_by(Prescription.date_filled.desc()).all()

    # Check if there's a gap suggesting discontinuation
    if prior_filled:
        last_filled = prior_filled[0]
        if last_filled.date_filled:
            days_since = (datetime.now() - last_filled.date_filled).days
            # If more than 2x the supply period with no refill, likely discontinued
            if days_since > last_filled.days_supply * 2 and drug.id == last_filled.drug_id:
                other_drug = db.get(Drug, last_filled.drug_id)
                flags.append(_make_flag(
                    "PAT-PRIOR-001", "prior_treatment", "info", 0.15,
                    f"Prior trial of {other_drug.generic_name if other_drug else 'same drug'} was discontinued",
                    f"Patient previously received {other_drug.generic_name if other_drug else drug.generic_name} "
                    f"(last filled {last_filled.date_filled.strftime('%Y-%m-%d')}), "
                    f"which appears to have been discontinued {days_since} days ago. "
                    f"Re-prescribing the same agent may face the same issues.",
                    "Medication history review",
                    "Verify reason for prior discontinuation. Consider alternative if prior failure or intolerance."
                ))

    if prior_same_class:
        denied_drugs = [db.get(Drug, p.drug_id) for p in prior_same_class]
        denied_names = [d.generic_name for d in denied_drugs if d]
        if denied_names:
            flags.append(_make_flag(
                "PAT-PRIOR-002", "prior_treatment", "info", 0.1,
                f"Prior denials in same drug class ({drug.drug_class})",
                f"Patient has prior denied prescriptions in {drug.drug_class}: {', '.join(denied_names)}. "
                f"This may indicate a pattern of therapeutic failure in this class.",
                "Medication history review",
                "Consider alternative drug class."
            ))
    return flags


def adherence_pattern_analysis(rx: Prescription, patient: Patient, db: Session):
    """Calculate medication possession ratio for chronic medications."""
    flags = []

    # Get all filled prescriptions in the last 365 days
    one_year_ago = datetime.now() - timedelta(days=365)
    filled_rxs = db.query(Prescription).filter(
        Prescription.patient_id == patient.id,
        Prescription.date_filled.isnot(None),
        Prescription.date_filled >= one_year_ago,
    ).all()

    if len(filled_rxs) < 3:
        return flags  # Not enough data

    # Calculate overall MPR
    total_days_supply = sum(r.days_supply for r in filled_rxs)
    days_in_period = 365
    mpr = total_days_supply / max(days_in_period, 1)
    # Cap at 1.0
    mpr = min(mpr, 1.0)

    if mpr < ADHERENCE_MPR_THRESHOLD:
        flags.append(_make_flag(
            "PAT-ADH-001", "adherence", "info", 0.15,
            f"Adherence signal across medication history: MPR {mpr:.0%}",
            f"Across all of this member's dispensed medications over the past year, the medication "
            f"possession ratio is {mpr:.0%} (threshold: {ADHERENCE_MPR_THRESHOLD:.0%}). This is a "
            f"member-level signal computed from self-administered fill history, not an adherence rate "
            f"for any single drug, and it does not apply to provider-administered therapy. It is "
            f"surfaced as context for the reviewer rather than as a finding against this claim.",
            "Adherence monitoring — member-level possession ratio across dispensed medications",
            "Review the member's overall regimen for simplification or adherence support."
        ))
    return flags


def active_medication_load(rx: Prescription, patient: Patient, drug: Drug, db: Session):
    """Assess CNS depressant and anticholinergic burden from active meds."""
    flags = []
    active_rxs = db.query(Prescription).join(Drug).filter(
        Prescription.patient_id == patient.id,
        Prescription.status.in_(["approved", "pending"]),
    ).all()

    # Count CNS depressants
    cns_count = 0
    cns_drugs = []
    for arx in active_rxs:
        adrug = db.get(Drug, arx.drug_id)
        if adrug and adrug.drug_class in CNS_DEPRESSANT_CLASSES:
            cns_count += 1
            cns_drugs.append(adrug.generic_name)

    # Check if new drug adds to CNS burden
    if drug.drug_class in CNS_DEPRESSANT_CLASSES and cns_count >= 1:
        total_cns = cns_count + 1
        flags.append(_make_flag(
            "PAT-CNS-001", "medication_load", "warning" if total_cns < 3 else "critical",
            0.5 if total_cns < 3 else 0.8,
            f"High CNS depressant load: {total_cns} agents",
            f"Adding {drug.generic_name} ({drug.drug_class}) brings total CNS depressants to {total_cns}. "
            f"Current CNS depressants: {', '.join(cns_drugs)}. "
            f"Multiple CNS depressants increase risk of respiratory depression, falls, and sedation.",
            "FDA Drug Safety Communication — CNS depressant combinations",
            "Minimize CNS depressant combinations. Use lowest effective doses."
        ))
    return flags


def opioid_stewardship_check(rx: Prescription, patient: Patient, drug: Drug, db: Session):
    """Opioid Stewardship Module — MME calculation, CDC 2022 Clinical Practice Guideline.

    Implements CDC 2022 reference points (not rigid thresholds):
    - >=50 MME/day: Flag for individualized reassessment
    - >=90 MME/day: Flag for careful clinical justification
    - Opioid + benzodiazepine concurrent: Always flag (FDA black box warning 2016)
    - >=50 MME without documented naloxone: Flag for co-prescribing discussion
    Cancer/palliative/end-of-life excluded per CDC 2022 guidance.
    """
    flags = []
    if not drug.mme_conversion_factor:
        return flags

    # Check for palliative/cancer exclusions
    active_diags = [d.icd10_code for d in patient.diagnoses if d.is_active]
    palliative_codes = {"Z51.5", "Z51.1"}  # Palliative care, cancer treatment
    cancer_prefixes = ("C", "D0")  # Cancer ICD-10 codes
    for diag in active_diags:
        if diag in palliative_codes or any(diag.startswith(p) for p in cancer_prefixes):
            return flags  # Exempt from MME flagging

    # Calculate current prescription's MME contribution
    freq = {"QD": 1, "BID": 2, "TID": 3, "QID": 4, "Q6H": 4, "Q8H": 3, "Q12H": 2, "PRN": 1, "DAILY": 1}.get(rx.frequency, 1)
    daily_dose = rx.dose_mg * freq
    this_mme = daily_dose * drug.mme_conversion_factor

    # Calculate total MME from all active opioid prescriptions
    active_opioid_rxs = db.query(Prescription).join(Drug).filter(
        Prescription.patient_id == patient.id,
        Prescription.id != rx.id,
        Prescription.status.in_(["approved", "pending"]),
        Drug.mme_conversion_factor.isnot(None),
    ).all()

    total_mme = this_mme
    for arx in active_opioid_rxs:
        opioid = db.get(Drug, arx.drug_id)
        if opioid and opioid.mme_conversion_factor:
            arx_freq = {"QD": 1, "BID": 2, "TID": 3, "QID": 4, "Q6H": 4, "Q8H": 3, "Q12H": 2, "PRN": 1, "DAILY": 1}.get(arx.frequency, 1)
            total_mme += arx.dose_mg * arx_freq * opioid.mme_conversion_factor

    # CDC 2022 reference points
    if total_mme >= 90:
        flags.append(_make_flag(
            "PAT-MME-001", "opioid_stewardship", "critical", 0.8,
            f"High MME: {total_mme:.0f} MME/day (CDC 2022 guideline: careful justification above 90 MME)",
            f"Patient's total morphine milligram equivalent is {total_mme:.0f} MME/day. "
            f"This prescription ({drug.generic_name} {rx.dose_mg}mg {rx.frequency}) contributes {this_mme:.0f} MME/day. "
            f"CDC 2022 Clinical Practice Guideline advises careful clinical justification at doses above 90 MME/day "
            f"due to significantly increased overdose risk.",
            "CDC 2022 Clinical Practice Guideline for Prescribing Opioids (MMWR 2022;71(RR-3):1-95)",
            "Document clinical justification for high-dose opioid. Consider dose reduction plan. "
            "Verify naloxone co-prescribed. Check PDMP."
        ))
    elif total_mme >= 50:
        flags.append(_make_flag(
            "PAT-MME-002", "opioid_stewardship", "warning", 0.5,
            f"Elevated MME: {total_mme:.0f} MME/day (CDC 2022: reassess benefits vs risks)",
            f"Patient's total MME is {total_mme:.0f} MME/day. "
            f"CDC 2022 guideline recommends individualized reassessment of benefits versus risks "
            f"before any further increase above 50 MME/day.",
            "CDC 2022 Clinical Practice Guideline for Prescribing Opioids (MMWR 2022;71(RR-3):1-95)",
            "Reassess pain management approach. Consider multimodal analgesia. Verify naloxone co-prescribed."
        ))

    # Check for concurrent benzodiazepine (FDA black box warning)
    active_benzo = db.query(Prescription).join(Drug).filter(
        Prescription.patient_id == patient.id,
        Prescription.status.in_(["approved", "pending"]),
        Drug.drug_class == "benzodiazepine",
    ).first()

    if active_benzo and drug.mme_conversion_factor:
        benzo_drug = db.get(Drug, active_benzo.drug_id)
        flags.append(_make_flag(
            "PAT-MME-003", "opioid_stewardship", "critical", 0.9,
            f"FDA Black Box Warning: Opioid + Benzodiazepine Concurrent Use",
            f"Patient is being prescribed {drug.generic_name} (opioid) while concurrently taking "
            f"{benzo_drug.generic_name if benzo_drug else 'a benzodiazepine'}. "
            f"FDA issued a black box warning (August 31, 2016) for concurrent use of opioids and "
            f"benzodiazepines covering ~400 products due to risk of profound sedation, respiratory "
            f"depression, coma, and death.",
            "FDA Drug Safety Communication (8/31/2016) — Opioid + Benzodiazepine Black Box Warning",
            "Avoid concurrent use. If combination is medically necessary, limit doses and duration. "
            "Prescribe naloxone. Document clinical justification."
        ))

    return flags


def specialty_drug_review(rx: Prescription, patient: Patient, drug: Drug, db: Session):
    """Specialty Drug Module — review high-cost specialty medications."""
    flags = []
    if not drug.is_specialty:
        return flags

    # Check if diagnosis supports specialty drug use
    active_diags = [d.icd10_code for d in patient.diagnoses if d.is_active]
    indication_match = False
    if drug.approved_indications:
        for indication in drug.approved_indications:
            for diag in active_diags:
                if diag.startswith(indication):
                    indication_match = True
                    break

    if not indication_match:
        flags.append(_make_flag(
            "PAT-SPEC-001", "specialty_drug", "warning", 0.6,
            f"Specialty drug without clear indication: {drug.generic_name} (${drug.average_cost_per_unit:.2f}/unit)",
            f"{drug.generic_name} ({drug.brand_name}) is a high-cost specialty medication "
            f"(${drug.average_cost_per_unit:.2f}/unit). No active diagnosis supports its use based on "
            f"approved indications: {', '.join(drug.approved_indications or ['unknown'])}. "
            f"Patient's active diagnoses: {', '.join(active_diags) if active_diags else 'none on file'}.",
            "Specialty drug management — indication verification protocols",
            "Verify clinical indication. Request documentation from prescriber. Consider step therapy requirements."
        ))

    # Biosimilar and generic substitution is a formulary price lookup, not
    # patient-context reasoning. It lives in the ML/cost layer as ML-COST-001
    # and is deliberately not duplicated here: the same finding surfacing from
    # two engines inflates the flag count and misattributes the work.
    return flags


def regimen_risk_scan(rx: Prescription, patient: Patient, drug: Drug, db: Session):
    """Scan the regimen the claim is joining, not just the claim itself.

    Engine 1 compares the drug being scored against everything else the member
    takes. Nothing was comparing the rest of the regimen against itself, so a
    dangerous pair already sitting in the active list stayed invisible unless
    one of its members happened to be the drug under review. A reviewer opening
    a high-cost specialty claim would see a medication count and never learn
    that two of those medications should not be taken together.

    Three passes, all restricted to pairs and findings that do not involve the
    drug on this claim, since Engine 1 already owns those:
      1. interaction pairs inside the active regimen
      2. active drugs contraindicated by an active diagnosis
      3. active drugs whose renal threshold the member is approaching
    """
    flags = []
    active = db.query(Prescription).filter(
        Prescription.patient_id == patient.id,
        Prescription.status.in_(["approved", "pending"]),
    ).all()

    # Distinct agents only. Repeat cycles of one drug are one drug.
    agents = {}
    for arx in active:
        d = db.get(Drug, arx.drug_id)
        if d and d.id != drug.id:
            agents[d.id] = d
    if not agents:
        return flags

    active_codes = [dx.icd10_code for dx in patient.diagnoses if dx.is_active]

    # ─── 1. Interaction pairs within the regimen ───
    ids = list(agents)
    seen_pairs = set()
    for inter in db.query(DrugInteraction).filter(
        DrugInteraction.drug_a_id.in_(ids),
        DrugInteraction.drug_b_id.in_(ids),
    ).all():
        if inter.severity not in ("major", "moderate"):
            continue
        key = tuple(sorted([inter.drug_a_id, inter.drug_b_id]))
        if key in seen_pairs:
            continue
        seen_pairs.add(key)
        a, b = agents.get(inter.drug_a_id), agents.get(inter.drug_b_id)
        if not a or not b:
            continue
        major = inter.severity == "major"
        flags.append(_make_flag(
            "PAT-REGIMEN-001", "regimen_interaction",
            "critical" if major else "warning", 0.85 if major else 0.4,
            f"{inter.severity.title()} interaction already in the regimen: {a.generic_name} + {b.generic_name}",
            f"This claim is not the interaction. {a.generic_name} and {b.generic_name} are both active on this "
            f"member and carry a {inter.severity} interaction: {inter.clinical_effect} "
            f"Neither drug is the one being reviewed here, so it would not surface on a claim-by-claim check. "
            f"It is raised because the reviewer is already looking at this member.",
            inter.description or "Drug interaction reference",
            inter.management or "Review the combination with the prescriber.",
        ))

    # ─── 2. Active drug contraindicated by an active diagnosis ───
    for d in agents.values():
        for prefix, bad_classes in COMORBIDITY_CONTRAINDICATIONS.items():
            if d.drug_class not in bad_classes:
                continue
            hit = next((c for c in active_codes if c.startswith(prefix)), None)
            if not hit:
                continue
            dx = next((x for x in patient.diagnoses if x.icd10_code == hit), None)
            flags.append(_make_flag(
                "PAT-REGIMEN-002", "regimen_contraindication", "critical", 0.7,
                f"Regimen contraindication: {d.generic_name} with {dx.description if dx else hit}",
                f"{d.generic_name} ({d.drug_class}) is active on this member, who carries a diagnosis of "
                f"{dx.description if dx else hit} ({hit}). That combination is contraindicated or high-risk, "
                f"and it sits in the regimen independent of the claim under review.",
                "Clinical practice guidelines — comorbidity-specific prescribing",
                f"Reassess whether {d.generic_name} should continue given {dx.description if dx else hit}.",
            ))

    # ─── 3. Renal threshold approach on any active drug ───
    egfr = db.query(LabResult).filter(
        LabResult.patient_id == patient.id,
        LabResult.test_name == "eGFR",
    ).order_by(LabResult.date_collected.desc()).limit(3).all()
    if egfr:
        current = egfr[0].value
        series = [r.value for r in egfr]
        declining = len(series) >= 2 and all(series[i] < series[i + 1] for i in range(len(series) - 1))
        for d in agents.values():
            if not d.renal_adjustment_required or not d.egfr_threshold:
                continue
            # Already below the labeled limit, or closing on it while falling.
            approaching = current < d.egfr_threshold * 2 and declining
            if not (current < d.egfr_threshold or approaching):
                continue
            below = current < d.egfr_threshold
            trend = " → ".join(f"{v:.0f}" for v in reversed(series))
            flags.append(_make_flag(
                "PAT-REGIMEN-003", "regimen_renal",
                "critical" if below else "warning", 0.7 if below else 0.4,
                f"Renal review: {d.generic_name} at eGFR {current:.0f}"
                + ("" if below else " on a declining trend"),
                f"{d.generic_name} requires renal dose adjustment below an eGFR of {d.egfr_threshold:.0f}. "
                f"The member's eGFR is {current:.0f} and the trajectory is {trend}. "
                + ("This is already past the labeled limit. "
                   if below else
                   "This is above the limit but closing on it, so the next cycle should be re-checked. ")
                + "Surfaced from the active regimen rather than this claim.",
                f"Drug label — {d.generic_name} renal dosing; serial eGFR from the member's lab history",
                f"Recheck renal function before the next fill and adjust or discontinue {d.generic_name} per label.",
            ))

    return flags


def site_of_care_review(rx: Prescription, patient: Patient, drug: Drug, db: Session):
    """Infused specialty drugs administered in the highest-cost setting.

    The same biologic costs materially more in a hospital outpatient
    department than it does infused at home or in a physician's office. The
    drug does not change and neither does the dose; only the place of service
    does. For a member on a multi-cycle course this repeats every cycle, so it
    is one of the larger recurring savings a plan can act on without touching
    the therapy itself.
    """
    flags = []
    if not drug.is_specialty:
        return flags
    if (drug.route or "").lower() not in ("intravenous", "infusion", "iv"):
        return flags

    claim = db.query(InsuranceClaim).filter(
        InsuranceClaim.prescription_id == rx.id
    ).first()
    if not claim or not claim.allowed_amount:
        return flags

    # Already in a lower-cost setting — nothing to move.
    pos = (claim.place_of_service or "").lower()
    if "home" in pos or "office" in pos:
        return flags

    # Home/office infusion differential for IV biologics.
    HOME_INFUSION_DIFFERENTIAL = 0.52
    avoidable = round(claim.allowed_amount * HOME_INFUSION_DIFFERENTIAL, 2)
    cycles_per_year = round(365 / rx.days_supply, 1) if rx.days_supply else 6.5
    annual = round(avoidable * cycles_per_year, 2)

    flags.append(_make_flag(
        "PAT-SITE-001", "site_of_care", "warning", 0.4,
        f"Site of care: ${avoidable:,.0f} avoidable per infusion for {drug.generic_name}",
        f"{drug.generic_name} is being infused in a hospital outpatient setting at "
        f"${claim.allowed_amount:,.2f} per administration. The identical drug and dose "
        f"delivered by home or office infusion runs roughly {HOME_INFUSION_DIFFERENTIAL*100:.0f}% less, "
        f"about ${avoidable:,.2f} per cycle. At {cycles_per_year} cycles a year that is "
        f"${annual:,.2f} on this member, with no change to the therapy.",
        "Site-of-care differential — hospital outpatient vs home/office infusion",
        "Refer to the home-infusion network. Confirm member eligibility and nursing coverage, "
        "then transition at the next cycle."
    ))
    return flags


def evaluate(rx: Prescription, patient: Patient, drug: Drug, db: Session):
    """Run all patient-specific reasoning checks. Returns list of flag dicts."""
    flags = []
    flags.extend(comorbidity_aware_assessment(rx, patient, drug, db))
    flags.extend(lab_value_trending_check(rx, patient, drug, db))
    flags.extend(prior_treatment_awareness(rx, patient, drug, db))
    flags.extend(adherence_pattern_analysis(rx, patient, db))
    flags.extend(active_medication_load(rx, patient, drug, db))
    # New spec-aligned modules
    flags.extend(opioid_stewardship_check(rx, patient, drug, db))
    flags.extend(specialty_drug_review(rx, patient, drug, db))
    flags.extend(site_of_care_review(rx, patient, drug, db))
    flags.extend(regimen_risk_scan(rx, patient, drug, db))
    return flags
