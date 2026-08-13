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

type MacStatus = "open" | "appealed";
type FilterKey = "all" | MacStatus;

interface AffectedClaim {
  claim_id: string;
  rx_id: string;
  claim_date: string;
  pharmacy_name: string;
  pbm_affiliated: boolean;
  employer_name: string;
  units: number;
  unit_price_usd: number;
  allowed_usd: number;
  overpay_usd: number;
}

interface EmployerImpact {
  employer_name: string;
  claims: number;
  units: number;
  exposure_usd: number;
}

interface MacItem {
  drug_id: string;
  drug_name: string;
  brand_name: string;
  therapeutic_category: string | null;
  drug_class: string | null;
  is_specialty: boolean;
  generic_available: boolean;
  claims_observed: number;
  claims_at_new_price: number;
  early_unit_price_usd: number;
  late_unit_price_usd: number;
  unit_delta_usd: number;
  nadac_unit_usd: number;
  margin_over_nadac_pct: number;
  plan_drift_pct: number;
  nadac_drift_pct: number;
  unexplained_drift_pct: number;
  units_at_new_price: number;
  exposure_usd: number;
  annualized_exposure_usd: number;
  book_exposure_usd: number;
  window_start: string;
  window_end: string;
  reset_effective: string;
  days_since_reset: number;
  appeal_deadline_days: number;
  affected_claims: AffectedClaim[];
  by_employer: EmployerImpact[];
  evidence: string[];
  recommended_action: string;
  status: MacStatus;
}

const GET_URL = "/api/v1/tpa/mac-repricing";

