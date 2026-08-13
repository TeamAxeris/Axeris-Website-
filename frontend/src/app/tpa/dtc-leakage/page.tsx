"use client";

import { useEffect, useState } from "react";
import { demoFetch, invalidate } from "@/lib/demoFetch";
import { DataTable, PageHeader, StatRow, Column } from "@/components/ui/DataTable";
import { DetailDrawer, FieldGroup, Field } from "@/components/ui/DetailDrawer";
import { DataSourceList } from "@/components/ui/DataSourceBadge";
import { TableSkeleton } from "@/components/ui/Skeleton";
import clsx from "clsx";
import { CheckCircle2, ExternalLink } from "lucide-react";
import { InsightPanel, RankedBars, StackedOutcome } from "@/components/dashboard/InsightCharts";

type LeakStatus = "open" | "coordinated";
type ViewKey = "overpayments" | "duplicates";

interface OverpayRow {
  claim_id: string;
  rx_id: string;
  patient_id: string;
  employer_name: string;
  drug_name: string;
  brand_name: string;
  days_supply: number;
  plan_allowed_usd: number;
  dtc_channel: string;
  dtc_price_usd: number;
  overpay_usd: number;
  overpay_pct: number;
  annualized_usd: number;
  status: LeakStatus;
}

interface DuplicateRow {
  claim_id: string;
  rx_id: string;
  patient_id: string;
  patient_initials: string;
  drug_name: string;
  dtc_channel: string;
  plan_fill_date: string;
  days_supply: number;
  dtc_fill_offset_days: number;
  overlap_days: number;
  duplicate_supply_usd: number;
  clinical_risk: string;
  status: LeakStatus;
}

type SelectedRow =
  | { kind: "overpayment"; row: OverpayRow }
  | { kind: "duplicate"; row: DuplicateRow };

const GET_URL = "/api/v1/tpa/dtc-leakage";

const STATUS_META: Record<LeakStatus, { label: string; cls: string }> = {
  open: { label: "Open", cls: "bg-red-50 text-red-700 border-red-200 dark:text-red-300 dark:bg-red-900/20" },
  coordinated: {
    label: "Coordinated",
    cls: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:text-emerald-300 dark:bg-emerald-900/20",
  },
};

const money = (n: number) => `$${Math.round(n || 0).toLocaleString()}`;

const isHighRisk = (risk: string) => (risk || "").toLowerCase() === "double-dosing exposure";

