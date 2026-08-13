"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { ShieldCheck, AlertTriangle, ArrowLeft } from "lucide-react";
import { CardSkeleton } from "@/components/ui/Skeleton";
import { demoFetch } from "@/lib/demoFetch";

interface ReviewerStat {
  reviewer: string;
  total: number;
  denials: number;
  deny_rate: number;
  flagged: boolean;
}

interface Safeguard {
  id: string;
  name: string;
  description: string;
  enforcement: string;
}

interface Dashboard {
  window_days: number;
  total_actions: number;
  total_denials: number;
  overall_deny_rate: number;
  deny_rate_threshold: number;
  cost_only_denials_blocked: number;
  low_evidence_denials_blocked: number;
  green_denials_escalated: number;
  reviewers_under_surveillance: number;
  safeguards_active: Safeguard[];
  reviewer_stats: ReviewerStat[];
  last_updated: string;
}

const enforcementColor: Record<string, string> = {
  blocking: "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-700",
  escalation: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700",
  audit: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700",
  logging: "bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600",
};

export default function SafeguardsPage() {
  const [data, setData] = useState<Dashboard | null>(null);

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    demoFetch("/api/v1/safeguards/dashboard")
      .then(setData)
      .catch((e) => setError(e.message || "Failed to load safeguards"));
  }, []);

  if (error) return (
    <div className="p-6 max-w-[800px]">
      <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-5 text-[13px] text-red-800 dark:text-red-200">
        Could not load safeguards dashboard: {error}. Confirm the backend is reachable, then refresh.
      </div>
    </div>
  );

  if (!data) return (
    <div className="p-6 max-w-[1200px] space-y-4">
      <CardSkeleton />
      <CardSkeleton />
    </div>
  );

  const overRate = data.overall_deny_rate > data.deny_rate_threshold;

  return (
    <div className="p-6 max-w-[1200px] space-y-5">
      <Link href="/" className="inline-flex items-center gap-1 text-[12px] text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">
        <ArrowLeft className="w-3.5 h-3.5" /> Back
      </Link>

      <div className="flex items-start gap-3">
        <div className="p-2 bg-emerald-50 dark:bg-emerald-900/30 rounded-lg">
          <ShieldCheck className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Patient Safeguards</h1>
          <p className="text-[13px] text-slate-600 dark:text-slate-300 mt-1">
            Controls that prevent the TPA and PBA modes from being used to systematically deny prescriptions
            in pursuit of savings. Every denial passes through these checks at the API boundary.
          </p>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded p-3">
          <div className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold">Window</div>
          <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 tabular-nums">{data.window_days}d</div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400">{data.total_actions} actions</div>
        </div>
        <div className="border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded p-3">
          <div className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold">Deny Rate</div>
          <div className={clsx("text-2xl font-bold tabular-nums", overRate ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400")}>
            {(data.overall_deny_rate * 100).toFixed(1)}%
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400">Threshold {(data.deny_rate_threshold * 100).toFixed(0)}%</div>
        </div>
        <div className="border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded p-3">
          <div className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold">Cost-only blocked</div>
          <div className="text-2xl font-bold text-amber-600 dark:text-amber-400 tabular-nums">{data.cost_only_denials_blocked}</div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400">Pre-flight</div>
        </div>
        <div className="border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded p-3">
          <div className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold">Low evidence</div>
          <div className="text-2xl font-bold text-amber-600 dark:text-amber-400 tabular-nums">{data.low_evidence_denials_blocked}</div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400">Justification &lt; 25 chars</div>
        </div>
        <div className="border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded p-3">
          <div className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold">Reviewers flagged</div>
          <div className={clsx("text-2xl font-bold tabular-nums", data.reviewers_under_surveillance > 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400")}>
            {data.reviewers_under_surveillance}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400">Surveillance signals</div>
        </div>
      </div>

      {/* Active controls */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded">
        <div className="px-4 py-2.5 border-b border-slate-200 dark:border-slate-700">
          <h3 className="text-[13px] font-semibold text-slate-900 dark:text-slate-100">Active Safeguards</h3>
        </div>
        <div className="divide-y divide-slate-100 dark:divide-slate-700">
          {data.safeguards_active.map((s) => (
            <div key={s.id} className="px-4 py-3 flex items-start gap-3">
              <span className={clsx("text-[10px] font-bold uppercase px-2 py-0.5 rounded border tracking-wider whitespace-nowrap", enforcementColor[s.enforcement] || enforcementColor.logging)}>
                {s.enforcement}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-semibold text-slate-900 dark:text-slate-100">{s.name}</div>
                <div className="text-[12px] text-slate-600 dark:text-slate-300 mt-0.5">{s.description}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Reviewer table */}
      {data.reviewer_stats.length > 0 && (
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded">
          <div className="px-4 py-2.5 border-b border-slate-200 dark:border-slate-700">
            <h3 className="text-[13px] font-semibold text-slate-900 dark:text-slate-100">Reviewer Activity ({data.window_days}-day window)</h3>
          </div>
          <table className="w-full text-[12px]">
            <thead className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/40">
              <tr>
                <th className="text-left font-semibold px-4 py-2">Reviewer</th>
                <th className="text-right font-semibold px-4 py-2">Total Actions</th>
                <th className="text-right font-semibold px-4 py-2">Denials</th>
                <th className="text-right font-semibold px-4 py-2">Deny Rate</th>
                <th className="text-right font-semibold px-4 py-2">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {data.reviewer_stats.map((r) => (
                <tr key={r.reviewer}>
                  <td className="px-4 py-2 font-medium text-slate-900 dark:text-slate-100">{r.reviewer}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-slate-700 dark:text-slate-200">{r.total}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-slate-700 dark:text-slate-200">{r.denials}</td>
                  <td className={clsx("px-4 py-2 text-right tabular-nums font-semibold", r.flagged ? "text-red-600 dark:text-red-400" : "text-slate-700 dark:text-slate-200")}>
                    {(r.deny_rate * 100).toFixed(1)}%
                  </td>
                  <td className="px-4 py-2 text-right">
                    {r.flagged ? (
                      <span className="inline-flex items-center gap-1 text-[11px] text-red-700 dark:text-red-300 font-semibold">
                        <AlertTriangle className="w-3 h-3" /> Surveillance
                      </span>
                    ) : (
                      <span className="text-[11px] text-emerald-700 dark:text-emerald-400">Normal</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-[11px] text-slate-500 dark:text-slate-400 italic">
        Last updated {new Date(data.last_updated).toLocaleString()} · Safeguards are advisory + audit signals.
        ERISA §404 fiduciary duty owes the participant, not the plan sponsor.
      </p>
    </div>
  );
}
