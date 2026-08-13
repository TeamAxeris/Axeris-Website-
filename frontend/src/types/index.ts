export type FlagColor = "GREEN" | "YELLOW" | "RED";
export type PrescriptionStatus = "pending" | "approved" | "denied" | "review";
export type FlagSeverity = "critical" | "warning" | "info";

export interface Flag {
  flag_id: string;
  category: string;
  severity: FlagSeverity;
  weight: number;
  title: string;
  description: string;
  evidence_source: string;
  suggested_action: string;
  engine: "rules" | "ml" | "patient";
}

export interface Alternative {
  drug_id: string;
  generic_name: string;
  brand_name?: string;
  equivalence_type: string;
  dose_conversion: number;
  evidence_level: string;
  estimated_savings_pct: number;
  notes?: string;
}

export interface Diagnosis {
  icd10_code: string;
  description?: string;
  is_active: boolean;
}

export interface Allergy {
  allergen: string;
  reaction_type?: string;
  severity?: string;
}

export interface LabResult {
  test_name: string;
  value: number;
  unit?: string;
  date_collected?: string;
  is_abnormal: boolean;
}

export interface ActiveMedication {
  drug_id: string;
  drug_name: string;
  dose_mg: number;
  frequency: string;
  status: string;
}

export interface PatientContext {
  diagnoses: Diagnosis[];
  allergies: Allergy[];
  recent_labs: LabResult[];
  active_medications: ActiveMedication[];
}

export type Disposition = "APPROVE" | "REVIEW" | "FLAG";

export interface Prescription {
  id: string;
  patient_id: string;
  provider_id: string;
  drug_id: string;
  dose_mg: number;
  frequency: string;
  quantity: number;
  days_supply: number;
  refills_authorized: number;
  date_written?: string;
  flag_color?: FlagColor;
  risk_score?: number;
  flags?: Flag[];
  status: PrescriptionStatus;
  patient_name: string;
  provider_name: string;
  drug_name: string;
  // v8 fields
  disposition?: Disposition;
  hold_type?: "soft_hold" | "hard_hold" | null;
  sla_deadline?: string | null;
  operating_mode?: "TPA" | "PBA" | null;
  processing_time_ms?: number | null;
  // Truveta TDM MedicationRequest / MedicationDispense coding
  ndc11?: string | null;
  rxnorm_code?: string | null;
  sig?: string | null;
  route?: string | null;
}

export interface PGxResult {
  gene: string;
  phenotype: string;
  diplotype?: string;
  test_date?: string;
  cpic_level: string;
}

export interface REMSEnrollment {
  rems_program: string;
  enrollment_date?: string;
  is_active: boolean;
  last_monitoring_date?: string;
}

export interface PrescriptionDetail extends Prescription {
  alternatives: Alternative[];
  patient_context?: PatientContext;
  prescriber_info?: PrescriberInfo;
  polypharmacy_score?: number;
  titration_info?: Record<string, unknown>;
  // v8 detail
  pgx_results?: PGxResult[];
  rems_enrollments?: REMSEnrollment[];
  audit_trail?: Record<string, unknown>;
}

export interface Patient {
  id: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  gender?: string;
  // Truveta TDM Person / PersonAddress
  race?: string | null;
  ethnicity?: string | null;
  marital_status?: string | null;
  preferred_language?: string | null;
  state?: string | null;
  postal_code?: string | null;
  is_deceased?: boolean;
  active_diagnoses: Diagnosis[];
  allergy_count: number;
  active_medication_count: number;
  polypharmacy_risk_score?: number;
  adherence_score?: number;
  doctor_shopping_flag: boolean;
}

export interface EncounterEntry {
  id: string;
  encounter_class?: string | null;
  status?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  facility_name?: string | null;
  admit_source?: string | null;
  discharge_disposition?: string | null;
}

export interface MedicationTimelineEntry {
  drug_name: string;
  drug_id: string;
  start_date?: string;
  end_date?: string;
  dose_mg: number;
  frequency: string;
  status: string;
}

export interface InteractionMapEntry {
  drug_a: string;
  drug_b: string;
  severity: string;
  description: string;
}

export interface PatientDetail extends Patient {
  allergies: Allergy[];
  lab_results: LabResult[];
  prescriptions: Prescription[];
  medication_timeline: MedicationTimelineEntry[];
  interaction_map: InteractionMapEntry[];
  encounters?: EncounterEntry[];
}

export interface PrescriberInfo {
  provider_id: string;
  first_name: string;
  last_name: string;
  specialty: string;
  npi: string;
  dea_number?: string;
  clinic_name?: string;
  clinic_address?: string;
  clinic_city?: string;
  clinic_state?: string;
  clinic_zip?: string;
  clinic_phone?: string;
  clinic_fax?: string;
  provider_email?: string;
  license_state?: string;
  board_certified?: boolean;
  group_practice?: string;
  // v8 federal exclusion
  is_excluded?: boolean;
  exclusion_source?: string | null;
  exclusion_date?: string | null;
  exclusion_reason?: string | null;
}

export interface Provider {
  id: string;
  first_name: string;
  last_name: string;
  specialty: string;
  npi: string;
  dea_number?: string;
  practice_location?: string;
  clinic_name?: string;
  clinic_address?: string;
  clinic_city?: string;
  clinic_state?: string;
  clinic_zip?: string;
  clinic_phone?: string;
  clinic_fax?: string;
  provider_email?: string;
  license_state?: string;
  board_certified?: boolean;
  accepting_patients?: boolean;
  group_practice?: string;
  total_prescriptions: number;
  flagged_prescription_count: number;
  controlled_substance_volume: number;
  risk_score: number;
}

