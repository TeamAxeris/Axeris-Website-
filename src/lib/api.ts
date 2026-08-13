import { demoFetch, invalidate } from "./demoFetch";
import type {
  Prescription, PrescriptionDetail, Patient, PatientDetail,
  Provider, ProviderDetail, OverviewMetrics, SavingsData,
  TrendData, FraudMetrics, Drug, ActiveMedication,
  SearchResults, AuditTrailResponse, AuditStats, InteractionNetwork,
  CopilotMessage, CopilotResponse, ClinicalNote, FormularyResult,
  PriorAuthQueue, DataSource,
} from "@/types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "/api/v1";
const API_TIMEOUT_MS = Number(process.env.NEXT_PUBLIC_API_TIMEOUT_MS || 15000);
const API_RETRY_COUNT = Number(process.env.NEXT_PUBLIC_API_RETRY_COUNT || 1);

export class ApiError extends Error {
  status?: number;
  path: string;
  details?: unknown;

  constructor(message: string, opts: { status?: number; path: string; details?: unknown }) {
    super(message);
    this.name = "ApiError";
    this.status = opts.status;
    this.path = opts.path;
    this.details = opts.details;
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const shouldRetry = (status?: number, err?: unknown) => {
  if (status && status >= 500) return true;
  if (err instanceof DOMException && err.name === "AbortError") return true;
  if (err instanceof TypeError) return true; // fetch network failures
  return false;
};

async function fetchApi<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE}${path}`;
  // Idempotent GETs go through the stale-while-revalidate demo cache so
  // repeat navigations render instantly; the cache reuses this module's
  // retry/timeout stack as its miss-path fetcher. Mutations bypass it.
  const method = (options?.method ?? "GET").toUpperCase();
  if (method === "GET") {
    return demoFetch<T>(url, () => networkFetch<T>(path, options));
  }
  return networkFetch<T>(path, options);
}

async function networkFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE}${path}`;
  let attempt = 0;
  let lastError: unknown;

  while (attempt <= API_RETRY_COUNT) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

    try {
      const res = await fetch(url, {
        headers: { "Content-Type": "application/json", ...options?.headers },
        ...options,
        signal: controller.signal,
      });

      if (!res.ok) {
        let details: unknown;
        try { details = await res.json(); } catch { /* non-JSON */ }
        const err = new ApiError(`API error: ${res.status} ${res.statusText}`, {
          status: res.status, path, details,
        });
        if (attempt < API_RETRY_COUNT && shouldRetry(res.status, err)) {
          attempt += 1;
          await sleep(150 * attempt);
          continue;
        }
        throw err;
      }
      return res.json();
    } catch (err) {
      lastError = err;
      if (attempt < API_RETRY_COUNT && shouldRetry(undefined, err)) {
        attempt += 1;
        await sleep(150 * attempt);
        continue;
      }
      throw err instanceof ApiError ? err : new ApiError("Network request failed", { path, details: err });
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError instanceof ApiError ? lastError : new ApiError("Unknown API error", { path, details: lastError });
}

// Prescriptions
export const getPrescriptions = (params?: Record<string, string>) => {
  const qs = params ? `?${new URLSearchParams(params)}` : "";
  return fetchApi<Prescription[]>(`/console/prescriptions${qs}`);
};

export const getPrescription = (id: string) =>
  fetchApi<PrescriptionDetail>(`/console/prescriptions/${id}`);

export const prescriptionAction = async (id: string, action: string, reason?: string) => {
  const res = await fetchApi<{ status: string }>(`/console/prescriptions/${id}/action`, {
    method: "POST",
    body: JSON.stringify({ action, reason }),
  });
  // A disposition change affects queues, dashboards, audit trail, and
  // notifications · drop their cached copies so the next view is fresh.
  invalidate("/api/v1/prescriptions");
  invalidate("/api/v1/audit");
  invalidate("/api/v1/analytics");
  invalidate("/api/v1/notifications");
  invalidate("/api/v1/tpa");
  invalidate("/api/v1/pba");
  return res;
};

export const analyzePrescription = (data: {
  patient_id: string;
  provider_id: string;
  drug_id: string;
  pharmacy_id?: string;
  dose_mg: number;
  frequency: string;
  quantity: number;
  days_supply: number;
  refills_authorized?: number;
}) =>
  fetchApi<PrescriptionDetail>("/console/prescriptions/analyze", {
    method: "POST",
    body: JSON.stringify(data),
  });

// Patients
export const getPatients = () => fetchApi<Patient[]>("/console/patients");
export const getPatient = (id: string) => fetchApi<PatientDetail>(`/console/patients/${id}`);
export const getPatientMedications = (id: string) =>
  fetchApi<ActiveMedication[]>(`/console/patients/${id}/medications`);

// Providers
export const getProviders = () => fetchApi<Provider[]>("/console/providers");
export const getProvider = (id: string) => fetchApi<ProviderDetail>(`/console/providers/${id}`);

// Analytics
export const getOverview = () => fetchApi<OverviewMetrics>("/console/analytics/overview");
export const getSavings = () => fetchApi<SavingsData[]>("/console/analytics/savings");
export const getTrends = () => fetchApi<TrendData[]>("/console/analytics/trends");
export const getFraud = () => fetchApi<FraudMetrics>("/console/analytics/fraud");

// Drugs
export const searchDrugs = (q: string) => fetchApi<Drug[]>(`/drugs?q=${encodeURIComponent(q)}`);

// Global Search
export const globalSearch = (q: string) =>
  fetchApi<SearchResults>(`/search?q=${encodeURIComponent(q)}`);

// Audit Trail
export const getAuditTrail = (params?: Record<string, string>) => {
  const qs = params ? `?${new URLSearchParams(params)}` : "";
  return fetchApi<AuditTrailResponse>(`/console/audit${qs}`);
};
export const getAuditStats = () => fetchApi<AuditStats>("/console/audit/stats");

// Interaction Network
export const getInteractionNetwork = (patientId?: string) => {
  const qs = patientId ? `?patient_id=${patientId}` : "";
  return fetchApi<InteractionNetwork>(`/console/interactions/network${qs}`);
};
export const checkInteraction = (drugAId: string, drugBId: string) =>
  fetchApi<any>(`/console/interactions/check?drug_a_id=${drugAId}&drug_b_id=${drugBId}`);

// AI Copilot
export const copilotChat = (
  message: string,
  contextType?: string,
  contextId?: string,
  history: CopilotMessage[] = [],
) =>
  fetchApi<CopilotResponse>("/copilot/chat", {
    method: "POST",
    body: JSON.stringify({
      message,
      context_type: contextType,
      context_id: contextId,
      conversation_history: history,
    }),
  });

export const generateClinicalNote = (prescriptionId: string, noteType: string) =>
  fetchApi<ClinicalNote>("/copilot/generate-note", {
    method: "POST",
    body: JSON.stringify({ prescription_id: prescriptionId, note_type: noteType }),
  });

// Formulary
export const formularyCheck = (drugId: string) =>
  fetchApi<FormularyResult>(`/copilot/formulary-check/${drugId}`);

// Prior Authorization
export const getPriorAuthQueue = (status?: string) => {
  const qs = status ? `?status=${status}` : "";
  return fetchApi<PriorAuthQueue>(`/copilot/prior-auth-status${qs}`);
};

// Data Sources
export const getDataSources = () =>
  fetchApi<{ sources: DataSource[] }>("/copilot/data-sources");

// Dynamic Quick Questions
export const getQuickQuestions = () =>
  fetchApi<{ categories: { label: string; questions: string[] }[] }>("/copilot/quick-questions");
