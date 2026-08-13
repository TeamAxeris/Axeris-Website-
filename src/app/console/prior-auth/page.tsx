"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getPriorAuthQueue } from "@/lib/api";
import type { PriorAuthItem } from "@/types";
import Header from "@/components/layout/Header";
import FlagBadge from "@/components/prescriptions/FlagBadge";
import type { FlagColor } from "@/types";
import {
  Clock, CheckCircle, XCircle, AlertTriangle, FileText,
  Phone, Filter, RefreshCw,
} from "lucide-react";
import clsx from "clsx";

const statusConfig: Record<string, { label: string; icon: typeof Clock; color: string; bg: string }> = {
  pending_review: { label: "Pending Review", icon: Clock, color: "text-yellow-700 dark:text-yellow-300", bg: "bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20" },
  pending_info: { label: "Awaiting Info", icon: FileText, color: "text-orange-700 dark:text-orange-300", bg: "bg-orange-50 border-orange-200 dark:bg-orange-900/20" },
  approved: { label: "Approved", icon: CheckCircle, color: "text-green-700 dark:text-emerald-300", bg: "bg-green-50 border-green-200 dark:bg-emerald-900/20" },
  denied: { label: "Denied", icon: XCircle, color: "text-red-700 dark:text-red-300", bg: "bg-red-50 border-red-200 dark:bg-red-900/20" },
};

export default function PriorAuthPage() {
  const [queue, setQueue] = useState<PriorAuthItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  const fetchQueue = () => {
    setLoading(true);
    const status = statusFilter !== "ALL" ? statusFilter : undefined;
    getPriorAuthQueue(status)
      .then((res) => setQueue(res.items))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchQueue();
  }, [statusFilter]);

  const stats = {
    total: queue.length,
    pending: queue.filter((p) => p.status === "pending_review").length,
    awaiting: queue.filter((p) => p.status === "pending_info").length,
    approved: queue.filter((p) => p.status === "approved").length,
    denied: queue.filter((p) => p.status === "denied").length,
  };

  return (
    <>
      <Header title="Prior Authorization Queue" />
      <div className="mt-4 space-y-4">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: "Total PAs", value: stats.total, color: "text-gray-900 dark:text-white", bg: "bg-white dark:bg-slate-800" },
            { label: "Pending Review", value: stats.pending, color: "text-yellow-700 dark:text-yellow-300", bg: "bg-yellow-50 dark:bg-yellow-900/20" },
            { label: "Awaiting Info", value: stats.awaiting, color: "text-orange-700 dark:text-orange-300", bg: "bg-orange-50 dark:bg-orange-900/20" },
            { label: "Approved", value: stats.approved, color: "text-green-700 dark:text-emerald-300", bg: "bg-green-50 dark:bg-emerald-900/20" },
            { label: "Denied", value: stats.denied, color: "text-red-700 dark:text-red-300", bg: "bg-red-50 dark:bg-red-900/20" },
          ].map((s) => (
            <div key={s.label} className={clsx("rounded-xl border border-gray-200 p-4 dark:border-slate-700", s.bg)}>
              <div className="text-xs text-gray-500">{s.label}</div>
              <div className={clsx("text-2xl font-bold mt-1", s.color)}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3">
          <Filter className="w-4 h-4 text-gray-400" />
          <div className="flex max-w-full gap-1 overflow-x-auto rounded-lg border border-gray-200 bg-white p-1 dark:border-slate-700 dark:bg-slate-800">
            {["ALL", "pending_review", "pending_info", "approved", "denied"].map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={clsx(
                  "px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                  statusFilter === s ? "bg-slate-900 text-white" : "text-gray-600 hover:bg-gray-100 dark:text-slate-400 dark:hover:bg-slate-700/40"
                )}
              >
                {s === "ALL" ? "All" : statusConfig[s]?.label || s}
              </button>
            ))}
          </div>
          <button
            onClick={fetchQueue}
            className="ml-auto flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 px-3 py-1.5 bg-white rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors dark:bg-slate-800 dark:border-slate-700 dark:hover:bg-slate-700/40"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>

        {/* PA Queue Table */}
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white dark:border-slate-700 dark:bg-slate-800">
          {loading ? (
            <div className="p-8 text-center text-gray-400">Loading prior authorizations...</div>
          ) : queue.length === 0 ? (
            <div className="p-8 text-center text-gray-400">No prior authorizations found</div>
          ) : (
            <table className="w-full min-w-[900px]">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 dark:bg-slate-900/40 dark:border-slate-700">
                  <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">PA ID</th>
                  <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Patient</th>
                  <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Drug</th>
                  <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Prescriber</th>
                  <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Risk</th>
                  <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Urgency</th>
                  <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Status</th>
                  <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Date</th>
                </tr>
              </thead>
              <tbody>
                {queue.map((pa) => {
                  const cfg = statusConfig[pa.status] || statusConfig.pending_review;
                  const StatusIcon = cfg.icon;
                  return (
                    <Link key={pa.pa_id} href={`/console/prescriptions/${pa.prescription_id}`} legacyBehavior>
                      <tr className="border-b border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors dark:border-slate-700 dark:hover:bg-slate-700/40">
                        <td className="px-4 py-3 text-xs font-mono text-gray-500">{pa.pa_id}</td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">{pa.patient_name}</td>
                        <td className="px-4 py-3">
                          <div className="text-sm text-gray-700 dark:text-slate-300">{pa.drug_name}</div>
                          {pa.drug_brand && (
                            <div className="text-xs text-gray-400">{pa.drug_brand}</div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-sm text-gray-700 dark:text-slate-300">{pa.prescriber}</div>
                          {pa.prescriber_phone && (
                            <div className="flex items-center gap-1 text-xs text-gray-400">
                              <Phone className="w-3 h-3" /> {pa.prescriber_phone}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {pa.flag_color && <FlagBadge color={pa.flag_color as FlagColor} size="sm" />}
                        </td>
                        <td className="px-4 py-3">
                          <span className={clsx(
                            "text-xs font-medium px-2 py-0.5 rounded-full",
                            pa.urgency === "urgent" ? "bg-red-100 text-red-700 dark:text-red-300 dark:bg-red-900/30" : "bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-slate-400"
                          )}>
                            {pa.urgency}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={clsx(
                            "inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-lg border",
                            cfg.bg, cfg.color,
                          )}>
                            <StatusIcon className="w-3 h-3" />
                            {cfg.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500">
                          {pa.date_submitted ? new Date(pa.date_submitted).toLocaleDateString() : "·"}
                        </td>
                      </tr>
                    </Link>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}
