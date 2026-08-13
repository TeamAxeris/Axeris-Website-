"use client";

import { useEffect, useState } from "react";
import { demoFetch, invalidate } from "@/lib/demoFetch";
import { DataTable, PageHeader, StatRow, Column } from "@/components/ui/DataTable";
import { DetailDrawer, FieldGroup, Field } from "@/components/ui/DetailDrawer";
import { DataSourceList } from "@/components/ui/DataSourceBadge";
import { TableSkeleton } from "@/components/ui/Skeleton";
import clsx from "clsx";
import { CheckCircle2 } from "lucide-react";
import { InsightPanel, RankedBars, StackedOutcome } from "@/components/dashboard/InsightCharts";

type DefectKey =
  | "copay_clawback"
  | "channel_misrouting"
  | "specialty_misrouting"
  | "preventive_copay"
  | "biosimilar_not_steered";

type FilterKey = "all" | DefectKey;

interface PlanDesignFinding {
  claim_id: string;
  rx_id: string;
  employer_name: string;
  drug_name: string;
  brand_name: string;
  allowed_usd: number;
  copay_usd: number;
  days_supply: number;
  defect: DefectKey;
  detail: string;
  remedy: string;
  annual_impact_usd: number;
  bears_cost: "plan" | "member";
  compliance?: string;
  status: "open" | "adopted";
}

// `defect` here is a display label from the backend (e.g. "Copay clawback"),
// not necessarily one of the snake_case DefectKey values used on findings.
interface DefectBreakdown {
  defect: string;
  findings: number;
  annual_usd: number;
}

const GET_URL = "/api/v1/tpa/plan-design";

const DEFECT_META: Record<DefectKey, { label: string; cls: string }> = {
  copay_clawback: {
    label: "Copay Clawback",
    cls: "bg-amber-50 text-amber-700 border-amber-200 dark:text-amber-300 dark:bg-amber-900/20",
  },
  channel_misrouting: {
    label: "Channel Misrouting",
    cls: "bg-blue-50 text-blue-700 border-blue-200 dark:text-blue-300 dark:bg-blue-900/20",
  },
  specialty_misrouting: {
    label: "Specialty Misrouting",
    cls: "bg-violet-50 text-violet-700 border-violet-200 dark:text-violet-300 dark:bg-violet-900/20",
  },
  preventive_copay: {
    label: "Preventive Copay",
    cls: "bg-red-50 text-red-700 border-red-200 dark:text-red-300 dark:bg-red-900/20",
  },
  biosimilar_not_steered: {
    label: "Biosimilar Not Steered",
    cls: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:text-emerald-300 dark:bg-emerald-900/20",
  },
};

const DEFECT_ORDER: DefectKey[] = [
  "copay_clawback",
  "channel_misrouting",
  "specialty_misrouting",
  "preventive_copay",
  "biosimilar_not_steered",
];

const money = (n: number) => `$${Math.round(n || 0).toLocaleString()}`;