export interface PeerComparison {
  specialty: string;
  peer_avg_total_rx: number;
  peer_avg_controlled: number;
  peer_avg_flagged_pct: number;
  provider_total_rx: number;
  provider_controlled: number;
  provider_flagged_pct: number;
}

export interface FlagHistoryEntry {
  prescription_id: string;
  date?: string;
  flag_color?: string;
  drug_name: string;
  flag_summary: string;
}

export interface ProviderDetail extends Provider {
  prescriptions: Prescription[];
  peer_comparison?: PeerComparison;
  flag_history: FlagHistoryEntry[];
}

export interface OverviewMetrics {
  total_prescriptions: number;
  flagged_count: number;
  flagged_percentage: number;
  green_count: number;
  yellow_count: number;
  red_count: number;
  total_cost_savings: number;
  safety_catches: number;
  pending_review_count: number;
}

export interface SavingsData {
  period: string;
  potential_savings: number;
  realized_savings: number;
  prescription_count: number;
}

export interface TrendData {
  period: string;
  green_count: number;
  yellow_count: number;
  red_count: number;
  total: number;
}

export interface FlaggedPrescriber {
  provider_id: string;
  provider_name: string;
  specialty: string;
  risk_score: number;
  controlled_volume: number;
  flagged_rx_count: number;
}

export interface DoctorShopping {
  patient_id: string;
  patient_name: string;
  provider_count: number;
  controlled_rx_count: number;
}

export interface FraudMetrics {
  flagged_prescribers: FlaggedPrescriber[];
  doctor_shopping_patients: DoctorShopping[];
  pharmacy_anomalies: { pharmacy_id: string; pharmacy_name: string; anomaly_count: number; avg_overcharge_pct: number }[];
}

export interface Drug {
  id: string;
  generic_name: string;
  brand_name?: string;
  drug_class: string;
  therapeutic_category: string;
  schedule: string;
  formulation: string;
  strength: string;
  route?: string;
  average_cost_per_unit: number;
  generic_available: boolean;
}

// ── New types for dynamic features ──

// Global Search
export interface SearchResultItem {
  id: string;
  label: string;
  sublabel: string;
  type: "patient" | "drug" | "provider" | "prescription";
  flag_color?: FlagColor;
}

export interface SearchResults {
  patients: SearchResultItem[];
  drugs: SearchResultItem[];
  providers: SearchResultItem[];
  prescriptions: SearchResultItem[];
  total: number;
}

// Audit Trail
export interface AuditEntry {
  id: number;
  prescription_id: string;
  action: string;
  reason?: string;
  performed_by: string;
  timestamp?: string;
  patient_name: string;
  drug_name: string;
  provider_name: string;
  flag_color?: FlagColor;
  risk_score?: number;
}

export interface AuditTrailResponse {
  total: number;
  items: AuditEntry[];
}

export interface AuditStats {
  total_actions: number;
  approved: number;
  denied: number;
  reviews_requested: number;
  sent_to_prescriber: number;
  approval_rate: number;
  denial_rate: number;
}

// Interaction Network
export interface InteractionNode {
  id: string;
  label: string;
  brand?: string;
  category: string;
  drug_class: string;
  schedule?: string;
  is_patient_drug: boolean;
}

export interface InteractionEdge {
  source: string;
  target: string;
  severity: string;
  description: string;
  clinical_effect: string;
  management: string;
}

export interface InteractionNetwork {
  nodes: InteractionNode[];
  edges: InteractionEdge[];
  total_interactions: number;
  total_drugs: number;
}

// Toast Notifications
export type ToastType = "success" | "error" | "warning" | "info";

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
  link?: string;
}

// WebSocket Events
export interface WSEvent {
  type: string;
  data: Record<string, any>;
  timestamp: string;
}

// ── AI Copilot ──

export interface CopilotMessage {
  role: "user" | "assistant";
  content: string;
}

export interface CopilotResponse {
  reply: string;
  sources: string[];
  suggested_actions: string[];
  confidence?: number;
}

export interface ClinicalNote {
  note: string;
  note_type: string;
  generated_at: string;
  prescription_id: string;
}

// ── Formulary ──

export interface FormularyResult {
  drug_id: string;
  drug_name: string;
  brand_name?: string;
  tier: number;
  tier_name: string;
  pa_required: boolean;
  step_therapy_required: boolean;
  quantity_limit: number;
  copay_range: string;
  generic_available: boolean;
  schedule?: string;
  alternatives: FormularyAlternative[];
  formulary_notes: string;
}

export interface FormularyAlternative {
  drug_id: string;
  name: string;
  brand?: string;
  equivalence_type: string;
  savings_pct: number;
  evidence_level: string;
}

// ── Prior Authorization ──

export interface PriorAuthItem {
  pa_id: string;
  prescription_id: string;
  patient_name: string;
  drug_name: string;
  drug_brand?: string;
  prescriber: string;
  prescriber_phone?: string;
  date_submitted?: string;
  status: string;
  urgency: string;
  flag_color?: string;
  risk_score?: number;
}

export interface PriorAuthQueue {
  total: number;
  items: PriorAuthItem[];
}

// ── Data Sources ──

export interface DataSource {
  id: string;
  name: string;
  type: string;
  status: string;
  last_sync?: string;
  records_synced?: number;
  protocol: string;
  endpoint?: string;
  description: string;
}
