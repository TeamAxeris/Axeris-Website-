"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getAuditTrail, getAuditStats } from "@/lib/api";
import type { AuditEntry, AuditStats, FlagColor } from "@/types";
import Header from "@/components/layout/Header";
import FlagBadge from "@/components/prescriptions/FlagBadge";
import { useMode } from "@/context/ModeContext";
import clsx from "clsx";
import {
  CheckCircle, XCircle, Eye, Send, Clock, FileText,
  TrendingUp, TrendingDown, BarChart3,
} from "lucide-react";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
} from "recharts";

const actionIcons: Record<string, typeof CheckCircle> = {
  approve: CheckCircle,
  deny: XCircle,
  request_review: Eye,
  send_to_prescriber: Send,
};

const actionColors: Record<string, string> = {
  approve: "text-green-600 bg-green-50 dark:bg-green-900/30 dark:text-green-300",
  deny: "text-red-600 bg-red-50 dark:bg-red-900/30 dark:text-red-300",
  request_review: "text-yellow-600 bg-yellow-50 dark:bg-yellow-900/30 dark:text-yellow-300",
  send_to_prescriber: "text-blue-600 bg-blue-50 dark:bg-blue-900/30 dark:text-blue-300",
};

const actionLabels: Record<string, string> = {
  approve: "Approved",
  deny: "Denied",
  request_review: "Sent for Review",
  send_to_prescriber: "Sent to Prescriber",
};