const STATUS_META: Record<MacStatus, { label: string; cls: string }> = {
  open: { label: "Open", cls: "bg-red-50 text-red-700 border-red-200 dark:text-red-300 dark:bg-red-900/20" },
  appealed: { label: "Appealed", cls: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:text-emerald-300 dark:bg-emerald-900/20" },
};

const money = (n: number) => `$${Math.round(n || 0).toLocaleString()}`;
const unit = (n: number) => `$${(n || 0).toFixed(4)}`;
const pct = (n: number) => `${n ?? 0}%`;
const signedPct = (n: number) => `${(n ?? 0) > 0 ? "+" : ""}${n ?? 0}%`;
// Backend sends full ISO datetimes (e.g. 2026-06-20T21:07:48.640814); only the date is meaningful here.
const day = (d: string) => (d ? String(d).slice(0, 10) : "·");

export default function TPAMacRepricingPage() {
  const [data, setData] = useState<any>(null);
  const [selected, setSelected] = useState<MacItem | null>(null);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [posting, setPosting] = useState(false);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [actionErr, setActionErr] = useState(false);

  useEffect(() => {
    demoFetch(GET_URL).then(setData).catch(() => {});
  }, []);

  if (!data) return <div className="p-6"><TableSkeleton rows={8} cols={9} /></div>;

  const items: MacItem[] = data.items || [];
  const s = data.summary || {};

  const counts: Record<MacStatus, number> = {
    open: items.filter((i) => i.status === "open").length,
    appealed: items.filter((i) => i.status === "appealed").length,
  };

  const chips: { key: FilterKey; label: string; count: number }[] = [
    { key: "all", label: "All", count: items.length },
    { key: "open", label: "Open", count: counts.open },
    { key: "appealed", label: "Appealed", count: counts.appealed },
  ];

  const filtered = filter === "all" ? items : items.filter((i) => i.status === filter);

  const fileAppeal = async (m: MacItem) => {
    setPosting(true);
    try {
      const res = await fetch(`/api/v1/tpa/mac-repricing/${m.drug_id}/file-appeal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ drug_id: m.drug_id }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      invalidate(GET_URL);
      setData((d: any) =>
        d
          ? {
              ...d,
              items: (d.items || []).map((x: MacItem) =>
                x.drug_id === m.drug_id ? { ...x, status: "appealed" as MacStatus } : x
              ),
            }
          : d
      );
      setSelected((cur) =>
        cur && cur.drug_id === m.drug_id ? { ...cur, status: "appealed" as MacStatus } : cur
      );
      setActionErr(false);
      setActionMsg(
        `MAC appeal filed for ${m.drug_name}. Under most state MAC-transparency statutes the PBM must respond with acquisition-cost justification · or reprice the claims · within the statutory window (typically 7-14 days).`
      );
    } catch {
      setActionErr(true);
      setActionMsg("Appeal could not be submitted · backend unreachable. Please try again.");
    } finally {
      setPosting(false);
    }
  };

  const columns: Column<MacItem>[] = [
    {
      key: "drug",
      header: "Drug",
      render: (r) => (
        <div>
          <div className="font-semibold text-[13px] text-slate-900 dark:text-white">{r.drug_name}</div>
          <div className="text-[11.5px] text-slate-500 dark:text-slate-400">{r.brand_name}</div>
        </div>
      ),
    },
    {
      key: "claims",
      header: "Claims",
      width: "70px",
      align: "right",
      render: (r) => <span className="tabular-nums text-slate-700 dark:text-slate-300">{r.claims_observed.toLocaleString()}</span>,
    },
    {
      key: "was",
      header: "Was",
      width: "90px",
      align: "right",
      render: (r) => <span className="tabular-nums text-slate-600 dark:text-slate-400">{unit(r.early_unit_price_usd)}</span>,
    },
    {
      key: "now",
      header: "Now",
      width: "90px",
      align: "right",
      render: (r) => <span className="tabular-nums font-bold text-slate-900 dark:text-white">{unit(r.late_unit_price_usd)}</span>,
    },
    {
      key: "plan_drift",
      header: "Plan Drift",
      width: "85px",
      align: "right",
      render: (r) => <span className="tabular-nums font-semibold text-red-700 dark:text-red-400">{signedPct(r.plan_drift_pct)}</span>,
    },
    {
      key: "nadac_drift",
      header: "NADAC Drift",
      width: "95px",
      align: "right",
      render: (r) => <span className="tabular-nums text-slate-500 dark:text-slate-400">{pct(r.nadac_drift_pct)}</span>,
    },
    {
      key: "unexplained",
      header: "Unexplained",
      width: "100px",
      align: "right",
      render: (r) => <span className="tabular-nums font-bold text-red-700 dark:text-red-400">{signedPct(r.unexplained_drift_pct)}</span>,
    },
    {
      key: "exposure",
      header: "Exposure",
      width: "100px",
      align: "right",
      render: (r) => <span className="tabular-nums font-bold text-slate-900 dark:text-white">{money(r.exposure_usd)}</span>,
    },
    {
      key: "status",
      header: "Status",
      width: "100px",
      render: (r) => (
        <span className={clsx("text-[11px] px-2 py-0.5 rounded border font-semibold whitespace-nowrap", STATUS_META[r.status].cls)}>
          {STATUS_META[r.status].label}
        </span>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="MAC Repricing Audit"
        subtitle="Detects unilateral PBM resets of the Maximum Allowable Cost list · where the plan's realized price rises without any matching move in the drug's acquisition cost."
        meta={<DataSourceList sources={["NADAC", "Internal"]} />}
      />

      <div className="mb-3">
        <StatRow
          items={[
            { label: "Drugs Repriced", value: s.drugs_repriced ?? items.length, sub: "MAC resets detected" },
            {
              label: "Observed Exposure",
              value: money(s.total_exposure_usd),
              sub: s.sampled_lives ? `Across ${Number(s.sampled_lives).toLocaleString()} sampled lives` : "Plan overpayment, sampled book",
            },
            {
              label: "Book Projection",
              value: money(s.book_projection_usd),
              sub: `Scaled to ${Number(s.book_lives || 0).toLocaleString()} lives`,
            },
            {
              label: "Worst Unexplained Drift",
              value: `${s.worst_unexplained_pct ?? 0}%`,
              sub: s.worst_drug || "·",
              severity: "alert",
            },
            { label: "Appeals Filed", value: s.appeals_filed ?? counts.appealed, sub: "Submitted to PBM" },
          ]}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4 mb-5">
        <InsightPanel title="Projected exposure by drug" description="The largest unexplained price resets are surfaced first, before the appeal window closes." className="xl:col-span-3">
          <RankedBars data={items.slice(0, 8).map((item) => ({ label: item.drug_name, value: item.book_exposure_usd || item.annualized_exposure_usd, note: `${signedPct(item.unexplained_drift_pct)} unexplained drift` }))} valueFormatter={money} height={275} color="#dc4b45" />
        </InsightPanel>
        <InsightPanel title="Appeal posture" description="A quick read on what is still exposed and what has already moved into recovery." className="xl:col-span-2">
          <StackedOutcome segments={[
            { label: "Open", value: counts.open, color: "#dc4b45" },
            { label: "Appealed", value: counts.appealed, color: "#0f8f69" },
            { label: "Near deadline", value: items.filter((item) => item.appeal_deadline_days <= 10 && item.status === "open").length, color: "#c98a12" },
          ]} />
          <div className="mt-6 rounded-xl bg-slate-50 dark:bg-slate-900/30 p-3.5"><div className="text-[10px] uppercase tracking-[0.12em] text-slate-400">Audit logic</div><p className="text-[11.5px] text-slate-600 dark:text-slate-300 leading-relaxed mt-2">Axeris compares the PBM&apos;s MAC change with acquisition-cost movement. Only the price drift that the benchmark cannot explain becomes an appeal opportunity.</p></div>
        </InsightPanel>
      </div>

      <div className="mb-3 flex items-center gap-2 flex-wrap">
        {chips.map((c) => (
          <button
            key={c.key}
            onClick={() => setFilter(c.key)}
            title={`Show ${c.label.toLowerCase()} repricing events (${c.count})`}
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

      <div className="flex items-end justify-between mb-3"><div><h2 className="text-[15px] font-semibold text-slate-900 dark:text-white">Repricing events</h2><p className="text-[11.5px] text-slate-500 mt-0.5">Open a drug to see affected claims, plan sponsors, evidence, and appeal controls.</p></div><span className="text-[11px] text-slate-400">{filtered.length} shown</span></div>
      <DataTable
        columns={columns}
        rows={filtered}
        rowKey={(r) => r.drug_id}
        onRowClick={(r) => {
          setSelected(r);
          setActionMsg(null);
          setActionErr(false);
        }}
        emptyMessage="No repricing events match this filter"
      />

      <DetailDrawer
        open={!!selected}
        onClose={() => {
          setSelected(null);
          setActionMsg(null);
          setActionErr(false);
        }}
        title={selected ? selected.drug_name : ""}
        subtitle={selected ? `${selected.brand_name} · ${STATUS_META[selected.status].label}` : ""}
        actions={
          selected && (
            <button
              onClick={() => fileAppeal(selected)}
              disabled={posting || selected.status === "appealed"}
              title={
                selected.status === "appealed"
                  ? "A MAC appeal has already been filed for this drug"
                  : "File a MAC appeal requiring the PBM to justify the price increase with acquisition-cost documentation"
              }
              className={clsx(
                "px-3 py-1.5 text-[13px] rounded text-white",
                posting || selected.status === "appealed"
                  ? "bg-blue-400 cursor-not-allowed"
                  : "bg-blue-600 hover:bg-blue-700"
              )}
            >
              {selected.status === "appealed" ? "Appeal Filed ✓" : posting ? "Filing…" : "File MAC Appeal"}
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

            <div className="mb-5 rounded-md px-4 py-3 text-[13px] border leading-relaxed bg-amber-50 border-amber-200 text-amber-900 dark:bg-amber-900/20 dark:text-amber-200 dark:border-amber-800">
              <span className="font-semibold">Why flagged: </span>
              The plan&apos;s realized price for this drug rose {signedPct(selected.plan_drift_pct)} while the CMS NADAC
              acquisition benchmark moved {pct(selected.nadac_drift_pct)}. Acquisition cost does not explain the increase,
              which is the signature of a unilateral MAC list reset. This is appealable.
            </div>

            {/* Headline price move · the whole case in one glance */}
            <div className="mb-5 grid grid-cols-3 gap-2">
              <div className="rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 px-3 py-2.5">
                <div className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400 font-semibold">Was</div>
                <div className="text-[15px] font-bold tabular-nums text-slate-700 dark:text-slate-200">{unit(selected.early_unit_price_usd)}</div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400">per unit</div>
              </div>
              <div className="rounded-md border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-3 py-2.5">
                <div className="text-[10px] uppercase tracking-wide text-red-600 dark:text-red-400 font-semibold">Now</div>
                <div className="text-[15px] font-bold tabular-nums text-red-700 dark:text-red-300">{unit(selected.late_unit_price_usd)}</div>
                <div className="text-[10px] text-red-600 dark:text-red-400">+{unit(selected.unit_delta_usd)} per unit</div>
              </div>
              <div className="rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 px-3 py-2.5">
                <div className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400 font-semibold">NADAC</div>
                <div className="text-[15px] font-bold tabular-nums text-slate-700 dark:text-slate-200">{unit(selected.nadac_unit_usd)}</div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400">acquisition benchmark</div>
              </div>
            </div>

            <FieldGroup title="Drug">
              <Field label="Drug ID" value={selected.drug_id} mono />
              <Field label="Generic Name" value={selected.drug_name} />
              <Field label="Brand Name" value={selected.brand_name} />
              <Field label="Class" value={selected.drug_class || "·"} />
              <Field label="Therapeutic Category" value={selected.therapeutic_category || "·"} />
              <Field
                label="Type"
                value={
                  <span className="flex flex-wrap gap-1">
                    {selected.is_specialty && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded border font-semibold bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-900/20 dark:text-violet-300 dark:border-violet-800">Specialty</span>
                    )}
                    {selected.generic_available && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded border font-semibold bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800">Generic available</span>
                    )}
                    {!selected.is_specialty && !selected.generic_available && <span className="text-slate-400">·</span>}
                  </span>
                }
              />
            </FieldGroup>

            <FieldGroup title="MAC List Reset">
              <Field label="Reset Effective" value={day(selected.reset_effective)} mono />
              <Field label="Days Since Reset" value={`${selected.days_since_reset.toLocaleString()} days`} mono />
              <Field
                label="Plan Drift"
                value={<span className="font-semibold text-red-700 dark:text-red-400">{signedPct(selected.plan_drift_pct)}</span>}
              />
              <Field
                label="NADAC Drift (benchmark)"
                value={<span className="text-slate-600 dark:text-slate-300">{pct(selected.nadac_drift_pct)}</span>}
              />
              <Field
                label="Unexplained Drift"
                value={<span className="font-bold text-red-700 dark:text-red-400">{signedPct(selected.unexplained_drift_pct)}</span>}
              />
              <Field
                label="Margin Over NADAC"
                value={<span className="font-semibold text-amber-700 dark:text-amber-400">{signedPct(selected.margin_over_nadac_pct)}</span>}
              />
              <Field label="Observation Window" value={`${day(selected.window_start)} → ${day(selected.window_end)}`} mono />
            </FieldGroup>

            <FieldGroup title="Financial Exposure">
              <Field label="Claims Observed" value={selected.claims_observed.toLocaleString()} mono />
              <Field label="Claims at New Price" value={selected.claims_at_new_price.toLocaleString()} mono />
              <Field label="Units at New Price" value={selected.units_at_new_price.toLocaleString()} mono />
              <Field label="Exposure to Date" value={<span className="font-bold">{money(selected.exposure_usd)}</span>} mono />
              <Field label="Annualized Run-Rate" value={money(selected.annualized_exposure_usd)} mono />
              <Field label="Book Projection" value={money(selected.book_exposure_usd)} mono />
            </FieldGroup>

            {/* Which plan sponsors actually paid for it */}
            {selected.by_employer?.length > 0 && (
              <div className="mb-6">
                <h4 className="text-[11px] uppercase tracking-wide font-semibold text-slate-500 dark:text-slate-400 mb-2">
                  Plan Sponsor Impact
                </h4>
                <div className="overflow-x-auto rounded-md border border-slate-200 dark:border-slate-700">
                  <table className="w-full text-[12px]">
                    <thead className="bg-slate-50 dark:bg-slate-800/60">
                      <tr className="text-slate-600 dark:text-slate-300">
                        <th className="text-left font-semibold px-3 py-1.5">Plan Sponsor</th>
                        <th className="text-right font-semibold px-3 py-1.5">Claims</th>
                        <th className="text-right font-semibold px-3 py-1.5">Units</th>
                        <th className="text-right font-semibold px-3 py-1.5">Exposure</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selected.by_employer.map((e) => (
                        <tr key={e.employer_name} className="border-t border-slate-200 dark:border-slate-700">
                          <td className="px-3 py-1.5 text-slate-800 dark:text-slate-200">{e.employer_name}</td>
                          <td className="px-3 py-1.5 text-right tabular-nums text-slate-600 dark:text-slate-300">{e.claims}</td>
                          <td className="px-3 py-1.5 text-right tabular-nums text-slate-600 dark:text-slate-300">{e.units.toLocaleString()}</td>
                          <td className="px-3 py-1.5 text-right tabular-nums font-semibold text-slate-900 dark:text-white">{money(e.exposure_usd)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Every claim that paid the new price */}
            {selected.affected_claims?.length > 0 && (
              <div className="mb-6">
                <h4 className="text-[11px] uppercase tracking-wide font-semibold text-slate-500 dark:text-slate-400 mb-2">
                  Affected Claims ({selected.affected_claims.length})
                </h4>
                <div className="overflow-x-auto rounded-md border border-slate-200 dark:border-slate-700 max-h-72 overflow-y-auto">
                  <table className="w-full text-[12px]">
                    <thead className="bg-slate-50 dark:bg-slate-800/60 sticky top-0">
                      <tr className="text-slate-600 dark:text-slate-300">
                        <th className="text-left font-semibold px-3 py-1.5">Claim</th>
                        <th className="text-left font-semibold px-3 py-1.5">Date</th>
                        <th className="text-left font-semibold px-3 py-1.5">Pharmacy</th>
                        <th className="text-right font-semibold px-3 py-1.5">Units</th>
                        <th className="text-right font-semibold px-3 py-1.5">Unit</th>
                        <th className="text-right font-semibold px-3 py-1.5">Overpay</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selected.affected_claims.map((a) => (
                        <tr key={a.claim_id} className="border-t border-slate-200 dark:border-slate-700">
                          <td className="px-3 py-1.5 font-mono text-[11px] text-slate-700 dark:text-slate-300">{a.claim_id}</td>
                          <td className="px-3 py-1.5 tabular-nums text-slate-600 dark:text-slate-300">{day(a.claim_date)}</td>
                          <td className="px-3 py-1.5 text-slate-700 dark:text-slate-300">
                            {a.pharmacy_name}
                            {a.pbm_affiliated && (
                              <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded border font-semibold bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800">
                                PBM-owned
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-1.5 text-right tabular-nums text-slate-600 dark:text-slate-300">{a.units.toLocaleString()}</td>
                          <td className="px-3 py-1.5 text-right tabular-nums text-slate-600 dark:text-slate-300">{unit(a.unit_price_usd)}</td>
                          <td className="px-3 py-1.5 text-right tabular-nums font-semibold text-red-700 dark:text-red-400">{money(a.overpay_usd)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* What the appeal will actually cite */}
            {selected.evidence?.length > 0 && (
              <div className="mb-6">
                <h4 className="text-[11px] uppercase tracking-wide font-semibold text-slate-500 dark:text-slate-400 mb-2">
                  Appeal Evidence Chain
                </h4>
                <ol className="space-y-1.5">
                  {selected.evidence.map((e, idx) => (
                    <li
                      key={idx}
                      className="flex gap-2 text-[12px] leading-relaxed text-slate-700 dark:text-slate-300 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 px-3 py-2"
                    >
                      <span className="font-bold text-slate-400 dark:text-slate-500 shrink-0">{idx + 1}.</span>
                      <span>{e}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            <div className="mb-5 rounded-md px-4 py-3 text-[13px] border leading-relaxed bg-blue-50 border-blue-200 text-blue-900 dark:bg-blue-900/20 dark:text-blue-200 dark:border-blue-800">
              <span className="font-semibold">Recommended action: </span>
              {selected.recommended_action}
            </div>

            <FieldGroup title="Appeal Status">
              <Field label="Statutory Response Window" value={`${selected.appeal_deadline_days} days`} mono />
              <Field
                label="Status"
                value={
                  selected.status === "appealed" ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Appeal Filed
                    </span>
                  ) : (
                    <span className={clsx("text-[11px] px-2 py-0.5 rounded border font-semibold", STATUS_META[selected.status].cls)}>
                      {STATUS_META[selected.status].label}
                    </span>
                  )
                }
              />
            </FieldGroup>
          </>
        )}
      </DetailDrawer>
    </div>
  );
}
