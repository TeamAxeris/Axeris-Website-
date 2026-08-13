"use client";

import { useEffect, useState } from "react";
import { demoFetch, invalidate } from "@/lib/demoFetch";
import { DataTable, PageHeader, StatRow, Column } from "@/components/ui/DataTable";
import { DetailDrawer, FieldGroup, Field } from "@/components/ui/DetailDrawer";
import { DataSourceList } from "@/components/ui/DataSourceBadge";
import { TableSkeleton } from "@/components/ui/Skeleton";
import clsx from "clsx";
import { CheckCircle2, XCircle, ExternalLink } from "lucide-react";
import { InsightPanel, RankedBars, StackedOutcome } from "@/components/dashboard/InsightCharts";

type GlpStatus = "indication_review" | "step_therapy_gap" | "appropriate";
type FilterKey = "all" | GlpStatus;

interface GlpMember {
  patient_id: string;
  patient_initials: string;
  drugs: string[];
  fills: number;
  paid_to_date_usd: number;
  monthly_cost_usd: number;
  annualized_usd: number;
  has_t2dm_dx: boolean;
  first_line_tried: boolean;
  status: GlpStatus;
  last_fill: string;
  review_referred: boolean;
}

const GET_URL = "/api/v1/tpa/glp1-watch";

const STATUS_META: Record<GlpStatus, { label: string; cls: string }> = {
  indication_review: { label: "Indication Review", cls: "bg-red-50 text-red-700 border-red-200 dark:text-red-300 dark:bg-red-900/20" },
  step_therapy_gap: { label: "Step Gap", cls: "bg-amber-50 text-amber-700 border-amber-200 dark:text-amber-300 dark:bg-amber-900/20" },
  appropriate: { label: "Appropriate", cls: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:text-emerald-300 dark:bg-emerald-900/20" },
};

const WHY_FLAGGED: Partial<Record<GlpStatus, string>> = {
  indication_review:
    "No E11.x (T2DM) diagnosis on file · GLP-1 coverage requires diabetes indication or documented weight-management benefit rider",
  step_therapy_gap:
    "No metformin (first-line) claim history · plan step-therapy policy requires documented trial",
};

const money = (n: number) => `$${Math.round(n || 0).toLocaleString()}`;

export default function TPAGlp1WatchPage() {
  const [data, setData] = useState<any>(null);
  const [selected, setSelected] = useState<GlpMember | null>(null);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [posting, setPosting] = useState(false);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [actionErr, setActionErr] = useState(false);

  useEffect(() => {
    demoFetch(GET_URL).then(setData).catch(() => {});
  }, []);

  if (!data) return <div className="p-6"><TableSkeleton rows={8} cols={7} /></div>;

  const members: GlpMember[] = data.members || [];
  const s = data.summary || {};

  const counts: Record<GlpStatus, number> = {
    indication_review: members.filter((m) => m.status === "indication_review").length,
    step_therapy_gap: members.filter((m) => m.status === "step_therapy_gap").length,
    appropriate: members.filter((m) => m.status === "appropriate").length,
  };

  const chips: { key: FilterKey; label: string; count: number }[] = [
    { key: "all", label: "All", count: members.length },
    { key: "indication_review", label: "Indication Review", count: counts.indication_review },
    { key: "step_therapy_gap", label: "Step-Therapy Gap", count: counts.step_therapy_gap },
    { key: "appropriate", label: "Appropriate", count: counts.appropriate },
  ];

  const filtered = filter === "all" ? members : members.filter((m) => m.status === filter);
  const spendByStatus = (Object.keys(counts) as GlpStatus[]).map((status) => ({
    status,
    value: members.filter((member) => member.status === status).reduce((sum, member) => sum + member.annualized_usd, 0),
  }));

  const referReview = async (m: GlpMember) => {
    setPosting(true);
    try {
      const res = await fetch(`/api/v1/tpa/glp1-watch/${m.patient_id}/refer-review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patient_id: m.patient_id }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      invalidate(GET_URL);
      setData((d: any) =>
        d
          ? {
              ...d,
              members: (d.members || []).map((x: GlpMember) =>
                x.patient_id === m.patient_id ? { ...x, review_referred: true } : x
              ),
            }
          : d
      );
      setSelected((cur) =>
        cur && cur.patient_id === m.patient_id ? { ...cur, review_referred: true } : cur
      );
      setActionErr(false);
      setActionMsg(
        `Clinical review referral created for member ${m.patient_id}. Care management will verify indication documentation and step-therapy history before next fill.`
      );
    } catch {
      setActionErr(true);
      setActionMsg("Referral could not be submitted · backend unreachable. Please try again.");
    } finally {
      setPosting(false);
    }
  };

  const yesNo = (v: boolean, yes = "Yes", no = "No") =>
    v ? (
      <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-semibold">
        <CheckCircle2 className="w-3.5 h-3.5" /> {yes}
      </span>
    ) : (
      <span className="inline-flex items-center gap-1 text-red-700 dark:text-red-400 font-semibold">
        <XCircle className="w-3.5 h-3.5" /> {no}
      </span>
    );

  const columns: Column<GlpMember>[] = [
    {
      key: "member",
      header: "Member",
      width: "90px",
      render: (r) => <span className="font-mono text-[12px] font-semibold text-slate-700 dark:text-slate-200">{r.patient_initials}</span>,
    },
    {
      key: "drugs",
      header: "GLP-1 Drugs",
      render: (r) => <span className="text-[13px] text-slate-800 dark:text-slate-200">{r.drugs.join(", ")}</span>,
    },
    {
      key: "fills",
      header: "Fills",
      width: "60px",
      align: "right",
      render: (r) => <span className="tabular-nums">{r.fills}</span>,
    },
    {
      key: "monthly",
      header: "Monthly",
      width: "90px",
      align: "right",
      render: (r) => <span className="tabular-nums text-slate-700 dark:text-slate-300">{money(r.monthly_cost_usd)}</span>,
    },
    {
      key: "annualized",
      header: "Annualized",
      width: "100px",
      align: "right",
      render: (r) => <span className="tabular-nums font-bold text-slate-900 dark:text-white">{money(r.annualized_usd)}</span>,
    },
    {
      key: "t2dm",
      header: "T2DM Dx",
      width: "80px",
      align: "center",
      render: (r) =>
        r.has_t2dm_dx ? (
          <CheckCircle2 className="w-4 h-4 text-emerald-600 inline" aria-label="T2DM diagnosis on file" />
        ) : (
          <XCircle className="w-4 h-4 text-red-500 inline" aria-label="No T2DM diagnosis on file" />
        ),
    },
    {
      key: "firstline",
      header: "First-line",
      width: "80px",
      align: "center",
      render: (r) =>
        r.first_line_tried ? (
          <CheckCircle2 className="w-4 h-4 text-emerald-600 inline" aria-label="First-line therapy tried" />
        ) : (
          <XCircle className="w-4 h-4 text-red-500 inline" aria-label="First-line therapy not tried" />
        ),
    },
    {
      key: "status",
      header: "Status",
      width: "140px",
      render: (r) => (
        <span className={clsx("text-[11px] px-2 py-0.5 rounded border font-semibold whitespace-nowrap", STATUS_META[r.status].cls)}>
          {STATUS_META[r.status].label}
        </span>
      ),
    },
    {
      key: "referred",
      header: "Referred",
      width: "90px",
      render: (r) =>
        r.review_referred ? (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="w-3.5 h-3.5" /> Referred
          </span>
        ) : (
          <span className="text-[11px] text-slate-400">·</span>
        ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="GLP-1 Utilization Watch"
        subtitle="The fastest-growing employer drug-spend line · indication verification, step-therapy compliance, and avoidable-spend surfacing."
        meta={<DataSourceList sources={["Truveta", "Internal"]} />}
      />

      <div className="mb-3">
        <StatRow
          items={[
            { label: "Members on GLP-1", value: s.members_on_glp1 ?? members.length, sub: "Active class utilizers" },
            {
              label: "Annualized Class Spend",
              value: money(s.annualized_class_spend_usd),
              sub: s.avg_monthly_cost_usd ? `Avg ${money(s.avg_monthly_cost_usd)}/member/mo` : "Plan-paid, run-rate",
            },
            { label: "Avoidable / yr", value: money(s.avoidable_annualized_usd), sub: "Flagged members' run-rate", severity: "alert" },
            { label: "Indication Review", value: s.indication_review_count ?? counts.indication_review, sub: "No T2DM dx on file", severity: "alert" },
            { label: "Step-Therapy Gaps", value: s.step_therapy_gap_count ?? counts.step_therapy_gap, sub: "No first-line trial", severity: "warn" },
          ]}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4 mb-5">
        <InsightPanel title="Annual spend by review outcome" description="The flagged portion is where indication or first-line documentation can change next-fill spend." className="xl:col-span-3">
          <RankedBars data={spendByStatus.map((row) => ({
            label: STATUS_META[row.status].label,
            value: row.value,
            color: row.status === "appropriate" ? "#0f8f69" : row.status === "step_therapy_gap" ? "#c98a12" : "#dc4b45",
            note: `${counts[row.status]} members`,
          }))} valueFormatter={money} height={215} />
        </InsightPanel>
        <InsightPanel title="Clinical disposition" description="A clean view of which members can continue and which need documentation before the next fill." className="xl:col-span-2">
          <StackedOutcome segments={[
            { label: "Appropriate", value: counts.appropriate, color: "#0f8f69" },
            { label: "Step gap", value: counts.step_therapy_gap, color: "#c98a12" },
            { label: "Indication review", value: counts.indication_review, color: "#dc4b45" },
          ]} />
          <div className="grid grid-cols-2 gap-3 mt-6 pt-4 border-t border-slate-200 dark:border-slate-700">
            <div><div className="text-[1.55rem] leading-none tracking-[-0.04em] tabular-nums text-red-700 dark:text-red-300">{counts.indication_review + counts.step_therapy_gap}</div><div className="text-[10.5px] text-slate-500 mt-1.5">members need review</div></div>
            <div><div className="text-[1.55rem] leading-none tracking-[-0.04em] tabular-nums text-slate-900 dark:text-white">{money(s.avoidable_annualized_usd)}</div><div className="text-[10.5px] text-slate-500 mt-1.5">annual spend in scope</div></div>
          </div>
        </InsightPanel>
      </div>

      <div className="mb-3 flex items-center gap-2 flex-wrap">
        {chips.map((c) => (
          <button
            key={c.key}
            onClick={() => setFilter(c.key)}
            title={`Show ${c.label.toLowerCase()} members (${c.count})`}
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

      <DataTable
        columns={columns}
        rows={filtered}
        rowKey={(r) => r.patient_id}
        onRowClick={(r) => {
          setSelected(r);
          setActionMsg(null);
          setActionErr(false);
        }}
        emptyMessage="No members match this filter"
      />

      <DetailDrawer
        open={!!selected}
        onClose={() => {
          setSelected(null);
          setActionMsg(null);
          setActionErr(false);
        }}
        title={selected ? `Member ${selected.patient_initials}` : ""}
        subtitle={selected ? `${selected.patient_id} · ${STATUS_META[selected.status].label}` : ""}
        actions={
          selected && (
            <>
              <a
                href={`/console/patients/${selected.patient_id}`}
                title="Open the full member chart in the Patients module"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[13px] rounded border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700"
              >
                <ExternalLink className="w-3.5 h-3.5" /> Open Member Chart
              </a>
              <button
                onClick={() => referReview(selected)}
                disabled={posting || selected.review_referred}
                title={
                  selected.review_referred
                    ? "This member has already been referred for clinical review"
                    : "Refer this member to care management for indication and step-therapy verification"
                }
                className={clsx(
                  "px-3 py-1.5 text-[13px] rounded text-white",
                  posting || selected.review_referred
                    ? "bg-blue-400 cursor-not-allowed"
                    : "bg-blue-600 hover:bg-blue-700"
                )}
              >
                {selected.review_referred ? "Referred ✓" : posting ? "Referring…" : "Refer for Clinical Review"}
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

            {WHY_FLAGGED[selected.status] && (
              <div
                className={clsx(
                  "mb-5 rounded-md px-4 py-3 text-[13px] border leading-relaxed",
                  selected.status === "indication_review"
                    ? "bg-red-50 border-red-200 text-red-900 dark:bg-red-900/20 dark:text-red-200"
                    : "bg-amber-50 border-amber-200 text-amber-900 dark:bg-amber-900/20"
                )}
              >
                <span className="font-semibold">Why flagged: </span>
                {WHY_FLAGGED[selected.status]}
              </div>
            )}

            <FieldGroup title="Member">
              <Field label="Member ID" value={selected.patient_id} mono />
              <Field label="Initials" value={selected.patient_initials} />
            </FieldGroup>

            <FieldGroup title="Therapy">
              <Field label="GLP-1 Drugs" value={selected.drugs.join(", ")} />
              <Field label="Fills" value={selected.fills.toString()} mono />
              <Field label="Last Fill" value={selected.last_fill} mono />
              <Field label="Paid to Date" value={money(selected.paid_to_date_usd)} mono />
              <Field label="Monthly Cost" value={money(selected.monthly_cost_usd)} mono />
              <Field label="Annualized" value={money(selected.annualized_usd)} mono />
            </FieldGroup>

            <FieldGroup title="Clinical Basis">
              <Field label="T2DM Diagnosis (E11.x)" value={yesNo(selected.has_t2dm_dx, "On file", "Not on file")} />
              <Field label="First-line Metformin Tried" value={yesNo(selected.first_line_tried, "Documented", "No claim history")} />
              <Field
                label="Status"
                value={
                  <span className={clsx("text-[11px] px-2 py-0.5 rounded border font-semibold", STATUS_META[selected.status].cls)}>
                    {STATUS_META[selected.status].label}
                  </span>
                }
              />
              <Field
                label="Review Referred"
                value={selected.review_referred ? "Yes · pending care management" : "No"}
              />
            </FieldGroup>
          </>
        )}
      </DetailDrawer>
    </div>
  );
}
