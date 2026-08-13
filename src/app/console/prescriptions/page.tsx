"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getPrescriptions } from "@/lib/api";
import type { Prescription, FlagColor } from "@/types";
import FlagBadge from "@/components/prescriptions/FlagBadge";
import Header from "@/components/layout/Header";
import clsx from "clsx";

export default function PrescriptionsPage() {
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  useEffect(() => {
    const params: Record<string, string> = { limit: "200" };
    if (filter !== "ALL") params.flag_color = filter;
    if (statusFilter !== "ALL") params.status = statusFilter;

    getPrescriptions(params)
      .then(setPrescriptions)
      .finally(() => setLoading(false));
  }, [filter, statusFilter]);

  const sorted = [...prescriptions].sort((a, b) => {
    const order: Record<string, number> = { RED: 0, YELLOW: 1, GREEN: 2 };
    const aOrder = order[a.flag_color || "GREEN"] ?? 3;
    const bOrder = order[b.flag_color || "GREEN"] ?? 3;
    if (aOrder !== bOrder) return aOrder - bOrder;
    return (b.date_written || "").localeCompare(a.date_written || "");
  });

  return (
    <>
      <Header title="Prescription Review Queue" />
      <div className="mt-4 space-y-4">
        {/* Filters */}
        <div className="flex gap-3 flex-wrap">
          <div className="flex gap-1 bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-1">
            {["ALL", "RED", "YELLOW", "GREEN"].map((f) => (
              <button
                key={f}
                onClick={() => { setFilter(f); setLoading(true); }}
                className={clsx(
                  "px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                  filter === f
                    ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                    : "text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700"
                )}
              >
                {f === "ALL" ? "All" : f === "RED" ? "High Risk" : f === "YELLOW" ? "Review" : "Appropriate"}
              </button>
            ))}
          </div>
          <div className="flex gap-1 bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-1">
            {["ALL", "pending", "approved", "denied"].map((s) => (
              <button
                key={s}
                onClick={() => { setStatusFilter(s); setLoading(true); }}
                className={clsx(
                  "px-3 py-1.5 rounded-md text-xs font-medium transition-colors capitalize",
                  statusFilter === s
                    ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                    : "text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700"
                )}
              >
                {s === "ALL" ? "All Status" : s}
              </button>
            ))}
          </div>
          <span className="self-center text-sm text-gray-500 dark:text-slate-400">{sorted.length} prescriptions</span>
        </div>

        {/* Table */}
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white dark:border-slate-700 dark:bg-slate-800">
          {loading ? (
            <div className="p-8 text-center text-gray-400 dark:text-slate-500">Loading...</div>
          ) : (
            <table className="w-full min-w-[900px]">
              <thead>
                <tr className="border-b border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/40">
                  <th className="text-left text-xs font-medium text-gray-500 dark:text-slate-400 px-4 py-3">Flag</th>
                  <th className="text-left text-xs font-medium text-gray-500 dark:text-slate-400 px-4 py-3">Patient</th>
                  <th className="text-left text-xs font-medium text-gray-500 dark:text-slate-400 px-4 py-3">Drug</th>
                  <th className="text-left text-xs font-medium text-gray-500 dark:text-slate-400 px-4 py-3">Dose</th>
                  <th className="text-left text-xs font-medium text-gray-500 dark:text-slate-400 px-4 py-3">Prescriber</th>
                  <th className="text-left text-xs font-medium text-gray-500 dark:text-slate-400 px-4 py-3">Date</th>
                  <th className="text-left text-xs font-medium text-gray-500 dark:text-slate-400 px-4 py-3">Top Flag</th>
                  <th className="text-left text-xs font-medium text-gray-500 dark:text-slate-400 px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((rx) => (
                  <Link key={rx.id} href={`/console/prescriptions/${rx.id}`} legacyBehavior>
                    <tr
                      className={clsx(
                        "border-b border-gray-100 dark:border-slate-700/60 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700/40 transition-colors",
                        rx.flag_color === "RED" && "bg-red-50/50 dark:bg-red-900/15",
                        rx.flag_color === "YELLOW" && "bg-yellow-50/30 dark:bg-amber-900/10",
                      )}
                    >
                      <td className="px-4 py-3">
                        <FlagBadge color={rx.flag_color as FlagColor} size="sm" />
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-slate-100">{rx.patient_name}</td>
                      <td className="px-4 py-3 text-sm text-gray-700 dark:text-slate-200">{rx.drug_name}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-slate-300">{rx.dose_mg}mg {rx.frequency}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-slate-300">{rx.provider_name}</td>
                      <td className="px-4 py-3 text-sm text-gray-500 dark:text-slate-400">
                        {rx.date_written ? new Date(rx.date_written).toLocaleDateString() : "-"}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500 dark:text-slate-400 max-w-[200px] truncate">
                        {rx.flags && rx.flags.length > 0 ? rx.flags[0].title : "-"}
                      </td>
                      <td className="px-4 py-3">
                        <span className={clsx(
                          "text-xs font-medium px-2 py-1 rounded capitalize",
                          rx.status === "approved" && "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
                          rx.status === "denied" && "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
                          rx.status === "pending" && "bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-slate-300",
                          rx.status === "review" && "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300",
                        )}>
                          {rx.status}
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
