"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { DataTable, PageHeader, Column } from "@/components/ui/DataTable";
import { DataSourceList } from "@/components/ui/DataSourceBadge";
import { WorkflowDataSources } from "@/components/ui/WorkflowDataSources";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { DetailDrawer, Field, FieldGroup } from "@/components/ui/DetailDrawer";
import ContractIntegrityPanel from "@/components/prescriptions/ContractIntegrityPanel";
import { InsightPanel, PriorityMap, RankedBars, SignalCard, StackedOutcome } from "@/components/dashboard/InsightCharts";
import { demoFetch } from "@/lib/demoFetch";
import { ArrowUpRight, CircleDollarSign, Clock3, ListFilter, ShieldAlert } from "lucide-react";
import clsx from "clsx";

interface PendItem {
  rx_id: string; patient_name: string; drug_name: string; prescriber: string;
  disposition: string; hold_type: string; flag_color: string; risk_score: number;
  billed_amount: number | null; sla_deadline: string | null;
  sla_remaining_hours: number | null; breach_status: "ok" | "at_risk" | "overdue";
  employer_id: string; employer_name: string; flag_count: number;
}

function TPAPendQueueInner() {
  const searchParams = useSearchParams();
  const breachParam = searchParams.get("breach"); // "at_risk" | "overdue" | null
  const [items, setItems] = useState<PendItem[] | null>(null);
  const [filter, setFilter] = useState("");
  // Risk-first by default: worst claim at the top. A breach deep-link still
  // switches to SLA order, since that view is about the clock, not the risk.
  const [sortBy, setSortBy] = useState<"sla" | "risk" | "cost">(breachParam ? "sla" : "risk");
  const [softCount, setSoftCount] = useState(0);
  const [hardCount, setHardCount] = useState(0);
  const [selected, setSelected] = useState<PendItem | null>(null);

  useEffect(() => {
    const url = filter ? `/api/v1/tpa/pend-queue?hold_type=${filter}&sort_by=${sortBy}&limit=200`
                       : `/api/v1/tpa/pend-queue?sort_by=${sortBy}&limit=200`;
    demoFetch(url).then(d => {
      setItems(d.items); setSoftCount(d.soft_holds); setHardCount(d.hard_holds);
    }).catch(() => {
      setItems([]); setSoftCount(0); setHardCount(0);
    });
  }, [filter, sortBy]);

  if (!items) return <div className="p-6"><TableSkeleton rows={10} cols={8} /></div>;

  // Dashboard deep-link: filter to breach-risk or overdue rows when ?breach= is set
  const visibleItems = breachParam
    ? items.filter(i => i.breach_status === breachParam)
    : items;
  const overdue = items.filter(i => i.breach_status === "overdue").length;
  const atRisk = items.filter(i => i.breach_status === "at_risk").length;
  const maxFlagCount = Math.max(...items.map((item) => item.flag_count), 1);
  const queueValue = items.reduce((sum, item) => sum + (item.billed_amount || 0), 0);
  const avgRisk = items.length ? items.reduce((sum, item) => sum + item.risk_score, 0) / items.length : 0;
  const sponsorExposure = Object.values(items.reduce((acc, item) => {
    const row = acc[item.employer_name] || { label: item.employer_name, value: 0, claims: 0 };
    row.value += item.billed_amount || 0;
    row.claims += 1;
    acc[item.employer_name] = row;
    return acc;
  }, {} as Record<string, { label: string; value: number; claims: number }>)).slice(0, 7);

  const columns: Column<PendItem>[] = [
    { key: "rx", header: "Case", width: "112px",
      render: (i) => (
        <button
          onClick={(event) => { event.stopPropagation(); setSelected(i); }}
          className="inline-flex items-center gap-1 font-mono text-[12px] font-semibold text-blue-600 hover:underline dark:text-blue-400"
        >
          {i.rx_id} <ArrowUpRight className="h-3 w-3" />
        </button>
      ) },
    { key: "member", header: "Member", width: "150px",
      render: (i) => <span className="text-[13px]">{i.patient_name}</span> },
    { key: "drug", header: "Drug",
      render: (i) => <span className="text-[13px] font-semibold">{i.drug_name}</span> },
    { key: "employer", header: "Plan Sponsor",
      render: (i) => <span className="text-[12px] text-slate-700 dark:text-slate-300">{i.employer_name}</span> },
    { key: "disposition", header: "Disposition", width: "110px",
      render: (i) => (
        <div>
          <span className={clsx("text-[11px] px-2 py-0.5 rounded font-bold border",
            i.disposition === "FLAG" ? "bg-red-50 text-red-700 border-red-200 dark:text-red-300 dark:bg-red-900/20"
            : "bg-amber-50 text-amber-700 border-amber-200 dark:text-amber-300 dark:bg-amber-900/20"
          )}>{i.disposition}</span>
          <div className="text-[10px] text-slate-500 mt-0.5">{i.hold_type}</div>
        </div>
      )},
    { key: "sla", header: "SLA", width: "120px",
      render: (i) => i.sla_remaining_hours === null ? <span className="text-slate-300 text-[12px]">·</span> : (
        <span className={clsx("text-[12px] font-semibold",
          i.breach_status === "overdue" ? "text-red-700 dark:text-red-300" : i.breach_status === "at_risk" ? "text-amber-700 dark:text-amber-300" : "text-slate-600 dark:text-slate-400"
        )}>{i.breach_status === "overdue" ? `${Math.abs(i.sla_remaining_hours).toFixed(1)}h overdue` : `${i.sla_remaining_hours.toFixed(1)}h left`}</span>
      )},
    { key: "amount", header: "Amount", width: "100px", align: "right",
      render: (i) => <span className="font-mono tabular-nums text-[12px]">{i.billed_amount ? `$${i.billed_amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "·"}</span> },
    { key: "flags", header: "Flags", width: "60px", align: "right",
      render: (i) => <span className="font-semibold tabular-nums text-[12px]">{i.flag_count}</span> },
  ];

  return (
    <div>
      <PageHeader
        title="Pend Queue"
        subtitle="Claims pended from employer ACH payment sweep · Soft holds auto-release at SLA deadline · Hard holds require explicit resolution"
        meta={<DataSourceList sources={["Kythera", "Truveta"]} />}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <SignalCard label="Decisions waiting" value={items.length} detail={`${hardCount} require explicit review`} icon={<ListFilter className="w-4 h-4" />} />
        <SignalCard label="Plan dollars held" value={`$${Math.round(queueValue / 1000).toLocaleString()}k`} detail="Protected until the review is complete" tone="#7654d6" icon={<CircleDollarSign className="w-4 h-4" />} />
        <SignalCard label="Average risk" value={`${Math.round(avgRisk * 100)}%`} detail="Queue is sorted highest impact first" tone="#b56f0b" icon={<ShieldAlert className="w-4 h-4" />} />
        <SignalCard label="SLA attention" value={overdue + atRisk} detail={`${overdue} overdue · ${atRisk} inside four hours`} tone={overdue ? "#dc4b45" : "#0f8f69"} icon={<Clock3 className="w-4 h-4" />} />
      </div>

      {breachParam && (
        <div className="mb-3 flex items-center justify-between bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded px-3 py-2 text-[12px]">
          <div className="text-amber-900 dark:text-amber-200">
            Filtered from dashboard: showing only <strong>{breachParam === "overdue" ? "overdue" : "at-risk"}</strong> pends ({visibleItems.length} of {items.length})
          </div>
          <Link href="/console/tpa/pend-queue" className="text-amber-700 dark:text-amber-300 hover:underline font-semibold">Clear filter</Link>
        </div>
      )}

      <div className="mb-3 flex items-center gap-2">
        <button onClick={() => setFilter("")} className={clsx("text-[12px] px-2.5 py-1 rounded border font-semibold",
          !filter ? "border-blue-600 bg-blue-50 text-blue-700 dark:text-blue-300 dark:bg-blue-900/20" : "border-slate-300 hover:bg-slate-50"
        )}>All ({items.length})</button>
        <button onClick={() => setFilter("soft_hold")} className={clsx("text-[12px] px-2.5 py-1 rounded border font-semibold",
          filter === "soft_hold" ? "border-amber-600 bg-amber-50 text-amber-700 dark:text-amber-300 dark:bg-amber-900/20" : "border-slate-300 hover:bg-slate-50"
        )}>Soft ({softCount})</button>
        <button onClick={() => setFilter("hard_hold")} className={clsx("text-[12px] px-2.5 py-1 rounded border font-semibold",
          filter === "hard_hold" ? "border-red-600 bg-red-50 text-red-700 dark:text-red-300 dark:bg-red-900/20" : "border-slate-300 hover:bg-slate-50"
        )}>Hard ({hardCount})</button>
        <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)}
          className="ml-auto text-[12px] px-2.5 py-1 rounded border border-slate-300 bg-white dark:bg-slate-800">
          <option value="risk">Sort: risk score</option>
          <option value="cost">Sort: claim cost</option>
          <option value="sla">Sort: SLA deadline</option>
        </select>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4 mb-5">
        <InsightPanel title="Priority map" description="Each bubble is a claim. Higher means more plan dollars; farther right means more independent risk signals." className="xl:col-span-3">
          <PriorityMap data={visibleItems.slice(0, 70).map((item) => ({
            name: item.rx_id,
            risk: item.flag_count / maxFlagCount,
            cost: item.billed_amount || 0,
            size: Math.max(1, item.flag_count),
            detail: `${item.drug_name} · ${item.employer_name}`,
          }))} />
        </InsightPanel>
        <InsightPanel title="Exposure by plan sponsor" description="Held claim value, ranked so reviewers can protect the largest books first." className="xl:col-span-2">
          <RankedBars data={sponsorExposure.map((row) => ({ ...row, note: `${row.claims} claims` }))} valueFormatter={(value) => `$${Math.round(value).toLocaleString()}`} height={270} color="#7654d6" />
        </InsightPanel>
      </div>

      <InsightPanel title="Queue composition" description="Hard holds stay blocked until a reviewer resolves them; soft holds can release at the deadline." className="mb-5">
        <StackedOutcome segments={[
          { label: "Hard holds", value: hardCount, color: "#dc4b45" },
          { label: "Soft holds", value: softCount, color: "#c98a12" },
          { label: "SLA attention", value: overdue + atRisk, color: "#7654d6" },
        ]} />
      </InsightPanel>

      <WorkflowDataSources workflow="Pend Queue" sources={[
        { name: "Kythera Wayfinder", type: "validation", used_for: "Pharmacy claim batch (NCPDP Batch 1.2)" },
        { name: "Truveta TDM", type: "validation", used_for: "Patient context for false-positive suppression (Engine 3)" },
        { name: "FDA DailyMed", type: "live_api", used_for: "Drug labels for clinical flag evidence" },
        { name: "RxNav (NLM)", type: "live_api", used_for: "Drug normalization + interactions" },
        { name: "HHS-OIG LEIE", type: "live_api", used_for: "Excluded prescriber screening (foundational)" },
        { name: "openFDA Drug Recalls", type: "live_api", used_for: "Active recall enforcement check" },
        { name: "XGBoost", type: "ml_model", used_for: "Per-claim fraud probability for prioritization" },
        { name: "Patient Context Layer (TF-IDF + LR)", type: "ml_model", used_for: "False positive suppression on flag text" },
      ]} />

      <div className="flex items-end justify-between mb-3">
        <div>
          <h2 className="text-[15px] font-semibold text-slate-900 dark:text-white">Claims to review</h2>
          <p className="text-[11.5px] text-slate-500 mt-0.5">Open a row for the clinical evidence, pricing context, and disposition controls.</p>
        </div>
        <span className="text-[11px] tabular-nums text-slate-400">{visibleItems.length} shown</span>
      </div>
      <DataTable columns={columns} rows={visibleItems} rowKey={(i) => i.rx_id}
        emptyMessage="No claims currently pended. Claims held from employer ACH payment sweep will appear here."
        onRowClick={setSelected} />

      <DetailDrawer
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected ? `Case ${selected.rx_id}` : "Case"}
        subtitle={selected ? `${selected.drug_name} · ${selected.patient_name} · ${selected.employer_name}` : undefined}
        actions={selected ? (
          <Link
            href={`/console/prescriptions/${selected.rx_id}`}
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-[12px] font-semibold text-white hover:bg-indigo-700"
          >
            Open full evidence record <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        ) : undefined}
      >
        {selected && (
          <div className="space-y-5">
            <ContractIntegrityPanel compact input={{
              id: selected.rx_id,
              drugName: selected.drug_name,
              billedAmount: selected.billed_amount,
              riskScore: selected.risk_score,
              employerName: selected.employer_name,
            }} />
            <div className="grid gap-4 sm:grid-cols-2">
              <FieldGroup title="Case context">
                <Field label="Member" value={selected.patient_name} />
                <Field label="Plan sponsor" value={selected.employer_name} />
                <Field label="Drug" value={selected.drug_name} />
                <Field label="Prescriber" value={selected.prescriber} />
              </FieldGroup>
              <FieldGroup title="Decision controls">
                <Field label="Disposition" value={selected.disposition} mono />
                <Field label="Hold" value={selected.hold_type.replace("_", " ")} />
                <Field label="Risk" value={`${Math.round(selected.risk_score * 100)}/100`} mono />
                <Field label="Independent signals" value={selected.flag_count} mono />
                <Field label="SLA" value={selected.sla_remaining_hours == null ? "Manual resolution" : selected.breach_status === "overdue" ? `${Math.abs(selected.sla_remaining_hours)}h overdue` : `${selected.sla_remaining_hours}h remaining`} />
              </FieldGroup>
            </div>
          </div>
        )}
      </DetailDrawer>
    </div>
  );
}

// Wrap with Suspense · Next.js 14 requires it around any client component
// that calls useSearchParams() to allow the page to opt into static rendering.
export default function TPAPendQueuePage() {
  return (
    <Suspense fallback={<div className="p-6"><TableSkeleton rows={10} cols={8} /></div>}>
      <TPAPendQueueInner />
    </Suspense>
  );
}