export default function TPADtcLeakagePage() {
  const [data, setData] = useState<any>(null);
  const [view, setView] = useState<ViewKey>("overpayments");
  const [selected, setSelected] = useState<SelectedRow | null>(null);
  const [posting, setPosting] = useState(false);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [actionErr, setActionErr] = useState(false);

  useEffect(() => {
    demoFetch(GET_URL).then(setData).catch(() => {});
  }, []);

  if (!data) return <div className="p-6"><TableSkeleton rows={8} cols={9} /></div>;

  const overpayments: OverpayRow[] = data.overpayments || [];
  const duplicates: DuplicateRow[] = data.duplicates || [];
  const s = data.summary || {};

  const views: { key: ViewKey; label: string; count: number }[] = [
    { key: "overpayments", label: "Overpayments", count: overpayments.length },
    { key: "duplicates", label: "Duplicate Supply", count: duplicates.length },
  ];

  const clearAction = () => {
    setActionMsg(null);
    setActionErr(false);
  };

  const coordinate = async (sel: SelectedRow) => {
    const claimId = sel.row.claim_id;
    setPosting(true);
    try {
      const res = await fetch(`/api/v1/tpa/dtc-leakage/${claimId}/coordinate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ claim_id: claimId }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      invalidate(GET_URL);
      const listKey = sel.kind === "overpayment" ? "overpayments" : "duplicates";
      setData((d: any) =>
        d
          ? {
              ...d,
              [listKey]: (d[listKey] || []).map((x: OverpayRow | DuplicateRow) =>
                x.claim_id === claimId ? { ...x, status: "coordinated" } : x
              ),
            }
          : d
      );
      setSelected((cur) =>
        cur && cur.row.claim_id === claimId
          ? ({ kind: cur.kind, row: { ...cur.row, status: "coordinated" } } as SelectedRow)
          : cur
      );
      setActionErr(false);
      setActionMsg(
        `Benefit coordination opened for claim ${claimId}. The member will be steered to the published direct price, duplicate supply reconciled against the open fill window, and the direct-channel spend credited to the deductible accumulator.`
      );
    } catch {
      setActionErr(true);
      setActionMsg("Coordination could not be submitted · backend unreachable. Please try again.");
    } finally {
      setPosting(false);
    }
  };

  const statusBadge = (st: LeakStatus) => (
    <span
      className={clsx(
        "text-[11px] px-2 py-0.5 rounded border font-semibold whitespace-nowrap",
        STATUS_META[st].cls
      )}
    >
      {STATUS_META[st].label}
    </span>
  );

  const overpayColumns: Column<OverpayRow>[] = [
    {
      key: "drug",
      header: "Drug",
      render: (r) => (
        <div>
          <div className="font-semibold text-slate-900 dark:text-white">{r.drug_name}</div>
          <div className="text-[12px] text-slate-500 dark:text-slate-400">{r.brand_name}</div>
        </div>
      ),
    },
    {
      key: "employer",
      header: "Employer",
      render: (r) => <span className="text-[13px] text-slate-800 dark:text-slate-200">{r.employer_name}</span>,
    },
    {
      key: "days",
      header: "Days Supply",
      width: "90px",
      align: "right",
      render: (r) => <span className="tabular-nums text-slate-700 dark:text-slate-300">{r.days_supply}</span>,
    },
    {
      key: "plan_paid",
      header: "Plan Paid",
      width: "95px",
      align: "right",
      render: (r) => <span className="tabular-nums text-slate-700 dark:text-slate-300">{money(r.plan_allowed_usd)}</span>,
    },
    {
      key: "channel",
      header: "DTC Channel",
      width: "120px",
      render: (r) => <span className="text-[12px] text-slate-500 dark:text-slate-400">{r.dtc_channel}</span>,
    },
    {
      key: "direct_price",
      header: "Direct Price",
      width: "95px",
      align: "right",
      render: (r) => <span className="tabular-nums text-slate-700 dark:text-slate-300">{money(r.dtc_price_usd)}</span>,
    },
    {
      key: "overpay",
      header: "Overpay",
      width: "115px",
      align: "right",
      render: (r) => (
        <span className="tabular-nums font-bold text-red-700 dark:text-red-400">
          {money(r.overpay_usd)}{" "}
          <span className="text-[11px] font-semibold">({r.overpay_pct}%)</span>
        </span>
      ),
    },
    {
      key: "annualized",
      header: "Annualized",
      width: "100px",
      align: "right",
      render: (r) => <span className="tabular-nums text-slate-900 dark:text-white">{money(r.annualized_usd)}</span>,
    },
    {
      key: "status",
      header: "Status",
      width: "110px",
      render: (r) => statusBadge(r.status),
    },
  ];

  const duplicateColumns: Column<DuplicateRow>[] = [
    {
      key: "member",
      header: "Member",
      width: "90px",
      render: (r) => (
        <span className="font-mono text-[12px] font-semibold text-slate-700 dark:text-slate-200">
          {r.patient_initials}
        </span>
      ),
    },
    {
      key: "drug",
      header: "Drug",
      render: (r) => <span className="font-semibold text-slate-900 dark:text-white">{r.drug_name}</span>,
    },
    {
      key: "channel",
      header: "DTC Channel",
      width: "120px",
      render: (r) => <span className="text-[12px] text-slate-500 dark:text-slate-400">{r.dtc_channel}</span>,
    },
    {
      key: "plan_fill",
      header: "Plan Fill Date",
      width: "110px",
      render: (r) => <span className="font-mono text-[12px] text-slate-700 dark:text-slate-300">{r.plan_fill_date}</span>,
    },
    {
      key: "days",
      header: "Days Supply",
      width: "90px",
      align: "right",
      render: (r) => <span className="tabular-nums text-slate-700 dark:text-slate-300">{r.days_supply}</span>,
    },
    {
      key: "overlap",
      header: "Overlap Days",
      width: "95px",
      align: "right",
      render: (r) => <span className="tabular-nums font-bold text-amber-700 dark:text-amber-400">{r.overlap_days}</span>,
    },
    {
      key: "dup_cost",
      header: "Duplicate Cost",
      width: "110px",
      align: "right",
      render: (r) => (
        <span className="tabular-nums font-bold text-slate-900 dark:text-white">{money(r.duplicate_supply_usd)}</span>
      ),
    },
    {
      key: "risk",
      header: "Clinical Risk",
      width: "150px",
      render: (r) => (
        <span
          className={clsx(
            "text-[11px] px-2 py-0.5 rounded border font-semibold",
            isHighRisk(r.clinical_risk)
              ? "bg-red-50 text-red-700 border-red-200 dark:text-red-300 dark:bg-red-900/20"
              : "bg-amber-50 text-amber-700 border-amber-200 dark:text-amber-300 dark:bg-amber-900/20"
          )}
        >
          {r.clinical_risk}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      width: "110px",
      render: (r) => statusBadge(r.status),
    },
  ];

  const drawerTitle = !selected
    ? ""
    : selected.kind === "overpayment"
      ? `${selected.row.drug_name} · ${selected.row.employer_name}`
      : `Member ${selected.row.patient_initials} · ${selected.row.drug_name}`;

  const drawerSubtitle = !selected
    ? ""
    : selected.kind === "overpayment"
      ? `${selected.row.claim_id} · ${selected.row.dtc_channel} · ${STATUS_META[selected.row.status].label}`
      : `${selected.row.claim_id} · ${selected.row.dtc_channel} · ${STATUS_META[selected.row.status].label}`;

  return (
    <div>
      <PageHeader
        title="Direct-to-Consumer Leakage"
        subtitle="Manufacturer-direct and cash-card channels sit outside plan adjudication · surfacing overpayment against published direct prices, duplicate supply across channels, and spend that never reaches the deductible accumulator."
        meta={<DataSourceList sources={["Truveta", "NADAC", "Internal"]} />}
      />

      <div className="mb-3">
        <StatRow
          items={[
            { label: "Overpay Claims", value: s.overpay_claims ?? overpayments.length, sub: "Above published direct price" },
            { label: "Plan Overpayment", value: money(s.total_overpay_usd), sub: "Plan paid vs. direct price", severity: "alert" },
            { label: "Annualized", value: money(s.annualized_overpay_usd), sub: "Run-rate if unchanged", severity: "alert" },
            {
              label: "Duplicate Supply",
              value: money(s.duplicate_supply_usd),
              sub: `${s.duplicate_supply_members ?? 0} members`,
              severity: "warn",
            },
            { label: "Accumulator Gap", value: money(s.accumulator_gap_usd), sub: "Never credited to deductible" },
          ]}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4 mb-5">
        <InsightPanel title="Annual leakage by drug" description="Where plan-paid pricing sits furthest above an available direct channel." className="xl:col-span-3">
          <RankedBars data={Object.values(overpayments.reduce((acc, row) => { const current = acc[row.drug_name] || { label: row.drug_name, value: 0, claims: 0 }; current.value += row.annualized_usd; current.claims += 1; acc[row.drug_name] = current; return acc; }, {} as Record<string, { label: string; value: number; claims: number }>)).slice(0, 8).map((row) => ({ ...row, note: `${row.claims} claims` }))} valueFormatter={money} height={275} color="#dc4b45" />
        </InsightPanel>
        <InsightPanel title="What needs attention" description="Pricing leakage and duplicate supply are distinct problems with different owners." className="xl:col-span-2">
          <StackedOutcome segments={[
            { label: "Price gaps", value: overpayments.filter((row) => row.status === "open").length, color: "#dc4b45" },
            { label: "Duplicate supply", value: duplicates.filter((row) => row.status === "open").length, color: "#c98a12" },
            { label: "Coordinated", value: [...overpayments, ...duplicates].filter((row) => row.status === "coordinated").length, color: "#0f8f69" },
          ]} />
          <div className="mt-6 rounded-xl bg-slate-50 dark:bg-slate-900/30 p-3.5"><div className="text-[10px] uppercase tracking-[0.12em] text-slate-400">What the comparison means</div><p className="text-[11.5px] text-slate-600 dark:text-slate-300 leading-relaxed mt-2">Axeris compares the plan&apos;s allowed amount with the published direct price for the same therapy and supply. Overlap with a second channel is tracked separately as a member-safety issue.</p></div>
        </InsightPanel>
      </div>

      <div className="mb-3 flex items-center gap-2 flex-wrap">
        {views.map((v) => (
          <button
            key={v.key}
            onClick={() => {
              setView(v.key);
              setSelected(null);
              clearAction();
            }}
            title={`Show ${v.label.toLowerCase()} (${v.count})`}
            className={clsx(
              "text-[13px] px-3.5 py-1.5 rounded-full border-2 font-semibold transition-colors",
              view === v.key
                ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-600 hover:border-blue-400"
            )}
          >
            {v.label} ({v.count})
          </button>
        ))}
      </div>

      <div className="flex items-end justify-between mb-3"><div><h2 className="text-[15px] font-semibold text-slate-900 dark:text-white">{view === "overpayments" ? "Claims with a lower direct option" : "Members with overlapping supply"}</h2><p className="text-[11.5px] text-slate-500 mt-0.5">Open a row for member context, channel evidence, and coordination controls.</p></div></div>
      {view === "overpayments" ? (
        <DataTable
          columns={overpayColumns}
          rows={overpayments}
          rowKey={(r) => r.claim_id}
          onRowClick={(r) => {
            setSelected({ kind: "overpayment", row: r });
            clearAction();
          }}
          emptyMessage="No overpayment claims detected"
        />
      ) : (
        <DataTable
          columns={duplicateColumns}
          rows={duplicates}
          rowKey={(r) => r.claim_id}
          onRowClick={(r) => {
            setSelected({ kind: "duplicate", row: r });
            clearAction();
          }}
          emptyMessage="No duplicate-supply members detected"
        />
      )}

      <DetailDrawer
        open={!!selected}
        onClose={() => {
          setSelected(null);
          clearAction();
        }}
        title={drawerTitle}
        subtitle={drawerSubtitle}
        actions={
          selected && (
            <>
              <a
                href={`/patients/${selected.row.patient_id}`}
                title="Open the full member chart in the Patients module"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[13px] rounded border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700"
              >
                <ExternalLink className="w-3.5 h-3.5" /> Open Member Chart
              </a>
              <button
                onClick={() => coordinate(selected)}
                disabled={posting || selected.row.status === "coordinated"}
                title={
                  selected.row.status === "coordinated"
                    ? "Benefit coordination has already been opened for this claim"
                    : "Steer the member to the published direct price, reconcile duplicate supply, and credit the spend to the deductible accumulator"
                }
                className={clsx(
                  "px-3 py-1.5 text-[13px] rounded text-white",
                  posting || selected.row.status === "coordinated"
                    ? "bg-blue-400 cursor-not-allowed"
                    : "bg-blue-600 hover:bg-blue-700"
                )}
              >
                {selected.row.status === "coordinated"
                  ? "Coordinated ✓"
                  : posting
                    ? "Coordinating…"
                    : "Coordinate Benefit"}
              </button>
            </>
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

            {selected.kind === "overpayment" ? (
              <>
                <div className="mb-5 rounded-md px-4 py-3 text-[13px] border leading-relaxed bg-red-50 border-red-200 text-red-900 dark:bg-red-900/20 dark:text-red-200 dark:border-red-800">
                  <span className="font-semibold">Why flagged: </span>
                  The plan paid {money(selected.row.plan_allowed_usd)} on this claim while the member could have paid{" "}
                  {money(selected.row.dtc_price_usd)} in cash through {selected.row.dtc_channel} · a published direct
                  channel · for the identical drug and the same {selected.row.days_supply}-day supply. The plan is
                  therefore absorbing {money(selected.row.overpay_usd)} ({selected.row.overpay_pct}%) above the
                  best-available cash price for the same fill.
                </div>

                <FieldGroup title="Claim">
                  <Field label="Claim ID" value={selected.row.claim_id} mono />
                  <Field label="Rx ID" value={selected.row.rx_id} mono />
                  <Field label="Member ID" value={selected.row.patient_id} mono />
                  <Field label="Employer" value={selected.row.employer_name} />
                </FieldGroup>

                <FieldGroup title="Pricing">
                  <Field label="Plan Allowed" value={money(selected.row.plan_allowed_usd)} mono />
                  <Field label="DTC Channel" value={selected.row.dtc_channel} />
                  <Field label="Direct Price" value={money(selected.row.dtc_price_usd)} mono />
                  <Field label="Overpayment" value={money(selected.row.overpay_usd)} mono />
                  <Field label="Overpayment %" value={`${selected.row.overpay_pct}%`} mono />
                  <Field label="Annualized" value={money(selected.row.annualized_usd)} mono />
                  <Field label="Days Supply" value={`${selected.row.days_supply} days`} mono />
                </FieldGroup>

                <FieldGroup title="Disposition">
                  <Field
                    label="Status"
                    value={
                      <span
                        className={clsx(
                          "text-[11px] px-2 py-0.5 rounded border font-semibold",
                          STATUS_META[selected.row.status].cls
                        )}
                      >
                        {STATUS_META[selected.row.status].label}
                      </span>
                    }
                  />
                </FieldGroup>
              </>
            ) : (
              <>
                <div
                  className={clsx(
                    "mb-5 rounded-md px-4 py-3 text-[13px] border leading-relaxed",
                    isHighRisk(selected.row.clinical_risk)
                      ? "bg-red-50 border-red-200 text-red-900 dark:bg-red-900/20 dark:text-red-200 dark:border-red-800"
                      : "bg-amber-50 border-amber-200 text-amber-900 dark:bg-amber-900/20 dark:text-amber-200 dark:border-amber-800"
                  )}
                >
                  <span className="font-semibold">Why flagged: </span>
                  The member holds overlapping supply from two uncoordinated channels · a plan-adjudicated fill on{" "}
                  {selected.row.plan_fill_date} for {selected.row.days_supply} days and a{" "}
                  {selected.row.dtc_channel} fill {selected.row.dtc_fill_offset_days} days later · leaving{" "}
                  {selected.row.overlap_days} overlapping days and {money(selected.row.duplicate_supply_usd)} of
                  duplicate spend. This is both wasted plan dollars and a real {selected.row.clinical_risk} the plan
                  cannot see, because the direct-channel fill never enters adjudication or the member&apos;s claims history.
                </div>

                <FieldGroup title="Member">
                  <Field label="Member ID" value={selected.row.patient_id} mono />
                  <Field label="Initials" value={selected.row.patient_initials} mono />
                </FieldGroup>

                <FieldGroup title="Duplicate Supply">
                  <Field label="Drug" value={selected.row.drug_name} />
                  <Field label="DTC Channel" value={selected.row.dtc_channel} />
                  <Field label="Plan Fill Date" value={selected.row.plan_fill_date} mono />
                  <Field label="Days Supply" value={`${selected.row.days_supply} days`} mono />
                  <Field label="DTC Fill Offset" value={`${selected.row.dtc_fill_offset_days} days`} mono />
                  <Field label="Overlap Days" value={`${selected.row.overlap_days} days`} mono />
                  <Field label="Duplicate Cost" value={money(selected.row.duplicate_supply_usd)} mono />
                  <Field
                    label="Clinical Risk"
                    value={
                      <span
                        className={clsx(
                          "text-[11px] px-2 py-0.5 rounded border font-semibold",
                          isHighRisk(selected.row.clinical_risk)
                            ? "bg-red-50 text-red-700 border-red-200 dark:text-red-300 dark:bg-red-900/20"
                            : "bg-amber-50 text-amber-700 border-amber-200 dark:text-amber-300 dark:bg-amber-900/20"
                        )}
                      >
                        {selected.row.clinical_risk}
                      </span>
                    }
                  />
                </FieldGroup>

                <FieldGroup title="Disposition">
                  <Field label="Claim ID" value={selected.row.claim_id} mono />
                  <Field label="Rx ID" value={selected.row.rx_id} mono />
                  <Field
                    label="Status"
                    value={
                      selected.row.status === "coordinated" ? (
                        <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-emerald-700 dark:text-emerald-400">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Coordinated
                        </span>
                      ) : (
                        <span
                          className={clsx(
                            "text-[11px] px-2 py-0.5 rounded border font-semibold",
                            STATUS_META[selected.row.status].cls
                          )}
                        >
                          {STATUS_META[selected.row.status].label}
                        </span>
                      )
                    }
                  />
                </FieldGroup>
              </>
            )}
          </>
        )}
      </DetailDrawer>
    </div>
  );
}
