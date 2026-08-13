"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getPrescription, prescriptionAction, ApiError } from "@/lib/api";
import type { PrescriptionDetail, FlagColor, Flag, PrescriberInfo } from "@/types";
import FlagBadge from "@/components/prescriptions/FlagBadge";
import DispositionBadge from "@/components/prescriptions/DispositionBadge";
import Header from "@/components/layout/Header";
import ConfirmModal from "@/components/ui/ConfirmModal";
import { DetailSkeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/context/ToastContext";
import { useMode } from "@/context/ModeContext";
import clsx from "clsx";
import {
  AlertCircle, AlertTriangle, Info, CheckCircle, XCircle,
  Send, Eye, ArrowLeft, Pill, User, FileText, Beaker, Clock,
  Building2, Phone, Mail, MapPin, Shield, ShieldAlert, BadgeCheck, Fingerprint,
  Download, Printer,
} from "lucide-react";

const severityIcons: Record<string, typeof AlertCircle> = {
  critical: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

const engineLabels: Record<string, string> = {
  rules: "Rules Engine",
  ml: "ML & Anomaly Detection",
  patient: "Patient-Specific Reasoning",
};

export default function PrescriptionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { mode } = useMode();
  const { addToast } = useToast();
  const [rx, setRx] = useState<PrescriptionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionReason, setActionReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pendingAction, setPendingAction] = useState<string | null>(null);

  useEffect(() => {
    if (params.id) {
      getPrescription(params.id as string)
        .then(setRx)
        .finally(() => setLoading(false));
    }
  }, [params.id]);

  const requestAction = (action: string) => {
    setPendingAction(action);
    setShowConfirm(true);
  };

  const handleConfirmAction = async () => {
    if (!rx || !pendingAction) return;
    setActionLoading(true);
    try {
      await prescriptionAction(rx.id, pendingAction, actionReason || undefined);
      const updated = await getPrescription(rx.id);
      setRx(updated);

      const labels: Record<string, string> = {
        approve: "approved",
        deny: "denied",
        request_review: "sent for review",
        send_to_prescriber: "sent to prescriber",
      };
      addToast({
        type: pendingAction === "deny" ? "error" : pendingAction === "approve" ? "success" : "info",
        title: `Prescription ${labels[pendingAction] || pendingAction}`,
        message: `${rx.drug_name} for ${rx.patient_name}`,
      });
    } catch (err) {
      // Surface patient-safety safeguard rejections clearly so reviewers
      // understand exactly why the deny was blocked at the API boundary.
      const apiErr = err as ApiError;
      const detail = (apiErr?.details as any)?.detail;
      const safeguardCode = typeof detail === "object" ? detail?.code : undefined;
      const safeguardMsg = typeof detail === "object" ? detail?.message : undefined;
      if (apiErr?.status === 422 && safeguardCode?.startsWith("deny_blocked")) {
        addToast({
          type: "error",
          title: "Denial blocked by patient safeguard",
          message: safeguardMsg || "Provide a clinical justification.",
        });
      } else {
        addToast({
          type: "error",
          title: "Action Failed",
          message: "Could not complete the action. Please try again.",
        });
      }
    } finally {
      setActionLoading(false);
      setShowConfirm(false);
      setPendingAction(null);
      setActionReason("");
    }
  };

  const handleExportPDF = () => {
    if (!rx) return;
    const content = [
      `AXERIS CLINICAL REVIEW REPORT`,
      `${"=".repeat(50)}`,
      `Prescription: ${rx.id}`,
      `Drug: ${rx.drug_name} ${rx.dose_mg}mg ${rx.frequency}`,
      `Patient: ${rx.patient_name}`,
      `Prescriber: ${rx.provider_name}`,
      `Flag: ${rx.flag_color} | Risk Score: ${((rx.risk_score || 0) * 100).toFixed(0)}/100`,
      `Status: ${rx.status}`,
      ``,
      `CLINICAL FLAGS (${(rx.flags || []).length})`,
      `${"─".repeat(50)}`,
      ...(rx.flags || []).map((f) =>
        `[${f.severity.toUpperCase()}] ${f.title}\n  ${f.description}\n  Action: ${f.suggested_action}\n  Source: ${f.evidence_source}`
      ),
      ``,
      `PATIENT CONTEXT`,
      `${"─".repeat(50)}`,
      ...(rx.patient_context?.diagnoses || []).map((d) => `  Dx: ${d.icd10_code} ${d.description || ""}`),
      ...(rx.patient_context?.allergies || []).map((a) => `  Allergy: ${a.allergen} (${a.severity})`),
      ``,
      `ALTERNATIVES`,
      `${"─".repeat(50)}`,
      ...(rx.alternatives || []).map((a) => `  ${a.generic_name} · ${a.equivalence_type} (Save ${a.estimated_savings_pct}%)`),
      ``,
      `Generated by Axeris AI Clinical Decision Support`,
      `Report Date: ${new Date().toISOString()}`,
    ].join("\n");
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `axeris-review-${rx.id}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    addToast({ type: "success", title: "Report Exported", message: `${rx.id} clinical review saved` });
  };

  const handlePrint = () => {
    // Set print date for CSS ::after content
    const main = document.querySelector("main");
    if (main) main.setAttribute("data-print-date", new Date().toLocaleDateString());
    window.print();
  };

  if (loading) {
    return (
      <>
        <Header title="Prescription Detail" />
        <div className="mt-4"><DetailSkeleton /></div>
      </>
    );
  }

  if (!rx) {
    return (
      <>
        <Header title="Prescription Detail" />
        <div className="flex items-center justify-center h-64 text-gray-400">Prescription not found</div>
      </>
    );
  }

  // Group flags by engine
  const flagsByEngine: Record<string, Flag[]> = {};
  (rx.flags || []).forEach((f) => {
    if (!flagsByEngine[f.engine]) flagsByEngine[f.engine] = [];
    flagsByEngine[f.engine].push(f);
  });

  const ctx = rx.patient_context;
  const prescriber = rx.prescriber_info;

  const confirmMessages: Record<string, { title: string; message: string; variant: "danger" | "warning" | "info" }> = {
    approve: {
      title: "Approve Prescription",
      message: `Confirm approval of ${rx.drug_name} (${rx.dose_mg}mg ${rx.frequency}) for ${rx.patient_name}. This will allow the prescription to proceed to fulfillment.`,
      variant: "info",
    },
    deny: {
      title: "Deny Prescription",
      message: `Are you sure you want to deny ${rx.drug_name} for ${rx.patient_name}? The prescriber will be notified and the patient will not receive this medication.`,
      variant: "danger",
    },
    request_review: {
      title: "Request Clinical Review",
      message: `This will escalate ${rx.drug_name} for ${rx.patient_name} to a clinical pharmacist for additional review.`,
      variant: "warning",
    },
    send_to_prescriber: {
      title: "Send to Prescriber",
      message: `This will send the clinical findings for ${rx.drug_name} back to ${rx.provider_name} for reconsideration.`,
      variant: "info",
    },
  };

  // Top findings summary · surface the model output above the fold so reviewers
  // don't have to scroll through the 3-column grid to see the disposition,
  // risk score, and most-severe flags. The same ordering drives the full-width
  // findings board below: engine counts are lopsided (a regimen scan can emit
  // seven findings while the rules engine emits one), so grouping cards by
  // engine left one very tall column with dead space beside it.
  const sortedFlags = [...(rx.flags || [])].sort((a, b) => {
    const order: Record<string, number> = { critical: 0, warning: 1, info: 2 };
    return (order[a.severity] ?? 3) - (order[b.severity] ?? 3);
  });
  const topFlags = sortedFlags.slice(0, 3);
  const moreFlagCount = Math.max(0, sortedFlags.length - 3);

  return (
    <>
      <Header title="Prescription Detail" />
      <div className="mt-4">
        <button onClick={() => router.back()} className="no-print flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-200 mb-4 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to queue
        </button>

        {/* TOP FINDINGS · sticky summary visible without scrolling */}
        <div className={clsx(
          "no-print mb-5 rounded-xl border p-4 animate-fade-in-up",
          rx.flag_color === "RED"
            ? "bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800"
            : rx.flag_color === "YELLOW"
              ? "bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800"
              : "bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800"
        )}>
          <div className="flex items-start gap-4 flex-wrap">
            <div className="flex items-center gap-3 min-w-0">
              {rx.disposition && (
                <DispositionBadge
                  disposition={rx.disposition as "APPROVE" | "REVIEW" | "FLAG"}
                  holdType={rx.hold_type}
                  slaDeadline={rx.sla_deadline}
                  size="lg"
                  showSubtitle
                />
              )}
              <FlagBadge color={rx.flag_color as FlagColor} size="lg" />
              <div className="min-w-0">
                <div className="text-[15px] font-bold text-slate-900 dark:text-slate-100 truncate">
                  {rx.drug_name} <span className="text-slate-500 dark:text-slate-400 font-medium">{rx.dose_mg}mg {rx.frequency}</span>
                </div>
                <div className="text-[12px] text-slate-600 dark:text-slate-300 mt-0.5">
                  {rx.patient_name} · {rx.provider_name} · qty {rx.quantity} · {rx.days_supply}d supply
                </div>
              </div>
            </div>
            <div className="ml-auto flex items-center gap-4">
              <div className="text-right">
                <div className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400">Risk</div>
                <div className="text-xl font-bold tabular-nums text-slate-900 dark:text-slate-100">
                  {rx.risk_score ? (rx.risk_score * 100).toFixed(0) : 0}<span className="text-[10px] font-normal text-slate-500">/100</span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400">Mode</div>
                <div className="text-[12px] font-mono font-bold text-slate-900 dark:text-slate-100">{mode}</div>
              </div>
              {rx.processing_time_ms != null && (
                <div className="text-right">
                  <div className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400">Pipeline</div>
                  <div className="text-[12px] font-mono text-slate-700 dark:text-slate-200">{rx.processing_time_ms}ms</div>
                </div>
              )}
            </div>
          </div>

          {topFlags.length > 0 && (
            <div className="mt-3 pt-3 border-t border-current/10 grid grid-cols-1 md:grid-cols-3 gap-2">
              {topFlags.map((f, i) => {
                const Icon = severityIcons[f.severity] || Info;
                return (
                  <div key={i} className="flex items-start gap-1.5 bg-white/60 dark:bg-slate-900/40 rounded px-2.5 py-1.5">
                    <Icon className={clsx("w-3.5 h-3.5 mt-0.5 flex-shrink-0",
                      f.severity === "critical" ? "text-red-600 dark:text-red-400" :
                      f.severity === "warning" ? "text-amber-600 dark:text-amber-400" : "text-blue-600 dark:text-blue-400"
                    )} />
                    <div className="min-w-0">
                      <div className="text-[12px] font-semibold text-slate-900 dark:text-slate-100 truncate">{f.title}</div>
                      <div className="text-[11px] text-slate-600 dark:text-slate-300 line-clamp-1">{f.suggested_action}</div>
                    </div>
                  </div>
                );
              })}
              {moreFlagCount > 0 && (
                <div className="text-[11px] text-slate-500 dark:text-slate-400 self-center md:col-span-3">
                  + {moreFlagCount} additional flag{moreFlagCount === 1 ? "" : "s"} below
                </div>
              )}
            </div>
          )}

        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* LEFT: Patient Context */}
          <div className="lg:col-span-4 space-y-4 animate-fade-in-up">
            {/* Patient Context Card */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-5">
              <div className="flex items-center gap-2 mb-4">
                <User className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <h3 className="font-semibold text-gray-800 dark:text-slate-200">Patient Context</h3>
              </div>
              <div className="text-sm font-medium text-gray-900 dark:text-white mb-3">{rx.patient_name}</div>

              {ctx && (
                <div className="space-y-4">
                  <div>
                    <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Active Diagnoses</h4>
                    <div className="space-y-1">
                      {ctx.diagnoses.map((d, i) => (
                        <div key={i} className="text-xs text-gray-700 dark:text-slate-300">
                          <span className="font-mono text-gray-500">{d.icd10_code}</span>{" "}
                          {d.description || ""}
                        </div>
                      ))}
                      {ctx.diagnoses.length === 0 && <div className="text-xs text-gray-400">None on file</div>}
                    </div>
                  </div>

                  <div>
                    <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Allergies</h4>
                    <div className="space-y-1">
                      {ctx.allergies.map((a, i) => (
                        <div key={i} className="text-xs">
                          <span className="font-medium text-red-700 dark:text-red-400">{a.allergen}</span>
                          {a.reaction_type && <span className="text-gray-500"> · {a.reaction_type}</span>}
                          {a.severity && <span className={clsx("ml-1 text-xs", a.severity === "severe" ? "text-red-600 font-semibold dark:text-red-400" : "text-gray-500")}>({a.severity})</span>}
                        </div>
                      ))}
                      {ctx.allergies.length === 0 && <div className="text-xs text-gray-400">No known allergies</div>}
                    </div>
                  </div>

                  <div>
                    <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Recent Labs</h4>
                    <div className="space-y-1">
                      {ctx.recent_labs.slice(0, 8).map((l, i) => (
                        <div key={i} className={clsx("text-xs flex justify-between", l.is_abnormal ? "text-red-700 dark:text-red-400 font-medium" : "text-gray-700 dark:text-slate-300")}>
                          <span>{l.test_name}</span>
                          <span>{l.value} {l.unit || ""}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Active Medications ({ctx.active_medications.length})</h4>
                    <div className="space-y-1">
                      {ctx.active_medications.map((m, i) => (
                        <div key={i} className="text-xs text-gray-700 dark:text-slate-300">
                          {m.drug_name} {m.dose_mg}mg {m.frequency}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* CENTER: Prescription, prescriber, clinical context */}
          <div className="lg:col-span-5 space-y-4 animate-fade-in-up" style={{ animationDelay: "100ms" }}>
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Pill className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                  <h3 className="font-semibold text-gray-800 dark:text-slate-200">Prescription</h3>
                </div>
                <div className="flex items-center gap-2">
                  {rx.disposition && (
                    <DispositionBadge
                      disposition={rx.disposition as "APPROVE" | "REVIEW" | "FLAG"}
                      holdType={rx.hold_type}
                      slaDeadline={rx.sla_deadline}
                      size="lg"
                      showSubtitle
                    />
                  )}
                  <FlagBadge color={rx.flag_color as FlagColor} size="lg" />
                </div>
              </div>
              {(mode || rx.processing_time_ms != null) && (
                <div className="mb-3 flex items-center gap-3 text-xs text-gray-500">
                  {mode && (
                    <span className="inline-flex items-center gap-1">
                      <span className="font-semibold text-gray-600 dark:text-slate-400">Mode:</span>
                      <span className="px-1.5 py-0.5 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded font-mono">{mode}</span>
                    </span>
                  )}
                  {rx.processing_time_ms != null && (
                    <span className="inline-flex items-center gap-1">
                      <span className="font-semibold text-gray-600 dark:text-slate-400">Pipeline:</span>
                      <span className="font-mono">{rx.processing_time_ms}ms</span>
                    </span>
                  )}
                </div>
              )}
              <div className="text-xl font-bold text-gray-900 dark:text-white mb-2">{rx.drug_name}</div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-gray-500">Dose:</span> <span className="font-medium">{rx.dose_mg}mg {rx.frequency}</span></div>
                <div><span className="text-gray-500">Quantity:</span> <span className="font-medium">{rx.quantity}</span></div>
                <div><span className="text-gray-500">Days Supply:</span> <span className="font-medium">{rx.days_supply}</span></div>
                <div><span className="text-gray-500">Prescriber:</span> <span className="font-medium">{rx.provider_name}</span></div>
                {rx.route && <div><span className="text-gray-500">Route:</span> <span className="font-medium capitalize">{rx.route}</span></div>}
                {rx.ndc11 && <div><span className="text-gray-500">NDC-11:</span> <span className="font-mono text-xs font-medium">{rx.ndc11}</span></div>}
                {rx.rxnorm_code && <div><span className="text-gray-500">RxNorm:</span> <span className="font-mono text-xs font-medium">{rx.rxnorm_code}</span></div>}
              </div>
              {rx.sig && (
                <div className="mt-2 text-xs text-gray-600 dark:text-slate-400 bg-gray-50 dark:bg-slate-900/40 border border-gray-100 dark:border-slate-700 rounded px-2 py-1.5">
                  <span className="text-gray-400">Sig:</span> {rx.sig}
                </div>
              )}
              <div className="mt-1.5 text-[10px] uppercase tracking-wider text-blue-600 font-semibold dark:text-blue-400">Plan claim file · MedicationRequest</div>
              <div className="mt-4">
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>Risk Score</span>
                  <span className="font-bold">{rx.risk_score ? (rx.risk_score * 100).toFixed(0) : 0}/100</span>
                </div>
                <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={clsx(
                      "h-full rounded-full transition-all duration-1000 ease-out",
                      rx.flag_color === "RED" ? "bg-gradient-to-r from-red-400 to-red-600" :
                      rx.flag_color === "YELLOW" ? "bg-gradient-to-r from-yellow-400 to-yellow-600" :
                      "bg-gradient-to-r from-green-400 to-green-600"
                    )}
                    style={{ width: `${(rx.risk_score || 0) * 100}%` }}
                  />
                </div>
              </div>
            </div>


            {/* Prescribing Provider Card */}
            {prescriber && (
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Building2 className="w-5 h-5 text-indigo-600" />
                  <h3 className="font-semibold text-gray-800 dark:text-slate-200">Prescribing Provider</h3>
                </div>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="text-sm font-bold text-gray-900 dark:text-white">
                      Dr. {prescriber.first_name} {prescriber.last_name}
                    </div>
                    <div className="text-xs text-gray-500">{prescriber.specialty}</div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {prescriber.board_certified ? (
                      <span className="flex items-center gap-1 text-xs bg-green-50 dark:bg-emerald-900/20 text-green-700 dark:text-green-300 px-2 py-0.5 rounded-full border border-green-200 dark:border-green-800">
                        <BadgeCheck className="w-3 h-3" /> Board Certified
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 px-2 py-0.5 rounded-full border border-red-200 dark:border-red-800">
                        <ShieldAlert className="w-3 h-3" /> Not Board Certified
                      </span>
                    )}
                  </div>
                </div>

                {/* Clinic Info */}
                {prescriber.clinic_name && (
                  <div className="bg-gray-50 dark:bg-slate-900/40 rounded-lg p-3 mb-3">
                    <div className="text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">{prescriber.clinic_name}</div>
                    {prescriber.clinic_address && (
                      <div className="flex items-start gap-1.5 text-xs text-gray-600 dark:text-slate-400">
                        <MapPin className="w-3 h-3 mt-0.5 flex-shrink-0 text-gray-400" />
                        <div>
                          {prescriber.clinic_address}
                          {prescriber.clinic_city && `, ${prescriber.clinic_city}`}
                          {prescriber.clinic_state && `, ${prescriber.clinic_state}`}
                          {prescriber.clinic_zip && ` ${prescriber.clinic_zip}`}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Contact Details */}
                <div className="space-y-2 text-xs">
                  {prescriber.clinic_phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-gray-400" />
                      <span className="text-gray-700 dark:text-slate-300">{prescriber.clinic_phone}</span>
                      <span className="text-gray-400">Phone</span>
                    </div>
                  )}
                  {prescriber.clinic_fax && (
                    <div className="flex items-center gap-2">
                      <FileText className="w-3.5 h-3.5 text-gray-400" />
                      <span className="text-gray-700 dark:text-slate-300">{prescriber.clinic_fax}</span>
                      <span className="text-gray-400">Fax</span>
                    </div>
                  )}
                  {prescriber.provider_email && (
                    <div className="flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5 text-gray-400" />
                      <span className="text-gray-700 dark:text-slate-300">{prescriber.provider_email}</span>
                    </div>
                  )}
                </div>

                {/* Identifiers */}
                <div className="mt-3 pt-3 border-t border-gray-100 dark:border-slate-700 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-gray-400">NPI</span>
                    <div className="font-mono text-gray-700 dark:text-slate-300">{prescriber.npi}</div>
                  </div>
                  {prescriber.dea_number && (
                    <div>
                      <span className="text-gray-400">DEA #</span>
                      <div className="font-mono text-gray-700 dark:text-slate-300">{prescriber.dea_number}</div>
                    </div>
                  )}
                  {prescriber.license_state && (
                    <div>
                      <span className="text-gray-400">License State</span>
                      <div className="text-gray-700 dark:text-slate-300">{prescriber.license_state}</div>
                    </div>
                  )}
                  {prescriber.group_practice && (
                    <div>
                      <span className="text-gray-400">Group Practice</span>
                      <div className="text-gray-700 dark:text-slate-300">{prescriber.group_practice}</div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Embedded Clinical Context · PGx, REMS, Provider Risk, Audit Trail */}
            {((rx as any).pgx_results?.length > 0 || (rx as any).rems_enrollments?.length > 0) && (
              <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded">
                <div className="px-4 py-2.5 border-b border-slate-200 dark:border-slate-700 text-[12px] font-semibold uppercase tracking-wider text-slate-500">
                  Patient Clinical Context
                </div>
                <div className="px-4 py-3 space-y-3 text-[12px]">
                  {(rx as any).pgx_results?.length > 0 && (
                    <div>
                      <div className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 mb-1">Pharmacogenomics (CPIC Level A)</div>
                      <table className="w-full">
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                          {(rx as any).pgx_results.map((p: any, i: number) => (
                            <tr key={i}>
                              <td className="py-1 font-mono font-semibold text-slate-700 dark:text-slate-300">{p.gene}</td>
                              <td className="py-1 text-slate-600 dark:text-slate-400 capitalize">{p.phenotype.replace(/_/g, " ")}</td>
                              <td className="py-1 text-slate-500 font-mono text-[11px]">{p.diplotype || "·"}</td>
                              <td className="py-1 text-slate-400 text-[11px]">CPIC {p.cpic_level} · {p.test_date}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  {(rx as any).rems_enrollments?.length > 0 && (
                    <div>
                      <div className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 mb-1">REMS Enrollments</div>
                      {(rx as any).rems_enrollments.map((r: any, i: number) => (
                        <div key={i} className="flex items-center justify-between py-1 border-t border-slate-100 dark:border-slate-700 first:border-t-0">
                          <span className="font-mono text-slate-700 dark:text-slate-300">{r.rems_program}</span>
                          <span className={clsx("text-[11px] px-1.5 py-0.5 rounded font-semibold", r.is_active ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300" : "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300")}>
                            {r.is_active ? "Active" : "Inactive"}
                          </span>
                          <span className="text-[11px] text-slate-500">Last monitoring: {r.last_monitoring_date || "Never"}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Prescriber Risk: LEIE/SAM screening + ML pill mill */}
            {prescriber && prescriber.is_excluded && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded p-4">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 dark:text-red-400" />
                  <div>
                    <div className="text-[12px] font-bold text-red-900 dark:text-red-200 uppercase tracking-wider">Excluded Provider · Federal Block</div>
                    <div className="text-[12px] text-red-800 dark:text-red-200 mt-1">
                      Prescriber NPI {prescriber.npi} is on the {prescriber.exclusion_source} federal exclusion list.
                    </div>
                    <div className="text-[11px] text-red-700 dark:text-red-300 mt-1">
                      Reason: {prescriber.exclusion_reason} · Excluded: {prescriber.exclusion_date}
                    </div>
                    <div className="text-[11px] text-red-600 mt-1 italic dark:text-red-400">
                      Action: Block payment immediately. Refer to TPA fraud team.
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ERISA audit trail · sober tabular */}
            {(rx as any).audit_trail && (
              <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded">
                <div className="px-4 py-2.5 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                  <div className="text-[12px] font-semibold uppercase tracking-wider text-slate-500">
                    ERISA § 404(a)(1)(B) Audit Trail
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono">
                    {(rx as any).audit_trail.engines_fired?.length || 0} engine(s) · {(rx as any).audit_trail.total_flags} flag(s) · {(rx as any).processing_time_ms}ms
                  </div>
                </div>
                <div className="px-4 py-2 text-[11px] font-mono text-slate-600 dark:text-slate-400">
                  Operating mode: <strong>{(rx as any).audit_trail.operating_mode}</strong> ·
                  Disposition: <strong>{(rx as any).audit_trail.disposition}</strong> ·
                  Hold: <strong>{(rx as any).audit_trail.hold_type || "none"}</strong> ·
                  Risk score: <strong>{(rx as any).audit_trail.risk_score}</strong>
                </div>
              </div>
            )}
          </div>

          {/* RIGHT: Actions & Alternatives */}
          <div className="lg:col-span-3 space-y-4 animate-fade-in-up" style={{ animationDelay: "200ms" }}>
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-5">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-3">Actions</h3>
              <div className="space-y-2">
                <textarea
                  placeholder="Reason (required for deny)..."
                  value={actionReason}
                  onChange={(e) => setActionReason(e.target.value)}
                  className="w-full text-sm border border-gray-300 dark:border-slate-600 dark:bg-slate-900 dark:text-white rounded-lg px-3 py-2 h-20 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                />
                <button onClick={() => requestAction("approve")} disabled={actionLoading || rx.status !== "pending"}
                  className="w-full flex items-center justify-center gap-2 bg-green-600 text-white text-sm font-medium py-2.5 rounded-xl hover:bg-green-700 disabled:opacity-50 transition-all hover:shadow-md">
                  <CheckCircle className="w-4 h-4" /> Approve
                </button>
                <button onClick={() => requestAction("deny")} disabled={actionLoading || !actionReason || rx.status !== "pending"}
                  className="w-full flex items-center justify-center gap-2 bg-red-600 text-white text-sm font-medium py-2.5 rounded-xl hover:bg-red-700 disabled:opacity-50 transition-all hover:shadow-md">
                  <XCircle className="w-4 h-4" /> Deny
                </button>
                <button onClick={() => requestAction("request_review")} disabled={actionLoading || rx.status !== "pending"}
                  className="w-full flex items-center justify-center gap-2 bg-yellow-500 text-white text-sm font-medium py-2.5 rounded-xl hover:bg-yellow-600 disabled:opacity-50 transition-all hover:shadow-md">
                  <Eye className="w-4 h-4" /> Request Review
                </button>
                <button onClick={() => requestAction("send_to_prescriber")} disabled={actionLoading || rx.status !== "pending"}
                  className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white text-sm font-medium py-2.5 rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-all hover:shadow-md">
                  <Send className="w-4 h-4" /> Send to Prescriber
                </button>
              </div>
              {rx.status !== "pending" && (
                <div className="mt-3 text-center">
                  <span className={clsx(
                    "text-sm font-medium px-3 py-1.5 rounded-xl capitalize inline-flex items-center gap-1.5",
                    rx.status === "approved" && "bg-green-100 text-green-700 dark:text-emerald-300 dark:bg-green-900/30",
                    rx.status === "denied" && "bg-red-100 text-red-700 dark:text-red-300 dark:bg-red-900/30",
                    rx.status === "review" && "bg-yellow-100 text-yellow-700 dark:text-yellow-300 dark:bg-yellow-900/30",
                  )}>
                    <Clock className="w-3.5 h-3.5" />
                    Status: {rx.status}
                  </span>
                </div>
              )}
            </div>

            {/* Export & Print */}
            <div className="no-print bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-5">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-3">Reports</h3>
              <div className="space-y-2">
                <button onClick={handleExportPDF}
                  className="w-full flex items-center justify-center gap-2 bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-300 text-sm font-medium py-2.5 rounded-xl hover:bg-gray-200 dark:hover:bg-slate-600 transition-all">
                  <Download className="w-4 h-4" /> Export Clinical Report
                </button>
                <button onClick={handlePrint}
                  className="w-full flex items-center justify-center gap-2 bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-300 text-sm font-medium py-2.5 rounded-xl hover:bg-gray-200 dark:hover:bg-slate-600 transition-all">
                  <Printer className="w-4 h-4" /> Print Review
                </button>
              </div>
            </div>

            {rx.alternatives && rx.alternatives.length > 0 && (
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-5">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-3">Therapeutic Alternatives</h3>
                <div className="space-y-3">
                  {rx.alternatives.map((alt, i) => (
                    <div key={i} className="border border-gray-100 dark:border-slate-700 rounded-lg p-3 hover:shadow-md transition-all">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">{alt.generic_name}</div>
                      {alt.brand_name && <div className="text-xs text-gray-500">{alt.brand_name}</div>}
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded dark:text-blue-300 dark:bg-blue-900/30">{alt.equivalence_type}</span>
                        {alt.estimated_savings_pct > 0 && (
                          <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded dark:text-emerald-300 dark:bg-green-900/30">
                            Save {alt.estimated_savings_pct.toFixed(0)}%
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">Evidence: {alt.evidence_level}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {rx.titration_info && (
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-5">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-3">Titration Schedule</h3>
                <div className="text-xs space-y-1">
                  <div><span className="text-gray-500">Start:</span> {(rx.titration_info as any).start_dose_mg}mg/day</div>
                  <div><span className="text-gray-500">Step:</span> +{(rx.titration_info as any).step_increment_mg}mg</div>
                  <div><span className="text-gray-500">Interval:</span> {(rx.titration_info as any).step_interval_days} days</div>
                  <div><span className="text-gray-500">Max:</span> {(rx.titration_info as any).max_dose_mg}mg/day</div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Findings · full width and severity-ordered, so ten flags read as a
            board instead of one long column. Each card carries its own engine
            label, which the removed per-engine grouping used to provide. */}
        {sortedFlags.length > 0 && (
          <div className="mt-6 animate-fade-in-up" style={{ animationDelay: "250ms" }}>
            <div className="flex items-center gap-2 mb-3">
              <Beaker className="w-4 h-4 text-indigo-600" />
              <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300">Findings</h3>
              <span className="text-xs bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400 px-2 py-0.5 rounded-full">
                {sortedFlags.length}
              </span>
              <div className="ml-auto hidden sm:flex items-center gap-3 text-[11px] text-gray-500 dark:text-slate-400">
                {Object.entries(flagsByEngine).map(([engine, fl]) => (
                  <span key={engine}>
                    {engineLabels[engine] || engine}{" "}
                    <span className="font-semibold text-gray-700 dark:text-slate-300">{fl.length}</span>
                  </span>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-3 items-start">
              {sortedFlags.map((flag, i) => {
                const Icon = severityIcons[flag.severity] || Info;
                return (
                  <div key={i} className={clsx(
                    "rounded-lg p-3 border transition-all hover:shadow-md h-full",
                    flag.severity === "critical" ? "bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800" :
                    flag.severity === "warning" ? "bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800" :
                    "bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800"
                  )}>
                    <div className="flex items-start gap-2">
                      <Icon className={clsx("w-4 h-4 mt-0.5 flex-shrink-0",
                        flag.severity === "critical" ? "text-red-600 dark:text-red-400" :
                        flag.severity === "warning" ? "text-yellow-600 dark:text-yellow-400" : "text-blue-600 dark:text-blue-400"
                      )} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="text-sm font-medium text-gray-900 dark:text-white">{flag.title}</div>
                          <span className="text-[9px] uppercase tracking-wide font-semibold text-gray-400 dark:text-slate-500 whitespace-nowrap mt-0.5">
                            {engineLabels[flag.engine] || flag.engine}
                          </span>
                        </div>
                        <div className="text-xs text-gray-600 dark:text-slate-400 mt-1">{flag.description}</div>
                        <div className="text-xs text-gray-500 mt-2">
                          <span className="font-medium">Evidence:</span> {flag.evidence_source}
                        </div>
                        <div className="text-xs text-gray-700 dark:text-slate-300 mt-1">
                          <span className="font-medium">Action:</span> {flag.suggested_action}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {sortedFlags.length === 0 && (
          <div className="mt-6 bg-green-50 dark:bg-emerald-900/20 rounded-xl border border-green-200 dark:border-green-800 p-6 text-center">
            <CheckCircle className="w-8 h-8 text-green-600 mx-auto mb-2 dark:text-emerald-400" />
            <div className="text-sm font-medium text-green-800 dark:text-green-300">No clinical flags detected</div>
            <div className="text-xs text-green-600 mt-1 dark:text-emerald-400">This prescription appears clinically appropriate</div>
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      {pendingAction && confirmMessages[pendingAction] && (
        <ConfirmModal
          open={showConfirm}
          title={confirmMessages[pendingAction].title}
          message={confirmMessages[pendingAction].message}
          variant={confirmMessages[pendingAction].variant}
          confirmLabel={pendingAction === "deny" ? "Deny Prescription" : pendingAction === "approve" ? "Approve" : "Confirm"}
          onConfirm={handleConfirmAction}
          onCancel={() => { setShowConfirm(false); setPendingAction(null); }}
          loading={actionLoading}
        >
          {pendingAction === "deny" && actionReason && (
            <div className="bg-gray-50 dark:bg-slate-900/40 rounded-lg p-3">
              <div className="text-xs font-semibold text-gray-500 mb-1">Denial Reason</div>
              <div className="text-sm text-gray-700 dark:text-slate-300">{actionReason}</div>
            </div>
          )}
        </ConfirmModal>
      )}
    </>
  );
}