export default function TPAPlanDesignPage() {
  const [data, setData] = useState<any>(null);
  const [selected, setSelected] = useState<PlanDesignFinding | null>(null);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [posting, setPosting] = useState(false);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [actionErr, setActionErr] = useState(false);

  useEffect(() => {
    demoFetch(GET_URL).then(setData).catch(() => {});
  }, []);

  if (!data) return <div className="p-6"><TableSkeleton rows={8} cols={9} /></div>;

  const findings: PlanDesignFinding[] = data.findings || [];
  const byDefect: DefectBreakdown[] = data.by_defect || [];
  const s = data.summary || {};

  const counts = DEFECT_ORDER.reduce((acc, k) => {
    acc[k] = findings.filter((f) => f.defect === k).length;
    return acc;
  }, {} as Record<DefectKey, number>);

  const chips: { key: FilterKey; label: string; count: number }[] = [
    { key: "all", label: "All", count: findings.length },
    ...DEFECT_ORDER.map((k) => ({ key: k as FilterKey, label: DEFECT_META[k].label, count: counts[k] })),
  ];

  const filtered = filter === "all" ? findings : findings.filter((f) => f.defect === filter);

  const adoptChange = async (f: PlanDesignFinding) => {
    setPosting(true);
    try {
      const res = await fetch(`/api/v1/tpa/plan-design/${f.claim_id}/adopt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ claim_id: f.claim_id }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      invalidate(GET_URL);
      setData((d: any) =>
        d
          ? {
              ...d,
              findings: (d.findings || []).map((x: PlanDesignFinding) =>
                x.claim_id === f.claim_id ? { ...x, status: "adopted" } : x
              ),
            }
          : d
      );
      setSelected((cur) => (cur && cur.claim_id === f.claim_id ? { ...cur, status: "adopted" } : cur));
      setActionErr(false);
      setActionMsg(
        `Design change queued for ${f.drug_name} (${f.claim_id}). The amendment will be written into the plan document and picked up in the next-renewal SBC update.`
      );
    } catch {
      setActionErr(true);
      setActionMsg("Design change could not be adopted · backend unreachable. Please try again.");
    } finally {
      setPosting(false);
    }
  };

  const columns: Column<PlanDesignFinding>[] = [
    {
      key: "drug",
      header: "Drug",
      render: (r) => (
        <div className="leading-tight">
          <div className="font-semibold text-slate-900 dark:text-white text-[13px]">{r.drug_name}</div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400">{r.brand_name}</div>
        </div>
      ),
    },
    {
      key: "employer",
      header: "Employer",
      render: (r) => <span className="text-[13px] text-slate-800 dark:text-slate-200">{r.employer_name}</span>,
    },
    {
      key: "defect",
      header: "Defect",
      width: "160px",
      render: (r) => (
        <span
          className={clsx(
            "text-[11px] px-2 py-0.5 rounded border font-semibold whitespace-nowrap",
            DEFECT_META[r.defect].cls
          )}
        >
          {DEFECT_META[r.defect].label}
        </span>
      ),
    },
    {
      key: "detail",
      header: "Detail",
      render: (r) => (
        <span className="text-[12px] text-slate-600 dark:text-slate-300 block max-w-[280px] truncate" title={r.detail}>
          {r.detail}
        </span>
      ),
    },
    {
      key: "allowed",
      header: "Allowed",
      width: "90px",
      align: "right",
      render: (r) => <span className="tabular-nums text-slate-700 dark:text-slate-300">{money(r.allowed_usd)}</span>,
    },
    {
      key: "copay",
      header: "Copay",
      width: "80px",
      align: "right",
      render: (r) => <span className="tabular-nums text-slate-700 dark:text-slate-300">{money(r.copay_usd)}</span>,
    },
    {
      key: "annual",
      header: "Annual Impact",
      width: "110px",
      align: "right",
      render: (r) => (
        <span className="tabular-nums font-bold text-slate-900 dark:text-white">{money(r.annual_impact_usd)}</span>
      ),
    },
    {
      key: "bears",
      header: "Bears Cost",
      width: "100px",
      render: (r) => (
        <span
          className={clsx(
            "text-[11px] px-2 py-0.5 rounded border font-semibold whitespace-nowrap",
            r.bears_cost === "member"
              ? "bg-amber-50 text-amber-700 border-amber-200 dark:text-amber-300 dark:bg-amber-900/20"
              : "bg-slate-100 text-slate-700 border-slate-200 dark:text-slate-300 dark:bg-slate-700/50 dark:border-slate-600"
          )}
        >
          {r.bears_cost === "member" ? "Member" : "Plan"}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      width: "100px",
      render: (r) =>
        r.status === "adopted" ? (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="w-3.5 h-3.5" /> Adopted
          </span>
        ) : (
          <span className="text-[11px] px-2 py-0.5 rounded border font-semibold whitespace-nowrap bg-slate-50 text-slate-600 border-slate-200 dark:text-slate-300 dark:bg-slate-800 dark:border-slate-600">
            Open
          </span>
        ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Plan Design Leakage"
        subtitle="Benefit-design defects that spend money quietly on every fill · copay clawback, channel and specialty misrouting, ACA §2713 preventive copays, and biosimilars the formulary never steers to."
        meta={<DataSourceList sources={["Truveta", "NADAC", "Internal"]} />}
      />

      <div className="mb-3">
        <StatRow
          items={[
            { label: "Findings", value: s.findings ?? findings.length, sub: "Design defects detected" },
            {
              label: "Annual Impact",
              value: money(s.total_annual_impact_usd),
              sub: "Run-rate leakage",
              severity: "alert",
            },
            { label: "Plan-Borne", value: money(s.plan_borne_usd), sub: "Paid by the plan" },
            { label: "Member-Borne", value: money(s.member_borne_usd), sub: "Cost shifted to members" },
            {
              label: "Compliance Defects",
              value: s.compliance_defects ?? 0,
              sub: "ACA §2713",
              severity: "alert",
            },
          ]}
        />
      </div>

      {byDefect.length > 0 && (
        <div className="grid grid-cols-1 xl:grid-cols-5 gap-4 mb-5">
          <InsightPanel title="Annual leakage by design defect" description="The largest benefit-design opportunities rise to the top, independent of how many claims produced them." className="xl:col-span-3">
            <RankedBars data={byDefect.map((row) => ({ label: DEFECT_META[row.defect as DefectKey]?.label ?? row.defect, value: row.annual_usd, note: `${row.findings} findings` }))} valueFormatter={money} height={250} color="#2f2fe6" />
          </InsightPanel>
          <InsightPanel title="Finding mix" description="Volume shows where the plan document creates repeated friction; dollars show where to amend first." className="xl:col-span-2">
            <StackedOutcome segments={byDefect.map((row, index) => ({
              label: DEFECT_META[row.defect as DefectKey]?.label ?? row.defect,
              value: row.findings,
              color: ["#2f2fe6", "#7654d6", "#0f8f69", "#c98a12", "#dc4b45"][index % 5],
            }))} />
            <div className="mt-6 rounded-xl bg-slate-50 dark:bg-slate-900/30 p-3.5"><div className="text-[10px] uppercase tracking-[0.12em] text-slate-400">Recommended focus</div><p className="text-[11.5px] text-slate-600 dark:text-slate-300 leading-relaxed mt-2">Start with the highest annual-dollar defect, then use claim detail below to package the plan amendment and member impact.</p></div>
          </InsightPanel>
        </div>
      )}

      <div className="mb-3 flex items-center gap-2 flex-wrap">
        {chips.map((c) => (
          <button
            key={c.key}
            onClick={() => setFilter(c.key)}
            title={`Show ${c.label.toLowerCase()} findings (${c.count})`}
            className={clsx(
              "text-[12px] px-2.5 py-1 rounded-full border font-medium transition-colors",
              filter === c.key
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-600 hover:border-blue-400"
            )}
          >
            {c.label} ({c.count})
          </button>
        ))}
      </div>

      <div className="flex items-end justify-between mb-3"><div><h2 className="text-[15px] font-semibold text-slate-900 dark:text-white">Design findings</h2><p className="text-[11.5px] text-slate-500 mt-0.5">Open a row for the affected claim, member impact, and recommended amendment.</p></div><span className="text-[11px] text-slate-400">{filtered.length} shown</span></div>
      <DataTable
        columns={columns}
        rows={filtered}
        // A single claim can trigger several defect classes, so claim_id alone is not unique.
        rowKey={(r) => `${r.claim_id}:${r.defect}`}
        onRowClick={(r) => {
          setSelected(r);
          setActionMsg(null);
          setActionErr(false);
        }}
        emptyMessage="No findings match this filter"
      />

      <DetailDrawer
        open={!!selected}
        onClose={() => {
          setSelected(null);
          setActionMsg(null);
          setActionErr(false);
        }}
        title={selected ? selected.drug_name : ""}
        subtitle={selected ? `${selected.claim_id} · ${DEFECT_META[selected.defect].label}` : ""}
        actions={
          selected && (
            <button
              onClick={() => adoptChange(selected)}
              disabled={posting || selected.status === "adopted"}
              title={
                selected.status === "adopted"
                  ? "This design change has already been adopted"
                  : "Queue this benefit-design change for the plan document and next-renewal SBC"
              }
              className={clsx(
                "px-3 py-1.5 text-[13px] rounded text-white",
                posting || selected.status === "adopted"
                  ? "bg-blue-400 cursor-not-allowed"
                  : "bg-blue-600 hover:bg-blue-700"
              )}
            >
              {selected.status === "adopted" ? "Adopted ✓" : posting ? "Adopting…" : "Adopt Design Change"}
            </button>
          )
        }
      >
        {selected && (
          <>
            {actionMsg && (
              <div
                className={clsx(
                  "mb-5 rounded-md px-4 py-3 text-[13px] border",
                  actionErr
                    ? "bg-red-50 border-red-300 text-red-900 dark:bg-red-900/20 dark:text-red-200"
                    : "bg-emerald-50 border-emerald-300 text-emerald-900 dark:bg-emerald-900/20 dark:text-emerald-200"
                )}
              >
                {actionMsg}
              </div>
            )}

            <div
              className={clsx(
                "mb-5 rounded-md px-4 py-3 text-[13px] border leading-relaxed",
                selected.compliance
                  ? "bg-red-50 border-red-200 text-red-900 dark:bg-red-900/20 dark:text-red-200"
                  : "bg-amber-50 border-amber-200 text-amber-900 dark:bg-amber-900/20 dark:text-amber-200"
              )}
            >
              <div>
                <span className="font-semibold">Why flagged: </span>
                {selected.detail}
              </div>
              <div className="mt-2">
                <span className="font-semibold">Recommended change: </span>
                {selected.remedy}
              </div>
              {selected.compliance && (
                <div className="mt-2">
                  <span className="font-semibold">Regulatory exposure: </span>
                  {selected.compliance}
                </div>
              )}
            </div>

            <FieldGroup title="Claim">
              <Field label="Claim ID" value={selected.claim_id} mono />
              <Field label="Rx ID" value={selected.rx_id} mono />
              <Field label="Employer" value={selected.employer_name} />
              <Field label="Drug" value={selected.drug_name} />
              <Field label="Brand" value={selected.brand_name} />
            </FieldGroup>

            <FieldGroup title="Economics">
              <Field label="Allowed" value={money(selected.allowed_usd)} mono />
              <Field label="Copay" value={money(selected.copay_usd)} mono />
              <Field label="Days Supply" value={String(selected.days_supply)} mono />
              <Field label="Annual Impact" value={money(selected.annual_impact_usd)} mono />
              <Field label="Bears Cost" value={selected.bears_cost === "member" ? "Member" : "Plan"} />
            </FieldGroup>

            <FieldGroup title="Defect">
              <Field
                label="Defect Class"
                value={
                  <span
                    className={clsx(
                      "text-[11px] px-2 py-0.5 rounded border font-semibold",
                      DEFECT_META[selected.defect].cls
                    )}
                  >
                    {DEFECT_META[selected.defect].label}
                  </span>
                }
              />
              <Field label="Detail" value={selected.detail} />
              <Field label="Remedy" value={selected.remedy} />
              {selected.compliance && <Field label="Compliance" value={selected.compliance} />}
              <Field
                label="Status"
                value={selected.status === "adopted" ? "Adopted · queued for plan document" : "Open"}
              />
            </FieldGroup>
          </>
        )}
      </DetailDrawer>
    </div>
  );
}
