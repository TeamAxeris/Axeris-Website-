"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { getPatient } from "@/lib/api";
import type { PatientDetail, FlagColor } from "@/types";
import Header from "@/components/layout/Header";
import FlagBadge from "@/components/prescriptions/FlagBadge";
import { ArrowLeft, User, AlertTriangle } from "lucide-react";
import clsx from "clsx";

export default function PatientDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [patient, setPatient] = useState<PatientDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (params.id) {
      getPatient(params.id as string)
        .then(setPatient)
        .finally(() => setLoading(false));
    }
  }, [params.id]);

  if (loading || !patient) {
    return (
      <>
        <Header title="Patient Detail" />
        <div className="flex items-center justify-center h-64 text-gray-400">
          {loading ? "Loading..." : "Patient not found"}
        </div>
      </>
    );
  }

  const age = Math.floor((Date.now() - new Date(patient.date_of_birth).getTime()) / (365.25 * 24 * 60 * 60 * 1000));

  return (
    <>
      <Header title="Patient Detail" />
      <div className="mt-4">
        <button onClick={() => router.back()} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-200 mb-4">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        {/* Patient Header */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-5 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-blue-100 rounded-full flex items-center justify-center dark:bg-blue-900/30">
                <User className="w-7 h-7 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">{patient.first_name} {patient.last_name}</h2>
                <p className="text-sm text-gray-500">{age} years old | {patient.gender || "Unknown"} | DOB: {new Date(patient.date_of_birth).toLocaleDateString()}</p>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-[11px] text-gray-500">
                  {patient.race && <span><span className="text-gray-400">Race:</span> {patient.race}</span>}
                  {patient.ethnicity && <span><span className="text-gray-400">Ethnicity:</span> {patient.ethnicity}</span>}
                  {patient.preferred_language && <span><span className="text-gray-400">Language:</span> {patient.preferred_language}</span>}
                  {patient.marital_status && <span><span className="text-gray-400">Marital:</span> {patient.marital_status}</span>}
                  {(patient.state || patient.postal_code) && <span><span className="text-gray-400">Location:</span> {patient.state}{patient.postal_code ? ` ${patient.postal_code}` : ""}</span>}
                  <span className="text-[10px] uppercase tracking-wider text-blue-600 font-semibold dark:text-blue-400">Truveta TDM · Person</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-4">
              {patient.doctor_shopping_flag && (
                <span className="flex items-center gap-1 text-sm bg-red-100 text-red-700 px-3 py-1 rounded-full font-medium dark:text-red-300 dark:bg-red-900/30">
                  <AlertTriangle className="w-4 h-4" /> Doctor Shopping Alert
                </span>
              )}
              {patient.polypharmacy_risk_score != null && (
                <div className="text-center">
                  <div className="text-xs text-gray-500">Polypharmacy Risk</div>
                  <div className={clsx("text-lg font-bold", patient.polypharmacy_risk_score > 0.5 ? "text-red-600 dark:text-red-400" : patient.polypharmacy_risk_score > 0.2 ? "text-yellow-600 dark:text-yellow-400" : "text-green-600 dark:text-emerald-400")}>
                    {(patient.polypharmacy_risk_score * 100).toFixed(0)}%
                  </div>
                </div>
              )}
              {patient.adherence_score != null && (
                <div className="text-center">
                  <div className="text-xs text-gray-500">Adherence</div>
                  <div className={clsx("text-lg font-bold", patient.adherence_score < 0.8 ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-emerald-400")}>
                    {(patient.adherence_score * 100).toFixed(0)}%
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Diagnoses & Allergies & Labs */}
          <div className="space-y-4">
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-5">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-3">Active Diagnoses</h3>
              <div className="space-y-1">
                {patient.active_diagnoses.map((d, i) => (
                  <div key={i} className="text-xs">
                    <span className="font-mono text-gray-500">{d.icd10_code}</span>{" "}
                    <span className="text-gray-700 dark:text-slate-300">{d.description || ""}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-5">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-3">Allergies</h3>
              <div className="space-y-1">
                {patient.allergies.map((a, i) => (
                  <div key={i} className="text-xs">
                    <span className="font-medium text-red-700 dark:text-red-400">{a.allergen}</span>
                    {a.severity && <span className="text-gray-500"> ({a.severity})</span>}
                  </div>
                ))}
                {patient.allergies.length === 0 && <p className="text-xs text-gray-400">No known allergies</p>}
              </div>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-5">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-3">Recent Lab Results</h3>
              <div className="space-y-1">
                {patient.lab_results.slice(0, 10).map((l, i) => (
                  <div key={i} className={clsx("text-xs flex justify-between", l.is_abnormal ? "text-red-700 dark:text-red-400 font-medium" : "text-gray-700 dark:text-slate-300")}>
                    <span>{l.test_name}</span>
                    <span>{l.value} {l.unit || ""}</span>
                  </div>
                ))}
              </div>
            </div>

            {patient.encounters && patient.encounters.length > 0 && (
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300">Encounters</h3>
                  <span className="text-[10px] uppercase tracking-wider text-blue-600 font-semibold dark:text-blue-400">Truveta TDM · Encounter</span>
                </div>
                <div className="space-y-2">
                  {patient.encounters.slice(0, 6).map((e) => (
                    <div key={e.id} className="text-xs border-b border-gray-100 dark:border-slate-700 last:border-b-0 pb-2 last:pb-0">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-gray-800 dark:text-slate-200 capitalize">{(e.encounter_class || "encounter").replace(/_/g, " ")}</span>
                        <span className="text-gray-400">{e.start_date ? new Date(e.start_date).toLocaleDateString() : "·"}</span>
                      </div>
                      {e.facility_name && <div className="text-gray-500">{e.facility_name}</div>}
                      {e.discharge_disposition && <div className="text-gray-400">Disposition: {e.discharge_disposition.replace(/_/g, " ")}</div>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Medication Timeline */}
          <div className="space-y-4">
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-5">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-3">Medication Timeline</h3>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {patient.medication_timeline.map((mt, i) => (
                  <div key={i} className="flex items-center gap-3 p-2 rounded-lg border border-gray-100 dark:border-slate-700">
                    <div className={clsx(
                      "w-2 h-2 rounded-full flex-shrink-0",
                      mt.status === "approved" ? "bg-green-500" :
                      mt.status === "denied" ? "bg-red-500" :
                      mt.status === "pending" ? "bg-yellow-500" : "bg-gray-400"
                    )} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900 dark:text-white truncate">{mt.drug_name}</div>
                      <div className="text-xs text-gray-500">{mt.dose_mg}mg {mt.frequency}</div>
                    </div>
                    <div className="text-xs text-gray-400">
                      {mt.start_date ? new Date(mt.start_date).toLocaleDateString() : "-"}
                    </div>
                  </div>
                ))}
                {patient.medication_timeline.length === 0 && (
                  <p className="text-sm text-gray-400">No medications on record</p>
                )}
              </div>
            </div>
          </div>

          {/* Interaction Map & Prescriptions */}
          <div className="space-y-4">
            {patient.interaction_map.length > 0 && (
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-5">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-3">Drug Interactions</h3>
                <div className="space-y-2">
                  {patient.interaction_map.map((inter, i) => (
                    <div key={i} className={clsx(
                      "p-3 rounded-lg border",
                      inter.severity === "major" ? "bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800" :
                      inter.severity === "moderate" ? "bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800" :
                      "bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800"
                    )}>
                      <div className="text-xs font-medium text-gray-900 dark:text-white">
                        {inter.drug_a} + {inter.drug_b}
                      </div>
                      <div className="text-xs text-gray-600 dark:text-slate-400 mt-1">{inter.description}</div>
                      <span className={clsx(
                        "text-xs font-medium mt-1 inline-block px-2 py-0.5 rounded",
                        inter.severity === "major" ? "bg-red-100 text-red-700 dark:text-red-300 dark:bg-red-900/30" :
                        inter.severity === "moderate" ? "bg-yellow-100 text-yellow-700 dark:text-yellow-300 dark:bg-yellow-900/30" :
                        "bg-blue-100 text-blue-700 dark:text-blue-300 dark:bg-blue-900/30"
                      )}>
                        {inter.severity}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-5">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-3">Prescriptions</h3>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {patient.prescriptions.map((rx) => (
                  <Link key={rx.id} href={`/prescriptions/${rx.id}`}
                    className="block p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700/40 border border-gray-100 dark:border-slate-700">
                    <div className="flex items-center gap-2">
                      {rx.flag_color && <FlagBadge color={rx.flag_color as FlagColor} size="sm" showLabel={false} />}
                      <span className="text-sm text-gray-900 dark:text-white">{rx.drug_name}</span>
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">{rx.dose_mg}mg {rx.frequency} | {rx.provider_name}</div>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
