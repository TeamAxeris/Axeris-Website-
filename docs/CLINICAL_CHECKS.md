# Axeris Clinical Checks — Complete Reference (v8, April 2026)

**All 24 numbered clinical safety checks** with FDA/CDC/CPIC evidence sources, trigger conditions, and suggested actions.

---

## Overview

| Category | Checks | Engine | Purpose |
|----------|--------|--------|---------|
| **A: Drug-Drug Interactions** | 1–6 | Rules | Contraindicated combinations, stacking risks |
| **B: Dose Appropriateness** | 7–10 | Rules | Organ function, age, dose range validation |
| **C: Patient-Specific Contraindications** | 11–16 | Rules + v8 | Allergies, diagnoses, PGx, REMS |
| **D: Therapeutic Appropriateness** | 17–19 | Rules + ML | Duplication, step therapy, alternatives |
| **E: Opioid-Specific** | 20–22 | Patient + ML | MME, naloxone, early refill |
| **F: Prescriber Pattern / Fraud** | 23–24 | ML | Outlier detection, network clustering |
| **Foundational** | — | Rules | Excluded provider screening (hard stop) |

---

## Category A: Drug-Drug Interactions (Checks 1–6)

### Check 1: Contraindicated DDI (Absolute)

**Rule ID:** `RULE-DDI-001`

**Trigger Condition:**
- Prescribed drug + any active patient medication = contraindicated interaction (severity = **major**)

**Data Source:**
- `DrugInteraction` table (pre-populated with ~40 pairs)
- Cross-reference `Prescription.drug_id` against active prescriptions for patient

**Clinical Significance:**
- Absolute contraindication per FDA/pharmacology guidelines
- High risk of serious adverse event (e.g., warfarin + NSAIDs → GI bleed)

**Evidence Sources:**
- FDA Drug Safety Communications
- Drug Interaction Database (e.g., Lexicomp, Micromedex)
- Published contraindication lists

**Suggested Action:**
- **DO NOT DISPENSE**
- Select alternative from different drug class
- If continuation clinically justified, obtain provider documentation

**Example:**
- Warfarin + NSAIDs (major bleeding risk)
- Linezolid + MAOI (serotonin syndrome)
- Methotrexate + NSAIDs (renal toxicity)

---

### Check 2: Major-Severity DDI

**Rule ID:** `RULE-DDI-002`

**Trigger Condition:**
- Prescribed drug + active medication = **major-severity** interaction (but not absolute contraindication)

**Data Source:**
- `DrugInteraction.severity = "major"`

**Clinical Significance:**
- Significant risk; requires monitoring or dose adjustment
- May be prescribable if clinical benefit outweighs risk

**Evidence Sources:**
- FDA Drug Safety Communications
- Clinical pharmacology databases

**Suggested Action:**
- Document clinical justification
- Recommend dose adjustment or frequency change
- Monitor for interaction effects

**Example:**
- ACE inhibitor + potassium-sparing diuretic (hyperkalemia risk)
- Simvastatin + fibrate (myopathy risk)
- Theophylline + fluoroquinolone (toxicity risk)

---

### Check 3: Cumulative Moderate Interactions

**Rule ID:** `RULE-MCUM-001`

**Trigger Condition:**
- Patient has ≥3 **moderate-severity** drug-drug interactions active simultaneously

**Data Source:**
- Count distinct `(drug_a, drug_b)` pairs with `DrugInteraction.severity = "moderate"`

**Clinical Significance:**
- Individual interactions may be manageable, but cumulative burden increases ADE risk
- Reflects polypharmacy complexity

**Evidence Sources:**
- Polypharmacy risk management guidelines
- Clinical practice guidelines (AGS, ACCP)

**Suggested Action:**
- Comprehensive medication review (CMR)
- Deprescribe low-value or duplicative agents
- Consider alternative regimens with lower interaction burden

**Example:**
- Patient on: SSRI + tramadol + linezolid
- Each pair has moderate interaction; combined effect amplified

---

### Check 4: QT Prolongation Stacking

**Rule ID:** `RULE-QT-001`

**Trigger Condition:**
- Prescribed drug has QT-prolonging potential (Drug.qt_prolongation_risk = True)
- AND patient already has ≥1 active QT-prolonging medication

**Data Source:**
- `Drug.qt_prolongation_risk` flag
- Compare against active `Prescription.drug_id` list

**Clinical Significance:**
- QT prolongation → Torsades de Pointes → sudden cardiac death
- Risk amplified by electrolyte abnormalities (hypokalemia, hypomagnesemia)
- FDA black-box warning when ≥2 agents concurrent

**Evidence Sources:**
- FDA Drug Safety Communications (QT prolongation warnings)
- CredibleMeds.org (curated QT drug database)
- Clinical pharmacology textbooks

