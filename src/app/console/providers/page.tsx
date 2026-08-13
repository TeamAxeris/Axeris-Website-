"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getProviders } from "@/lib/api";
import type { Provider } from "@/types";
import Header from "@/components/layout/Header";
import { BadgeCheck, ShieldAlert, MapPin } from "lucide-react";
import clsx from "clsx";

export default function ProvidersPage() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getProviders().then(setProviders).finally(() => setLoading(false));
  }, []);

  const sorted = [...providers].sort((a, b) => b.risk_score - a.risk_score);

  return (
    <>
      <Header title="Providers" />
      <div className="mt-4">
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white dark:border-slate-700 dark:bg-slate-800">
          {loading ? (
            <div className="p-8 text-center text-gray-400 dark:text-slate-500">Loading...</div>
          ) : (
            <table className="w-full min-w-[900px]">
              <thead>
                <tr className="border-b border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/40">
                  <th className="text-left text-xs font-medium text-gray-500 dark:text-slate-400 px-4 py-3">Provider</th>
                  <th className="text-left text-xs font-medium text-gray-500 dark:text-slate-400 px-4 py-3">Clinic / Location</th>
                  <th className="text-left text-xs font-medium text-gray-500 dark:text-slate-400 px-4 py-3">NPI / DEA</th>
                  <th className="text-center text-xs font-medium text-gray-500 dark:text-slate-400 px-4 py-3">Board Cert.</th>
                  <th className="text-right text-xs font-medium text-gray-500 dark:text-slate-400 px-4 py-3">Total Rx</th>
                  <th className="text-right text-xs font-medium text-gray-500 dark:text-slate-400 px-4 py-3">Flagged</th>
                  <th className="text-right text-xs font-medium text-gray-500 dark:text-slate-400 px-4 py-3">Controlled</th>
                  <th className="text-right text-xs font-medium text-gray-500 dark:text-slate-400 px-4 py-3">Risk Score</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((prov) => (
                  <Link key={prov.id} href={`/console/providers/${prov.id}`} legacyBehavior>
                    <tr className={clsx(
                      "border-b border-gray-100 dark:border-slate-700/60 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700/40 transition-colors",
                      prov.risk_score > 0.5 && "bg-red-50/40 dark:bg-red-900/15",
                    )}>
                      <td className="px-4 py-3">
                        <div className="text-sm font-medium text-gray-900 dark:text-slate-100">Dr. {prov.first_name} {prov.last_name}</div>
                        <div className="text-xs text-gray-500 dark:text-slate-400">{prov.specialty}</div>
                      </td>
                      <td className="px-4 py-3">
                        {prov.clinic_name ? (
                          <div>
                            <div className="text-sm text-gray-700 dark:text-slate-200">{prov.clinic_name}</div>
                            <div className="flex items-center gap-1 text-xs text-gray-400 dark:text-slate-500">
                              <MapPin className="w-3 h-3" />
                              {prov.clinic_city}{prov.clinic_state ? `, ${prov.clinic_state}` : ""}
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400 dark:text-slate-500">{prov.practice_location || "Address on file with NPPES"}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-xs text-gray-500 dark:text-slate-300 font-mono">{prov.npi}</div>
                        {prov.dea_number && (
                          <div className="text-xs text-gray-400 dark:text-slate-500 font-mono">{prov.dea_number}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {prov.board_certified ? (
                          <BadgeCheck className="w-4 h-4 text-green-600 dark:text-green-400 mx-auto" />
                        ) : (
                          <ShieldAlert className="w-4 h-4 text-red-500 dark:text-red-400 mx-auto" />
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-gray-700 dark:text-slate-200">{prov.total_prescriptions}</td>
                      <td className="px-4 py-3 text-sm text-right">
                        <span className={clsx(prov.flagged_prescription_count > 0 ? "text-red-600 dark:text-red-400 font-medium" : "text-gray-500 dark:text-slate-400")}>
                          {prov.flagged_prescription_count}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-gray-700 dark:text-slate-200">{prov.controlled_substance_volume}</td>
                      <td className="px-4 py-3 text-right">
                        <span className={clsx(
                          "text-xs font-medium px-2 py-1 rounded",
                          prov.risk_score > 0.5 ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" :
                          prov.risk_score > 0.2 ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300" :
                          "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"
                        )}>
                          {(prov.risk_score * 100).toFixed(0)}%
                        </span>
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