export default function AuditPage() {
  const { mode } = useMode();
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [stats, setStats] = useState<AuditStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState<string>("ALL");

  // Same data, different framing depending on operating mode.
  // TPA: post-adjudication ERISA §404 audit trail of reviewer actions.
  // PBA: real-time NCPDP D.0 adjudication log of dispense decisions.
  const pageTitle = mode === "PBA" ? "Adjudication Log" : "Audit Trail";
  const pageSubtitle = mode === "PBA"
    ? "Real-time NCPDP D.0 adjudication outcomes · every approve / reject / soft-edit recorded for pharmacy POS reconciliation"
    : "ERISA § 404(a)(1)(B) fiduciary record · every reviewer action with reason, timestamp, and evidence chain";

  useEffect(() => {
    const params: Record<string, string> = { limit: "100" };
    if (actionFilter !== "ALL") params.action = actionFilter;

    Promise.all([getAuditTrail(params), getAuditStats()])
      .then(([trail, s]) => {
        setEntries(trail.items);
        setStats(s);
      })
      .finally(() => setLoading(false));
  }, [actionFilter]);

  const pieData = stats
    ? [
        { name: "Approved", value: stats.approved, color: "#22c55e" },
        { name: "Denied", value: stats.denied, color: "#ef4444" },
        { name: "Review", value: stats.reviews_requested, color: "#eab308" },
        { name: "Sent", value: stats.sent_to_prescriber, color: "#3b82f6" },
      ]
    : [];

  const cardCls = "bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-4";

  return (
    <>
      <Header title={pageTitle} />
      <div className="mt-4 space-y-6">
        <div className="border-l-4 border-blue-500 dark:border-blue-400 pl-3 py-1 bg-blue-50/40 dark:bg-blue-900/15 rounded-r">
          <div className="text-[12px] text-slate-700 dark:text-slate-200">{pageSubtitle}</div>
        </div>
        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 animate-fade-in-up">
            <div className={cardCls}>
              <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 bg-purple-50 dark:bg-purple-900/30 rounded-lg">
                  <FileText className="w-4 h-4 text-purple-600 dark:text-purple-300" />
                </div>
                <span className="text-xs text-gray-500 dark:text-slate-400">Total Actions</span>
              </div>
              <div className="text-2xl font-bold text-gray-900 dark:text-slate-100">{stats.total_actions}</div>
            </div>
            <div className={cardCls}>
              <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 bg-green-50 dark:bg-green-900/30 rounded-lg">
                  <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-300" />
                </div>
                <span className="text-xs text-gray-500 dark:text-slate-400">Approved</span>
              </div>
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.approved}</div>
            </div>
            <div className={cardCls}>
              <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 bg-red-50 dark:bg-red-900/30 rounded-lg">
                  <XCircle className="w-4 h-4 text-red-600 dark:text-red-300" />
                </div>
                <span className="text-xs text-gray-500 dark:text-slate-400">Denied</span>
              </div>
              <div className="text-2xl font-bold text-red-600 dark:text-red-400">{stats.denied}</div>
            </div>
            <div className={cardCls}>
              <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 bg-green-50 dark:bg-green-900/30 rounded-lg">
                  <TrendingUp className="w-4 h-4 text-green-600 dark:text-green-300" />
                </div>
                <span className="text-xs text-gray-500 dark:text-slate-400">Approval Rate</span>
              </div>
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.approval_rate}%</div>
            </div>
            <div className={cardCls}>
              <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 bg-red-50 dark:bg-red-900/30 rounded-lg">
                  <TrendingDown className="w-4 h-4 text-red-600 dark:text-red-300" />
                </div>
                <span className="text-xs text-gray-500 dark:text-slate-400">Denial Rate</span>
              </div>
              <div className="text-2xl font-bold text-red-600 dark:text-red-400">{stats.denial_rate}%</div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Action Distribution Chart */}
          {stats && (
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-5 animate-fade-in-up" style={{ animationDelay: "100ms" }}>
              <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-200 mb-4 flex items-center gap-2">
                <BarChart3 className="w-4 h-4" /> Action Distribution
              </h3>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={40} outerRadius={70} dataKey="value" paddingAngle={3}>
                      {pieData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => [v, "Actions"]} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-wrap gap-2 mt-2 justify-center">
                {pieData.map((entry) => (
                  <div key={entry.name} className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                    <span className="text-xs text-gray-500 dark:text-slate-400">{entry.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Audit Log */}
          <div className="lg:col-span-3 space-y-4 animate-fade-in-up" style={{ animationDelay: "200ms" }}>
            {/* Filters */}
            <div className="flex gap-1 bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-1 w-fit">
              {["ALL", "approve", "deny", "request_review", "send_to_prescriber"].map((a) => (
                <button
                  key={a}
                  onClick={() => { setActionFilter(a); setLoading(true); }}
                  className={clsx(
                    "px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                    actionFilter === a
                      ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                      : "text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700"
                  )}
                >
                  {a === "ALL" ? "All" : actionLabels[a] || a}
                </button>
              ))}
            </div>

            {/* Trail */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
              {loading ? (
                <div className="p-8 text-center text-gray-400 dark:text-slate-500">Loading audit trail...</div>
              ) : entries.length === 0 ? (
                <div className="p-8 text-center text-gray-400 dark:text-slate-500">
                  No audit entries yet. Take actions on prescriptions to see them here.
                </div>
              ) : (
                <div className="divide-y divide-gray-100 dark:divide-slate-700/60">
                  {entries.map((entry) => {
                    const Icon = actionIcons[entry.action] || Clock;
                    const colorClasses = actionColors[entry.action] || "text-gray-600 bg-gray-50 dark:bg-slate-700 dark:text-slate-300";

                    return (
                      <div key={entry.id} className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 dark:hover:bg-slate-700/40 transition-colors">
                        <div className={clsx("p-2 rounded-xl", colorClasses)}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-900 dark:text-slate-100">
                              {actionLabels[entry.action] || entry.action}
                            </span>
                            {entry.flag_color && (
                              <FlagBadge color={entry.flag_color as FlagColor} size="sm" />
                            )}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                            <Link href={`/console/prescriptions/${entry.prescription_id}`} className="text-blue-600 dark:text-blue-400 hover:underline">
                              {entry.prescription_id}
                            </Link>
                            {" · "}
                            {entry.drug_name} for {entry.patient_name}
                            {entry.provider_name && ` (${entry.provider_name})`}
                          </div>
                          {entry.reason && (
                            <div className="text-xs text-gray-400 dark:text-slate-500 mt-1 italic">&quot;{entry.reason}&quot;</div>
                          )}
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className="text-xs text-gray-400 dark:text-slate-500">
                            {entry.timestamp
                              ? new Date(entry.timestamp).toLocaleDateString()
                              : "-"}
                          </div>
                          <div className="text-xs text-gray-300 dark:text-slate-500">
                            {entry.timestamp
                              ? new Date(entry.timestamp).toLocaleTimeString()
                              : ""}
                          </div>
                          <div className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">{entry.performed_by}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