**Severity by Count:**
- 2 QT agents: warning (moderate risk)
- ≥3 QT agents: critical (high risk)

**Suggested Action:**
- If possible, use alternative without QT risk
- If continuation necessary:
  - Obtain baseline ECG + electrolytes
  - Monitor QTc interval (especially after dose changes)
  - Educate patient on warning signs (palpitations, syncope, dyspnea)

**QT-Prolonging Drug Examples:**
- Antiarrhythmics: amiodarone, sotalol, dofetilide
- Antipsychotics: haloperidol, clozapine, ziprasidone
- Antibiotics: fluoroquinolones (levofloxacin), macrolides (azithromycin)
- Antiemetics: ondansetron, metoclopramide
- Antihistamines: terfenadine, astemizole

---

### Check 5: Serotonin Syndrome Risk

**Rule ID:** `RULE-SERO-001`

**Trigger Condition:**
- Prescribed drug is serotonergic (Drug.serotonergic = True)
- AND patient has ≥1 active serotonergic medication

**Data Source:**
- `Drug.serotonergic` flag
- Active prescription list

**Clinical Significance:**
- Excessive serotonergic activity → serotonin syndrome (potentially fatal)
- Presents with: agitation, hyperthermia, clonus, autonomic instability, altered consciousness

**Evidence Sources:**
- FDA Drug Safety Communications
- Toxicology literature (Hunter Criteria for serotonin syndrome diagnosis)

**Severity by Count:**
- 2 serotonergic agents: warning (moderate risk)
- ≥3 serotonergic agents: critical (high risk)

**Suggested Action:**
- Avoid concurrent serotonergic agents if possible
- If necessary, use lowest effective doses + close monitoring
- Patient/caregiver education on warning signs
- Consider non-serotonergic alternative

