"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, ArrowDownRight, Wallet, ClipboardList, Clock, Flag } from "lucide-react";
import { DashboardSkeleton } from "@/components/ui/Skeleton";
import { demoFetch } from "@/lib/demoFetch";
import { TrendArea, FlagDonut, LeakBars, Sparkline } from "@/components/dashboard/DashCharts";

const fmtUsd = (n: number) =>
  n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M` : `$${Math.round(n / 1000).toLocaleString()}k`;

function KpiCard({ icon: Icon, tint, label, value, delta, up, spark }: {
  icon: any; tint: string; label: string; value: string; delta?: string; up?: boolean; spark?: number[];
}) {
  return (
    <div className="bg-white dark:bg-slate-800 border border-gray-200 rounded p-5 flex flex-col">
      <div className="flex items-start justify-between">
        <span className="text-[12px] text-slate-500 dark:text-slate-400">{label}</span>
        <span className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: `${tint}18`, color: tint }}>
          <Icon className="w-4 h-4" />
        </span>
      </div>
      <div className="text-[2rem] leading-none tracking-[-0.03em] text-slate-900 dark:text-white tabular-nums mt-3">{value}</div>
      {delta && (
        <div className="flex items-center gap-1 mt-2 text-[12px]" style={{ color: up ? "#14a05a" : "#dc4b45" }}>
          {up ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
          <span className="tabular-nums">{delta}</span>
          <span className="text-slate-400">vs last quarter</span>
        </div>
      )}
      {spark && <div className="mt-3 -mx-1"><Sparkline data={spark} /></div>}
    </div>
  );
}

function Panel({ title, sub, children, action }: { title: string; sub?: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="h-fit bg-white dark:bg-slate-800 border border-gray-200 rounded p-6">
      <div className="flex items-start justify-between mb-5">
        <div>
          <h3 className="font-heading text-[1.05rem] tracking-[-0.01em] text-slate-900 dark:text-white">{title}</h3>
          {sub && <p className="text-[12px] text-slate-500 dark:text-slate-400 mt-0.5">{sub}</p>}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

export default function TPADashboardPage() {
  const [data, setData] = useState<any>(null);
  const [cc, setCc] = useState<Record<string, any>>({});
  const [ov, setOv] = useState<any>(null);
  const [trends, setTrends] = useState<any[]>([]);
  const [savings, setSavings] = useState<any[]>([]);

  useEffect(() => {
    demoFetch("/api/v1/tpa/dashboard").then(setData).catch(() => {});
    demoFetch("/api/v1/analytics/overview").then(setOv).catch(() => {});
    demoFetch("/api/v1/analytics/trends").then((d) => setTrends(Array.isArray(d) ? d : [])).catch(() => {});
    demoFetch("/api/v1/analytics/savings").then((d) => setSavings(Array.isArray(d) ? d : [])).catch(() => {});
    const load = (k: string, u: string) => demoFetch(u).then((d) => setCc((p) => ({ ...p, [k]: d }))).catch(() => {});
    load("ops", "/api/v1/tpa/ops-metrics");
    load("pbm", "/api/v1/tpa/pbm-audit");
    load("mo", "/api/v1/tpa/med-optimization");
    load("dtc", "/api/v1/tpa/dtc-leakage");
    load("pd", "/api/v1/tpa/plan-design");
    load("conf", "/api/v1/tpa/conflict-audit");
  }, []);

  if (!data) return <DashboardSkeleton />;

  const claimsSpark = trends.slice(-10).map((t) => t.total);
  const flaggedSpark = trends.slice(-10).map((t) => t.red_count);
  const recoverSpark = savings.slice(-10).map((s) => Math.round(s.realized_savings));
  const leakRows = [
    { label: "PBM rebate gap", value: cc.pbm?.rebates.total_gap_usd || 0, display: cc.pbm ? fmtUsd(cc.pbm.rebates.total_gap_usd) : "·" },
    { label: "DTC overpayment", value: cc.dtc?.summary.annualized_overpay_usd || 0, display: cc.dtc ? fmtUsd(cc.dtc.summary.annualized_overpay_usd) : "·" },
    { label: "Plan design leakage", value: cc.pd?.summary.total_annual_impact_usd || 0, display: cc.pd ? fmtUsd(cc.pd.summary.total_annual_impact_usd) : "·" },
    { label: "Spread over benchmark", value: cc.pbm?.spread.total_spread_usd || 0, display: cc.pbm ? fmtUsd(cc.pbm.spread.total_spread_usd) : "·" },
    { label: "Deprescribing", value: cc.mo?.summary.avoidable_annual_usd || 0, display: cc.mo ? fmtUsd(cc.mo.summary.avoidable_annual_usd) : "·" },
  ];

  return (
    <div className="space-y-12 max-w-[1180px]">
      {/* Header */}
      <header data-tour="header">
        <h1 className="font-heading text-[2.2rem] sm:text-[2.8rem] leading-[1.05] tracking-[-0.03em] text-slate-900 dark:text-white max-w-[16ch]">
          Every claim, checked before it&apos;s paid.
        </h1>
        <p className="text-[15px] text-slate-500 dark:text-slate-400 mt-4 max-w-[52ch]">
          Post-adjudication review across {data.employer_count} self-funded groups
          and {data.total_lives.toLocaleString()} covered lives, audit-ready under ERISA.
        </p>
      </header>

      {/* KPI row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5" data-tour="kpis">
        <KpiCard icon={Wallet} tint="#2f2fe6" label="Recovered this quarter"
                 value={`$${(data.quarterly_recovered_usd / 1000).toFixed(0)}K`} delta="20.1%" up spark={recoverSpark} />
        <KpiCard icon={ClipboardList} tint="#6b5cf0" label="Claims in review"
                 value={`${data.pend_queue_total}`} delta="8.4%" up spark={claimsSpark} />
        <KpiCard icon={Clock} tint="#14a05a" label="Reviewed on time"
                 value={`${data.sla_compliance_pct}%`} delta="1.9%" up />
        <KpiCard icon={Flag} tint="#dc4b45" label="Flagged rate"
                 value={ov ? `${ov.flagged_percentage}%` : "·"} delta="3.2%" up={false} spark={flaggedSpark} />
      </div>

      {/* Trend + donut */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2">
          <Panel title="Prescriptions reviewed" sub="Monthly volume flowing through the clinical layer">
            <TrendArea data={trends.map((t) => ({ period: t.period, total: t.total }))} />
          </Panel>
        </div>
        <div data-tour="resolution">
          <Panel title="How they resolved" sub="Green passes, yellow swaps, red holds">
            {ov ? <FlagDonut green={ov.green_count} yellow={ov.yellow_count} red={ov.red_count} />
                : <div className="h-[128px]" />}
          </Panel>
        </div>
      </div>

      {/* Leak bars + action list */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Panel title="Where the money leaks" sub="Annualized, largest first"
               action={<Link href="/console/tpa/pbm-audit" className="text-[12px] text-blue-600 dark:text-blue-400 inline-flex items-center gap-1">Audit <ArrowRight className="w-3 h-3" /></Link>}>
          <LeakBars rows={leakRows} />
        </Panel>
        <Panel title="Waiting on you" sub="Open items that need a decision">
          <div className="-mx-2">
            {[
              { href: "/console/tpa/asa-disputes", label: "Open ASA disputes", count: data.asa_disputes_open, sub: "X12 276/277 filed against the PBM" },
              { href: "/console/tpa/fraud-referrals", label: "Fraud referrals", count: data.fraud_referrals_open, sub: "LEIE and SAM.gov plus ML signals" },
              { href: "/console/tpa/conflict-audit", label: "Conflict of interest", count: cc.conf ? `${cc.conf.vertical_integration.affiliated_share_pct}%` : "·", sub: "Affiliated steering and broker comp" },
              { href: "/console/tpa/pend-queue", label: "Hard holds to resolve", count: data.hard_holds, sub: "Explicit resolution required" },
            ].map((it) => (
              <Link key={it.href} href={it.href} className="px-2 py-3 flex items-center gap-3 rounded hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="text-[13.5px] font-medium text-slate-900 dark:text-slate-100">{it.label}</div>
                  <div className="text-[12px] text-slate-500 mt-0.5">{it.sub}</div>
                </div>
                <span className="text-[14px] font-medium text-slate-900 dark:text-white tabular-nums">{it.count}</span>
                <ArrowRight className="w-4 h-4 text-slate-300" />
              </Link>
            ))}
          </div>
        </Panel>
      </div>

      {/* Pend snapshot */}
      <section data-tour="pend">
        <div className="flex items-baseline justify-between mb-6">
          <h2 className="font-heading text-[1.4rem] tracking-[-0.02em] text-slate-900 dark:text-white">The pend queue, right now.</h2>
          <Link href="/console/tpa/pend-queue" className="text-[13px] text-blue-600 dark:text-blue-400 inline-flex items-center gap-1 hover:gap-1.5 transition-all">
            Open queue <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-y-8 gap-x-6">
          {[
            { v: data.pend_queue_total, l: "Total pended" },
            { v: data.soft_holds, l: "Soft holds" },
            { v: data.hard_holds, l: "Hard holds" },
            { v: data.pend_queue_breach_risk, l: "Breach risk, 4h" },
            { v: data.pend_queue_overdue, l: "Overdue" },
            { v: `${data.avg_review_turnaround_hours}h`, l: "Avg turnaround" },
          ].map((s) => (
            <div key={s.l}>
              <div className="text-[1.6rem] leading-none tracking-[-0.02em] text-slate-900 dark:text-white tabular-nums">{s.v}</div>
              <div className="text-[12px] text-slate-500 dark:text-slate-400 mt-2">{s.l}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
