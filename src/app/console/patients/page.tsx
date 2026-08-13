"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getPatients } from "@/lib/api";
import type { Patient } from "@/types";
import Header from "@/components/layout/Header";
import clsx from "clsx";
import { AlertTriangle } from "lucide-react";

export default function PatientsPage() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getPatients().then(setPatients).finally(() => setLoading(false));
  }, []);

  return (
    <>
      <Header title="Patients" />
      <div className="mt-4">
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-gray-400 dark:text-slate-500">Loading...</div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/40">
                  <th className="text-left text-xs font-medium text-gray-500 dark:text-slate-400 px-4 py-3">Patient</th>
                  <th className="text-left text-xs font-medium text-gray-500 dark:text-slate-400 px-4 py-3">DOB</th>
                  <th className="text-left text-xs font-medium text-gray-500 dark:text-slate-400 px-4 py-3">Gender</th>
                  <th className="text-left text-xs font-medium text-gray-500 dark:text-slate-400 px-4 py-3">Diagnoses</th>
                  <th className="text-right text-xs font-medium text-gray-500 dark:text-slate-400 px-4 py-3">Active Meds</th>
                  <th className="text-right text-xs font-medium text-gray-500 dark:text-slate-400 px-4 py-3">Allergies</th>
                  <th className="text-right text-xs font-medium text-gray-500 dark:text-slate-400 px-4 py-3">Polypharmacy</th>
                  <th className="text-right text-xs font-medium text-gray-500 dark:text-slate-400 px-4 py-3">Adherence</th>
                  <th className="text-center text-xs font-medium text-gray-500 dark:text-slate-400 px-4 py-3">Flags</th>
                </tr>
              </thead>
              <tbody>
                {patients.map((pat) => (
                  <Link key={pat.id} href={`/console/patients/${pat.id}`} legacyBehavior>
                    <tr className="border-b border-gray-100 dark:border-slate-700/60 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700/40 transition-colors">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-slate-100">
                        {pat.first_name} {pat.last_name}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-slate-300">
                        {new Date(pat.date_of_birth).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-slate-300">{pat.gender || "-"}</td>
                      <td className="px-4 py-3 text-xs text-gray-500 dark:text-slate-400">
                        {pat.active_diagnoses.slice(0, 2).map(d => d.icd10_code).join(", ")}
                        {pat.active_diagnoses.length > 2 && ` +${pat.active_diagnoses.length - 2}`}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-gray-700 dark:text-slate-200">
                        <span className={clsx(pat.active_medication_count >= 5 ? "text-red-600 dark:text-red-400 font-medium" : "")}>
                          {pat.active_medication_count}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-gray-700 dark:text-slate-200">{pat.allergy_count}</td>
                      <td className="px-4 py-3 text-right">
                        {pat.polypharmacy_risk_score != null ? (
                          <span className={clsx(
                            "text-xs font-medium px-2 py-0.5 rounded",
                            pat.polypharmacy_risk_score > 0.5 ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" :
                            pat.polypharmacy_risk_score > 0.2 ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300" :
                            "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"
                          )}>
                            {(pat.polypharmacy_risk_score * 100).toFixed(0)}%
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400 dark:text-slate-500">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {pat.adherence_score != null ? (
                          <span className={clsx(
                            "text-xs font-medium",
                            pat.adherence_score < 0.8 ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"
                          )}>
                            {(pat.adherence_score * 100).toFixed(0)}%
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400 dark:text-slate-500">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {pat.doctor_shopping_flag && (
                          <span className="inline-flex items-center gap-1 text-xs bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 px-2 py-0.5 rounded-full">
                            <AlertTriangle className="w-3 h-3" /> Shopping
                          </span>
                        )}
                      </td>
                    </tr>
                  </Link>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}