**Serotonergic Drug Examples:**
- SSRIs: fluoxetine, sertraline, paroxetine, citalopram
- SNRIs: venlafaxine, duloxetine, desvenlafaxine
- Tricyclic antidepressants: amitriptyline, nortriptyline
- Tramadol (opioid + serotonin reuptake inhibition)
- MAOIs: phenelzine, tranylcypromine
- Linezolid (antibiotic with MAOI activity)
- Selegiline (Parkinson's; MAOI)

---

### Check 6: CNS Depression Stacking

**Rule ID:** `RULE-CNS-001`

**Trigger Condition:**
- Patient has active opioid prescription
- AND has concurrent benzodiazepine, muscle relaxant, or other CNS depressant

**Data Source:**
- `Drug.is_opioid = True` + `Drug.therapeutic_category IN ["benzodiazepine", "muscle relaxant", "sedative-hypnotic"]`

**Clinical Significance:**
- FDA **black-box warning** (2016)
- Opioid + benzodiazepine = 50% of opioid overdose deaths
- Risk: respiratory depression, over-sedation, addiction, death

**Evidence Sources:**
- FDA Black Box Warning (21 CFR 201.57(c)(1))
- CDC Opioid Prescribing Guidelines
- NIDA guidance

**Suggested Action:**
- **Avoid combination** if clinically possible
- If clinically necessary:
  - Use lowest effective doses
  - Prescribe naloxone rescue kit (intranasal 4mg, 2 doses)
  - Educate patient on overdose risk
  - Monitor closely (consider urine drug screen)
  - Document clinical justification
  - Arrange addiction medicine consultation

---

## Category B: Dose Appropriateness (Checks 7–10)

### Check 7: Renal Dose Adjustment

**Rule ID:** `RULE-RENAL-001` (contraindicated) / `RULE-RENAL-002` (warning)

**Trigger Conditions:**

**RULE-RENAL-001 (Critical):**
- Drug requires renal adjustment (Drug.renal_adjustment_required = True)
- AND patient eGFR < Drug.egfr_threshold
- Example: Drug.egfr_threshold = 30 mL/min; patient eGFR = 25

**RULE-RENAL-002 (Warning):**
- Drug requires renal adjustment
- AND patient eGFR = 30–60 (moderate impairment)

**Data Source:**
- `LabResult.test_name = "eGFR"` (most recent)
- `Drug.egfr_threshold`, `Drug.renal_adjustment_required`

**Clinical Significance:**
- Impaired renal clearance → drug accumulation → toxicity
- Many drugs (aminoglycosides, ACE inhibitors, NSAIDs, etc.) require dose reduction in renal disease

**Evidence Sources:**
- Drug label (FDA-approved prescribing information)
- Kidney Disease: Improving Global Outcomes (KDIGO)
- Nephrology textbooks (e.g., Brenner & Rector's The Kidney)

**Suggested Action (RENAL-001):**
- **CONTRAINDICATED at current eGFR**
- Select alternative not requiring renal adjustment, OR
- Dose reduction per label

**Suggested Action (RENAL-002):**
- Review dosing against renal dosing guidelines
- Consider dose reduction
- Plan lab recheck in 4–6 weeks

**Example Drugs:**
- Aminoglycosides (gentamicin): eGFR_threshold = 50
- ACE inhibitors (lisinopril): eGFR_threshold = 30
- NSAIDs: eGFR_threshold = 60 (contraindicated in CKD)
- Metformin: eGFR_threshold = 30 (now more permissive, but still flagged <30)

---

### Check 8: Hepatic Dose Adjustment

**Rule ID:** `RULE-HEPAT-001`

**Trigger Condition:**
- Drug requires hepatic adjustment (Drug.hepatic_adjustment_required = True)
- AND patient ALT > 120 U/L (>3x upper limit normal, suggesting significant impairment)

**Data Source:**
- `LabResult.test_name = "ALT"` (most recent)
- `Drug.hepatic_adjustment_required`

**Clinical Significance:**
- Impaired hepatic metabolism → drug accumulation → toxicity
- Elevated transaminases suggest hepatocellular injury; increased risk with hepatotoxic drugs

**Evidence Sources:**
- Drug label
- Hepatology guidelines

**Suggested Action:**
- Reduce dose or discontinue hepatotoxic agents
- Monitor LFTs closely
- Consider alternative with less hepatic metabolism

**Example Drugs:**
- Statins (atorvastatin): avoid if ALT >3x ULN
- Acetaminophen: dose reduction needed
- Isoniazid: monitor LFTs; D/C if ALT >120

---

### Check 9: Age-Based Dosing

**Rule ID:** `RULE-AGE-001` (geriatric) / `RULE-AGE-002` (pediatric)

**Trigger Conditions:**

**RULE-AGE-001 (Geriatric, age ≥65):**
- Drug is in high-risk class (opioid, benzodiazepine, NSAID, SSRI, etc.)
- AND prescribed dose > recommended geriatric max (~75% of standard adult max)

**RULE-AGE-002 (Pediatric, age <18):**
- Prescribed dose ≥80% of adult max
- AND weight-based dosing not documented

**Data Source:**
- Patient.date_of_birth (calculate age)
- Drug.max_daily_dose_mg
- Drug.drug_class

**Clinical Significance:**
- **Geriatric:** Altered pharmacokinetics (↓ renal/hepatic clearance), increased sensitivity, ↑ fall risk, cognitive impairment
- **Pediatric:** Weight-based dosing required; adult doses inappropriate

**Evidence Sources:**
- AGS Beers Criteria 2023 (JAGS 71(7):2052-2081, DOI: 10.1111/jgs.18372)
- FDA Pediatric labeling (21 CFR 201.56)

**Suggested Action (GERIATRIC):**
- Start at lowest effective dose
- Titrate slowly (longer intervals than adults)
- Maximum: ~75% of standard adult dose
- Document clinical justification if standard dose used

**Suggested Action (PEDIATRIC):**
- Use weight-based dosing per label
- Consider pediatric formulations
- Verify dose with pharmacist

**High-Risk Geriatric Classes:**
- Opioid analgesics
- Benzodiazepines
- NSAIDs
- Gabapentinoids
- SSRIs/SNRIs
- ACE inhibitors
- Beta-blockers

---

### Check 10: Maximum Daily Dose Exceeded

**Rule ID:** `RULE-DOSE-001` (exceeds max) / `RULE-DOSE-002` (subtherapeutic)

**Trigger Conditions:**

**RULE-DOSE-001 (Critical):**
- Daily dose = Rx.dose_mg × frequency_multiplier > Drug.max_daily_dose_mg

**RULE-DOSE-002 (Info):**
- Daily dose < Drug.min_daily_dose_mg

**Data Source:**
- Rx.dose_mg, Rx.frequency
- Drug.max_daily_dose_mg, Drug.min_daily_dose_mg
- Frequency multiplier: QD=1, BID=2, TID=3, QID=4, Q6H=4, etc.

**Clinical Significance:**
- Overdose → toxicity, ADE
- Underdose → therapeutic failure, disease progression

**Evidence Sources:**
- Drug label (FDA-approved prescribing info)
- Formulary guidelines

**Suggested Action (DOSE-001):**
- Reduce to within recommended max
- Or provide clinical justification

**Suggested Action (DOSE-002):**
- Verify titration plan if starting dose
- Otherwise, consider dose increase

**Example:**
- Metoprolol: max 190 mg/day
  - Rx: 100 mg BID = 200 mg/day → **EXCEEDS MAX** (RULE-DOSE-001)
  - Action: Reduce to 100 mg QD or 80 mg BID

---

## Category C: Patient-Specific Contraindications (Checks 11–16)

### Check 11: Allergy Cross-Reactivity

**Rule ID:** `RULE-ALG-001`

**Trigger Condition:**
- Patient has documented allergy to drug A
- AND prescribed drug B belongs to same cross-reactivity group

**Data Source:**
- `Allergy.cross_reactivity_group` + `Drug.cross_reactivity_groups`

**Clinical Significance:**
- Cross-reactivity = immune response to structurally similar drugs
- Risk of anaphylaxis, urticaria, Stevens-Johnson syndrome

**Evidence Sources:**
- Allergen cross-reactivity databases (e.g., Micromedex, UpToDate)
- Published literature on drug allergy cross-reactivity

**Severity:**
- Severe allergy (anaphylaxis, SJS) → critical weight 1.0
- Moderate allergy → warning weight 0.7

**Suggested Action:**
- **DO NOT DISPENSE**
- Select alternative from different drug class
- If no alternative available, document clinical justification + consider desensitization (specialist)

**Common Cross-Reactivity Groups:**
- Penicillins ↔ Cephalosporins (10–3% cross-reactivity)
- NSAIDs (cross-reactivity within class)
- Sulfonamide-containing drugs
- Carbapenem antibiotics

---

### Check 12: Drug-Diagnosis Mismatch

**Rule ID:** `RULE-DX-001`

**Trigger Condition:**
- Prescribed drug's approved indications (Drug.approved_indications) do NOT match any active patient diagnosis

**Data Source:**
- `Drug.approved_indications` (JSON list)
- `Diagnosis.icd10_code` (active diagnoses only)

**Clinical Significance:**
- Off-label use without documented clinical rationale
- Potential waste / inappropriate prescribing

**Evidence Sources:**
- FDA-approved drug indications (DailyMed, drug label)
- Clinical guidelines

**Suggested Action:**
- Verify diagnosis supports prescription
- Request clinical justification from prescriber
- Recommend alternative if no clinical rationale

**Example:**
- Atorvastatin prescribed for patient with no hyperlipidemia, CAD, or stroke history
- Action: Clarify indication; may be appropriate for primary prevention, but requires documentation

---

### Check 13: Beers Criteria / Geriatric Safety

**Rule ID:** `RULE-BEERS-001`

**Trigger Condition:**
- Patient age ≥65 years
- AND prescribed drug is listed in AGS Beers Criteria 2023 (Drug.beers_criteria = True)

**Data Source:**
- Patient.date_of_birth
- Drug.beers_criteria flag + Drug.drug_class

**Clinical Significance:**
- Potentially inappropriate medications in older adults
- Higher risk of falls, cognitive impairment, GI bleeding, cardiovascular events, hyponatremia, etc.

**Evidence Sources:**
- **AGS Beers Criteria 2023**
  - Published: JAGS 71(7):2052-2081
  - DOI: 10.1111/jgs.18372
  - Journal: Journal of the American Geriatrics Society

**Beers Categories Covered:**
- Benzodiazepines (fall risk, delirium, cognitive decline)
- NSAIDs (GI bleeding, renal impairment, cardiovascular risk)
- Cardiac glycosides (narrow therapeutic index, increased toxicity)
- Tricyclic antidepressants (anticholinergic effects)
- Certain antihistamines
- Barbiturates
- Muscle relaxants

**Suggested Action:**
- Consider safer alternative (specified in Beers Criteria)
- If continuation necessary, document clinical justification
- Example: Use acetaminophen instead of NSAIDs for pain management

---

### Check 14: Pregnancy & Lactation Safety

**Rule ID:** `RULE-PREG-001`

**Trigger Condition:**
- Patient: female, age 12–55 (childbearing potential)
- AND prescribed drug has pregnancy risk category X or D

**Data Source:**
- Patient.gender, Patient.date_of_birth
- Drug.pregnancy_risk (FDA category: X, D, C, B, A)

**Clinical Significance:**
- **Category X:** Contraindicated in pregnancy (positive human fetal risk)
- **Category D:** Positive human fetal risk; use only if benefit justifies risk
- Teratogenicity, miscarriage, IUGR, neonatal complications

**Evidence Sources:**
- **FDA Pregnancy and Lactation Labeling Rule (PLLR)**
  - 21 CFR 201.57(c)(9)
  - Replaces old letter categories with narrative labeling
- DailyMed, drug labels

**Suggested Action (Category X):**
- **CONTRAINDICATED in pregnancy**
- Verify pregnancy status
- If pregnant or planning pregnancy, select safer alternative
- Consider birth control counseling

**Suggested Action (Category D):**
- Verify pregnancy status before initiation
- If pregnant, document informed consent discussion
- Consider safer alternative if available

**Examples:**
- Category X: isotretinoin (Accutane), finasteride (Propecia), misoprostol
- Category D: ACE inhibitors (3rd trimester), warfarin (1st trimester), tetracyclines

---

### Check 15: Pharmacogenomics (CPIC Level A) — v8

**Rule ID:** `RULE-PGX-001`

**Trigger Condition:**
- Drug requires PGx assessment (Drug.pgx_gene ≠ null)
- AND patient has structured PGx test result (PGxResult found)
- AND patient's phenotype matches risk phenotype (Drug.pgx_risk_phenotype)

**Data Source:**
- `PGxResult.gene`, `PGxResult.phenotype`, `PGxResult.diplotype`
- `Drug.pgx_gene`, `Drug.pgx_risk_phenotype`, `Drug.pgx_clinical_action`

**Clinical Significance:**
- CPIC Level A = actionable evidence; FDA black-box warnings
- Genetic variants affect drug metabolism → efficacy/toxicity

**Evidence Sources:**
- **CPIC Guidelines** (cpicpgx.org)
- FDA pharmacogenomics labeling

**CPIC Level A Genes & Drug Examples:**

| Gene | Risk Phenotype | Drug | Clinical Action | Evidence |
|------|---|---|---|---|
| **CYP2D6** | Poor Metabolizer (PM) | Codeine | Avoid (no morphine conversion; no analgesia) | CPIC A |
| **CYP2D6** | Ultrarapid Metabolizer | Tramadol, venlafaxine | Dose increase or alternative | CPIC A |
| **CYP2C19** | Poor Metabolizer | Clopidogrel | Avoid (↓ efficacy; FDA black box) | CPIC A |
| **CYP2C19** | Poor Metabolizer | Omeprazole, pantoprazole | Alternative (likely dose increase needed for pH control) | CPIC A |
| **CYP2C9** | Poor Metabolizer | Warfarin | Dose reduction required; intensive INR monitoring | CPIC A |
| **SLCO1B1** | Loss-of-function | Simvastatin >40 mg | Dose reduction or alternative (myopathy risk) | CPIC A |
| **HLA-B*57:01** | Positive | Abacavir | Contraindicated (fatal hypersensitivity) | CPIC A |
| **TPMT** | Poor Metabolizer | Azathioprine, 6-mercaptopurine | Avoid or significant dose reduction (bone marrow suppression) | CPIC A |
| **TPMT** | Intermediate Metabolizer | Thiopurines | Dose reduction (10–50% standard) | CPIC A |
| **DPYD** | Poor Metabolizer | Fluoropyrimidines (5-FU, capecitabine) | Avoid or significant dose reduction (severe toxicity) | CPIC A |

**Clinical Action Mapping:**
- **Avoid / Contraindicated** → Critical severity (0.95), hard hold
- **Dose Reduce** → Warning severity (0.7)
- **Alternative** → Warning severity (0.7)
- **Monitor** → Info severity (0.5)

**Suggested Action:**
- Recommended action per CPIC guideline
- Consider PGx-guided alternative agent
- If continuing with risk phenotype, dose modification + monitoring
- Document clinical justification

---

### Check 16: REMS Compliance Verification — v8

**Rule ID:** `RULE-REMS-001` (enrollment missing) / `RULE-REMS-002` (monitoring overdue)

**Trigger Conditions:**

**RULE-REMS-001 (Critical):**
- Drug has REMS program requiring enrollment (Drug.rems_program ≠ null)
- AND no active REMSEnrollment found (REMSEnrollment.is_active = False or null)

**RULE-REMS-002 (Warning):**
- Patient enrolled in REMS program
- AND last_monitoring_date > max_allowed_days (typically 30 days for high-risk programs)

**Data Source:**
- `Drug.rems_program` (e.g., "iPLEDGE", "CLOZAPINE_REMS")
- `REMSEnrollment.patient_id`, `REMSEnrollment.rems_program`, `REMSEnrollment.is_active`, `REMSEnrollment.last_monitoring_date`

**Clinical Significance:**
- FDA REMS = Risk Evaluation & Mitigation Strategy (21 USC 355-1)
- ETASU = Elements to Assure Safe Use (enrollment + monitoring requirements)
- Non-compliance = hard-stop dispensing violation

**Evidence Sources:**
- FDA REMS Database (DailyMed)
- FDA Final REMS (https://www.fda.gov/drugs/risk-evaluation-and-mitigation-strategy-rems)

**REMS Programs:**

| Program | Drug | ETASU Requirement | Max Monitoring Interval |
|---------|------|-------------------|------------------------|
| **iPLEDGE** | Isotretinoin (Accutane) | Pregnancy testing (females), informed consent | 30 days |
| **CLOZAPINE REMS** | Clozapine (Clozaril) | Absolute neutrophil count (ANC) monitoring | 30 days (weekly × 6, then biweekly × 6, then monthly) |
| **TIRF REMS** | Transmucosal immediate-release fentanyl (TIRF) | Prescriber training, patient counseling | 90 days |
| **SODIUM OXYBATE REMS** | Sodium oxybate (Xyrem, Xywav) | Central nervous system depressant education, signed consent | 90 days |

**Suggested Action (REMS-001):**
- **HARD STOP: DO NOT DISPENSE**
- Verify REMS enrollment status (contact REMS administrator if uncertain)
- Confirm patient completed all required baseline testing/counseling
- Enroll patient before dispensing

**Suggested Action (REMS-002):**
- Schedule REMS monitoring (e.g., ANC draw for clozapine)
- Do not dispense until monitoring complete
- Notify prescriber of monitoring requirement

---

## Category D: Therapeutic Appropriateness (Checks 17–19)

### Check 17: Therapeutic Duplication

**Rule ID:** `RULE-DUP-001` (same class) / `RULE-DUP-002` (same category)

**Trigger Conditions:**

**RULE-DUP-001 (Critical):**
- Patient has active prescription for drug in same drug class (Drug.drug_class)
- Example: Two SSRIs, two beta-blockers

**RULE-DUP-002 (Warning):**
- Patient has active prescription in same therapeutic category (Drug.therapeutic_category)
- Example: SSRI + SNRI (both antidepressants, different class)

**Data Source:**
- `Drug.drug_class`, `Drug.therapeutic_category`
- Active prescriptions for patient

**Clinical Significance:**
- Duplicate therapy → increased ADE risk, unnecessary cost, poor compliance
- May be appropriate in limited scenarios (e.g., dual antiplatelet therapy post-MI), but requires documentation

**Evidence Sources:**
- Polypharmacy reduction guidelines
- Medication management best practices

**Suggested Action:**
- Discontinue one agent or provide clinical justification
- Exception: Intentional combination therapy (e.g., dual statins for familial hypercholesterolemia)

**Example:**
- Patient on fluoxetine 20 mg QD + sertraline 50 mg QD
- Action: Consolidate to single SSRI; avoids additive SIADH risk, better compliance

---

### Check 18: Step Therapy Compliance

**Rule ID:** `PAT-PRIOR-001`

**Trigger Condition:**
- Formulary requires step therapy (e.g., "try generic metformin before brand-name alternatives")
- AND patient has NOT previously tried required step agent
- OR step agent failed clinically

**Data Source:**
- `TherapeuticEquivalence` table (step therapy rules)
- Prescription history (prior try of step agent)

**Clinical Significance:**
- Step therapy reduces cost while ensuring clinical safety
- Bypassing steps → unnecessary expense

**Suggested Action:**
- Prescriber must document:
  - Prior trial of step agent (drug name, dose, duration, why it failed), OR
  - Clinical contraindication to step agent (allergy, interaction, etc.)
- If no documentation, deny claim or request PA

---

### Check 19: Generic Substitution & Therapeutic Alternatives

**Rule ID:** `ML-COST-001`

**Trigger Condition:**
- Brand-name drug prescribed
- AND generic or biosimilar equivalent available (TherapeuticEquivalence found)
- AND cost savings ≥20%

**Data Source:**
- `TherapeuticEquivalence` table
- NADAC drug pricing

**Clinical Significance:**
- Generic/biosimilar alternatives: same efficacy, lower cost
- Supports cost-containment without compromising care

**Evidence Sources:**
- FDA Orange Book (generic drug approvals)
- NADAC pricing (National Average Drug Acquisition Cost)

**Suggested Action:**
- Recommend generic equivalent
- If brand necessary, document clinical reason (e.g., tolerability, absorption issues)
- Provide cost savings estimate to patient

**Example:**
- Atorvastatin 40 mg available as generic (cost $15/month)
- vs. brand name Lipitor (cost $120/month)
- Savings: $105/month (87% reduction)

---

## Category E: Opioid-Specific Checks (Checks 20–22)

### Check 20: MME Threshold Breach

**Rule ID:** `PAT-MME-001`

**Trigger Condition:**
- Cumulative daily morphine milligram equivalents (MME) from all active opioid prescriptions ≥50/day

**Data Source:**
- Active opioid prescriptions + Drug.mme_conversion_factor
- Calculation: daily_dose_mg × frequency_multiplier × mme_factor = daily_MME

**Clinical Significance:**
- **CDC 2022 Opioid Guideline:** ≥50 MME/day associated with overdose risk
- Recommendation 8 = naloxone co-prescribing required

**Evidence Sources:**
- **CDC Opioid Prescribing Guidelines** (MMWR 2022;71(RR-3):1-95)

**MME Conversion Factors:**
- Morphine: 1.0
- Codeine: 0.15
- Hydrocodone: 1.0
- Oxycodone: 1.5
- Fentanyl (patch): 2.4 per mcg/hour
- Methadone: 3.0 (variable, complex dosing)

**Example Calculation:**
- Patient on:
  - Oxycodone 10 mg TID = 30 mg/day × 1.5 = 45 MME/day
  - Tramadol 50 mg BID = 100 mg/day × 0.1 = 10 MME/day
  - **Total: 55 MME/day** → ≥50 threshold → **PAT-MME-001**

**Suggested Action:**
- Flag for naloxone co-prescribing (Check 21)
- Review if MME can be reduced
- Monitor for overdose risk

---

### Check 21: Naloxone Co-Prescribing Absence — v8

**Rule ID:** `RULE-NALOX-001`

**Trigger Conditions:**
- Patient meets one of:
  1. High MME: Cumulative opioid MME ≥50/day (from Check 20)
  2. Opioid + CNS depressant: Active opioid + active benzodiazepine/muscle relaxant/sedative
- AND no naloxone prescription in past 365 days
- AND no palliative care/hospice diagnosis (exception: end-of-life care)

**Data Source:**
- `Prescription.is_opioid` + mme calculation
- `Drug.therapeutic_category IN ["benzodiazepine", "muscle relaxant"]`
- `Drug.is_naloxone`, prescription date
- `Diagnosis.icd10_code` (palliative: Z51.5, Z51.1; cancer: C prefix)

**Clinical Significance:**
- **CDC 2022 Opioid Guideline Recommendation 8:** Naloxone co-prescribing reduces overdose mortality
- Opioid + benzodiazepine = FDA black-box warning (50% of opioid OD deaths)
- Naloxone (Narcan) = opioid antagonist; rescues respiratory depression if co-administered

**Evidence Sources:**
- **CDC 2022 Opioid Guideline** (MMWR 2022;71(RR-3):1-95)
- FDA Black Box Warning (opioid + CNS depressant)
- NIDA guidance

**Exception:** Palliative care, hospice, cancer pain (documented)

**Suggested Action:**
- Co-prescribe naloxone (intranasal spray, 4 mg, 2 doses)
- Educate patient + caregiver:
  - How to recognize overdose (loss of consciousness, slow/no breathing)
  - How to administer naloxone
  - Call 911 after naloxone use
  - Overdose risk awareness
- Document offer in patient chart (if patient declines, note reason)

**Naloxone Products:**
- Narcan (intranasal spray, 4 mg, 1 or 2-dose kits)
- Kloxxado (intranasal spray, 8 mg)
- Evzio (autoinjector, 0.4 mg)

---

### Check 22: Early Refill / Overlapping Opioids

**Rule ID:** `ML-REFILL-001`

**Trigger Condition:**
- Patient has multiple opioid prescriptions with overlapping coverage
- Example: Oxycodone filled on day 1 (30-day supply), refilled on day 15 (early refill)

**Data Source:**
- Prescription.date_filled, Prescription.days_supply
- Calculate next expected fill date: date_filled + days_supply
- If new refill before expected date, flag as early refill

**Clinical Significance:**
- Early refill pattern suggestive of:
  - Higher consumption (drug-seeking behavior, misuse)
  - Diversion (selling excess pills)
  - Genuine clinical need (dose escalation), but requires documentation

**Evidence Sources:**
- Claims analysis, pharmacy dispensing data
- PDMP (Prescription Drug Monitoring Program) data

**EARLY_REFILL_DAYS Threshold:** Default 7 days (configurable in config.py)

**Example:**
- Oxycodone 30 tablets, QID dosing = 30-day supply
- Expected fill: day 1 + 30 = day 31
- Refill requested on day 20 = **EARLY (11 days early)**

**Suggested Action:**
- Contact prescriber for clinical justification
- Check PDMP for doctor-shopping behavior
- Consider claim denial pending clarification
- If pattern persistent, refer for medication management program

---

## Category F: Prescriber Pattern / ML (Checks 23–24)

### Check 23: Prescriber Outlier Detection

**Rule ID:** `ML-PRV-001`

**Trigger Condition:**
- Prescriber's volume of controlled substance prescriptions is **≥2.0 standard deviations above peer mean**

**Data Source:**
- Provider.specialty (peer cohort)
- Count controlled substance prescriptions (schedule II, III, IV) per provider
- Calculate Z-score: (provider_volume − peer_mean) / peer_std

**Clinical Significance:**
- High volume of controlled substances may indicate:
  - Appropriate pain management practice (legitimate)
  - Pill mill operation (illegitimate)
  - Needs further investigation

**Evidence Sources:**
- Prescribing pattern analysis
- Medical board reviews

**CONTROLLED_SUBSTANCE_VOLUME_ZSCORE Threshold:** Default 2.0 (configurable)

**Suggested Action:**
- Flag for peer review / medical board investigation
- Check other anomalies (Check 24, PDMP data)
- Cross-reference with excluded provider list (Check: RULE-EXCL-001)
- If confirmed outlier, consider claim denial pending justification

---

### Check 24: Pill Mill / Fraud Network Detection

**Rule ID:** `ML-FRAUD-001`

**Trigger Condition:**
- DBSCAN clustering detects anomalous prescriber-pharmacy-patient network
- Example: Same prescriber + pharmacy + patient triplets appearing unusually frequently

**Data Source:**
- DBSCAN model clustering (runs at startup)
- Triplet: (prescriber_id, pharmacy_id, patient_id)
- Jaccard distance metric

**Clinical Significance:**
- Pill mill pattern:
  - Same provider writing many prescriptions
  - Same pharmacy filling them
  - Patients are "runners" (not genuine patients of provider)
  - High-value opioid/benzo claims
- Fraud indicators: High cost, early refills, multiple patients with similar patterns

**Evidence Sources:**
- Network anomaly detection
- DEA pill mill investigations
- Published case studies

**Suggested Action:**
- **ESCALATE** to TPA fraud team / law enforcement
- Refer to DEA if high-confidence fraud
- Place provider on watch list
- Block future claims from this prescriber-pharmacy pair
- Consider state medical board notification

---

## Foundational Layer: Excluded Provider Screening

### Excluded Provider Check

**Rule ID:** `RULE-EXCL-001`

**Trigger Condition:**
- Prescriber NPI matches entry in `ExcludedProvider` table
- OR Provider.is_excluded = True

**Data Source:**
- `Provider.npi` + `ExcludedProvider` table
- `Provider.is_excluded` flag (synced from LEIE/SAM.gov)
- `ExcludedProvider.reinstatement_date` (if date > today, provider still excluded)

**Clinical Significance:**
- **Hard stop:** Claims from excluded providers must NOT be paid
- HHS-OIG LEIE: List of Excluded Individuals & Entities
- SAM.gov: System for Award Management (federal procurement/benefits exclusions)

**Exclusion Types:**
- **Mandatory:** Medicare fraud, patient harm, illegal activity
- **Permissive:** State board discipline, default on judgments, etc.

**Evidence Sources:**
- **HHS-OIG LEIE** (oig.hhs.gov/exclusions)
- **SAM.gov** (sam.gov)
- State medical boards

**Suggested Action (Critical, weight 1.0):**
- **BLOCK PAYMENT immediately**
- Notify TPA fraud team
- Coordinate with PBM to apply prospective claim edits on this NPI
- Report to CMS if Medicare claim
- Investigate provider network for other excluded individuals

**Example Exclusion Reasons:**
- "1128(a)(1)" = Medicare fraud conviction
- "Default on judgment" = Malpractice settlement default
- "Loss of medical license" = State board action
- "Controlled substance violation" = DEA action

---

## Summary: Flag Severity & Weights

| Severity | Weight Range | Color | Action |
|----------|--------------|-------|--------|
| **critical** | 0.8–1.0 | RED | Hard stop; escalate |
| **warning** | 0.4–0.7 | YELLOW | Soft hold (24h SLA); review |
| **info** | 0.1–0.3 | GREEN | Monitor; informational |

---

## Testing & Validation

**Test Scenarios (10 HIGH-PRIORITY):**

1. **Warfarin + NSAID** → Check 1 (contraindicated DDI)
2. **Codeine + CYP2D6 PM** → Check 15 (PGx)
3. **Oxycodone 80 mg TID + no naloxone** → Check 21 (naloxone)
4. **Isotretinoin + pregnancy** → Check 14 & 16 (pregnancy + REMS)
5. **Patient age 72 + flurazepam** → Check 13 (Beers)
6. **Lisinopril + eGFR 25** → Check 7 (renal)
7. **Oxycodone + benzodiazepine** → Check 6 (CNS stacking)
8. **Fluoxetine + tramadol + linezolid** → Check 5 (serotonin)
9. **Prescriber on LEIE list** → Check: RULE-EXCL-001 (excluded)
10. **3+ moderate DDIs concurrent** → Check 3 (cumulative)

---

## References & Standards

- **FDA:** https://www.fda.gov/drugs
- **DailyMed:** https://dailymed.nlm.nih.gov
- **CPIC:** https://cpicpgx.org
- **Beers Criteria 2023:** JAGS 71(7):2052-2081, DOI: 10.1111/jgs.18372
- **CDC Opioid Guideline:** MMWR 2022;71(RR-3):1-95
- **HHS-OIG LEIE:** https://oig.hhs.gov/exclusions
- **SAM.gov:** https://sam.gov
- **KDIGO:** https://kdigo.org
- **UpToDate:** https://www.uptodate.com (subscription)

---

**Axeris Clinical Checks v0.8** — Spec v8, April 2026
**Last Updated:** April 2026
**Maintenance:** Review annually; update with FDA, CDC, CPIC guideline changes
