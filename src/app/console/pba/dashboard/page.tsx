"use client";

import { useEffect, useState } from "react";
import { demoFetch } from "@/lib/demoFetch";
import { DashboardSkeleton } from "@/components/ui/Skeleton";
import { DemoBanner } from "@/components/ui/DemoBanner";
import { PbaDashboardHero } from "@/components/dashboard/PbaCharts";

interface PBAData {
  transactions_today: number;
  transactions_per_second: number;
  avg_latency_ms: number;
  p95_latency_ms: number;
  p99_latency_ms: number;
  sla_compliance_pct: number;
  rejects_last_hour: number;
  callback_queue_depth: number;
  blocks_at_dispense_24h: number;
  network_pharmacies_active: number;
  formulary_hit_rate_pct: number;
  member_safety_alerts_24h: number;
  open_prior_auths: number;
}

export default function PBADashboardPage() {
  const [data, setData] = useState<PBAData | null>(null);

  useEffect(() => {
    // Instant first paint from the demo cache; background refresh keeps
    // the KPIs live without re-blocking navigation (was a 5s full refetch).
    demoFetch("/api/v1/pba/dashboard").then(setData).catch(() => {});
    const refresh = () =>
      fetch("/api/v1/pba/dashboard").then(r => r.json()).then(setData).catch(() => {});
    const i = setInterval(refresh, 30000);
    return () => clearInterval(i);
  }, []);

  if (!data) return <div className="p-6"><DashboardSkeleton /></div>;

  return (
    <div className="space-y-5">
      <DemoBanner />
      {/* Header */}
      <div className="flex items-end justify-between border-b border-slate-200 dark:border-slate-700 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold text-slate-900 dark:text-white">PBA Adjudication Console</h1>
            <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-700 dark:border-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">Status · Good</span>
          </div>
          <p className="text-[12px] text-slate-500 dark:text-slate-400">
            NCPDP Telecommunication Standard D.0 · sub-200ms p95 SLA · pre-dispense intervention
          </p>
        </div>
        <div className="text-right text-[11px] text-slate-500 dark:text-slate-400">
          <div>Operating Mode: <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">PBA</span></div>
          <div>NCPDP D.0 embedded</div>
        </div>
      </div>

      <PbaDashboardHero data={data} />

    </div>
  );
}
