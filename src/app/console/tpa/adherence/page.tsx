"use client";

import { useEffect, useState } from "react";
import { demoFetch, invalidate } from "@/lib/demoFetch";
import { DataTable, PageHeader, StatRow, Column } from "@/components/ui/DataTable";
import { DetailDrawer, FieldGroup, Field } from "@/components/ui/DetailDrawer";
import { DataSourceList } from "@/components/ui/DataSourceBadge";
import { TableSkeleton } from "@/components/ui/Skeleton";
import clsx from "clsx";
import { ExternalLink, HeartPulse } from "lucide-react";

type Status = "open" | "outreach";
type FilterKey = "all" | "nonadherent" | "adherent";

interface AdherenceItem {
  patient_id: string;
  patient_initials: string;
  drug_name: string;
  brand_name: string | null;
  star_measure: string;
  fills: number;
  pdc: number;
  pdc_pct: number;
  gap_days: number;
  adherent: boolean;
  avoidable_medical_usd: number;
  last_fill: string | null;
  status: Status;
  rx_id: string;
}

const GET_URL = "/api/v1/tpa/adherence";

const money = (n: number) => `$${Math.round(n || 0).toLocaleString()}`;

function PdcBar({ pct }: { pct: number }) {
  const color = pct < 50 ? "bg-red-500" : pct < 80 ? "bg-amber-500" : "bg-emerald-500";
  return (
    <div className="w-24 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
      <div className={clsx("h-full rounded-full", color)} style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
    </div>
  );
}

export default function TPAAdherencePage() {
  const [data, setData] = useState<any>(null);
  const [selected, setSelected] = useState<AdherenceItem | null>(null);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [posting, setPosting] = useState(false);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [actionErr, setActionErr] = useState(false);

  useEffect(() => {
    demoFetch(GET_URL).then(setData).catch(() => {});
  }, []);

  if (!data) return <div className="p-6"><TableSkeleton rows={8} cols={7} /></div>;

  const items: AdherenceItem[] = data.items || [];
  const s = data.summary || {};

  const nonadherentCount = items.filter((i) => !i.adherent).length;
  const adherentCount = items.filter((i) => i.adherent).length;

  const chips: { key: FilterKey; label: string; count: number }[] = [
    { key: "all", label: "All", count: items.length },
    { key: "nonadherent", label: "Non-Adherent (<80%)", count: nonadherentCount },
    { key: "adherent", label: "Adherent", count: adherentCount },
  ];

  const filtered =
    filter === "all"
      ? items
      : filter === "nonadherent"
      ? items.filter((i) => !i.adherent)
      : items.filter((i) => i.adherent);

  const enrollOutreach = async (m: AdherenceItem) => {
    setPosting(true);
    try {
      const res = await fetch(`/api/v1/tpa/adherence/${m.rx_id}/outreach`, { method: "POST" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      invalidate(GET_URL);
      setData((d: any) =>
        d
          ? {
              ...d,
              items: (d.items || []).map((x: AdherenceItem) =>
                x.rx_id === m.rx_id ? { ...x, status: "outreach" as Status } : x
              ),
              summary: {
                ...(d.summary || {}),
                outreach_initiated: (d.summary?.outreach_initiated || 0) + 1,
              },
            }
          : d
      );
      setSelected((cur) => (cur && cur.rx_id === m.rx_id ? { ...cur, status: "outreach" as Status } : cur));
      setActionErr(false);
      setActionMsg(
        `Member ${m.patient_initials} (${m.patient_id}) enrolled in adherence outreach. Care team will initiate refill synchronization, 90-day mail conversion, and pharmacist counseling before the next fill lapses.`
      );
    } catch {
      setActionErr(true);
      setActionMsg("Outreach enrollment could not be submitted · backend unreachable. Please try again.");
    } finally {
      setPosting(false);
    }
  };

  const columns: Column<AdherenceItem>[] = [
    {
      key: "member",
      header: "Member",
      width: "80px",
      render: (r) => (
        <span className="font-mono text-[12px] font-semibold text-slate-700 dark:text-slate-200">{r.patient_initials}</span>
      ),
    },
    {
      key: "drug",
      header: "Maintenance Drug",
      render: (r) => (
        <div className="leading-tight">
          <div className="text-[13px] text-slate-800 dark:text-slate-200">{r.drug_name}</div>
          {r.brand_name && <div className="text-[11px] text-slate-400 dark:text-slate-500">{r.brand_name}</div>}
        </div>
      ),
    },
    {
      key: "star",
      header: "Star Measure",
      width: "180px",
      render: (r) => <span className="text-[12px] text-slate-600 dark:text-slate-300">{r.star_measure}</span>,
    },
    {
      key: "fills",
      header: "Fills",
      width: "60px",
      align: "right",
      render: (r) => <span className="tabular-nums text-[12px]">{r.fills}</span>,
    },
    {
      key: "pdc",
      header: "PDC",
      width: "150px",
      render: (r) => (
        <div className="flex items-center gap-2">
          <PdcBar pct={r.pdc_pct} />
          <span
            className={clsx(
              "tabular-nums text-[12px] font-semibold",
              r.pdc_pct < 50
                ? "text-red-700 dark:text-red-400"
                : r.pdc_pct < 80
                ? "text-amber-700 dark:text-amber-400"
                : "text-emerald-700 dark:text-emerald-400"
            )}
          >
            {r.pdc_pct}%
          </span>
        </div>
      ),
    },
    {
      key: "gap",
      header: "Gap",
      width: "90px",
      align: "right",
      render: (r) =>
        r.gap_days > 0 ? (
          <span className="text-[11px] px-2 py-0.5 rounded border font-semibold bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 whitespace-nowrap">
            {r.gap_days}d gap
          </span>
        ) : (
          <span className="text-[11px] text-slate-400">·</span>
        ),
    },
    {
      key: "avoidable",
      header: "Avoidable Medical",
      width: "130px",
      align: "right",
      render: (r) => (
        <span
          className={clsx(
            "tabular-nums font-semibold",
            !r.adherent ? "text-red-700 dark:text-red-400" : "text-slate-400 dark:text-slate-500"
          )}
        >
          {r.avoidable_medical_usd > 0 ? money(r.avoidable_medical_usd) : "·"}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      width: "110px",
      render: (r) =>
        r.status === "outreach" ? (
          <span className="text-[11px] px-2 py-0.5 rounded border font-semibold bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300">
            Outreach
          </span>
        ) : (
          <span className="text-[11px] px-2 py-0.5 rounded border font-semibold bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600">
            Open
          </span>
        ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Medication Adherence"
        subtitle="Proportion of Days Covered (PDC) on chronic maintenance therapy · non-adherence drives avoidable hospitalizations. CMS Star threshold 80%."
        meta={<DataSourceList sources={["Truveta", "Internal"]} />}
      />

      <div className="mb-3">
        <StatRow
          items={[
            { label: "Regimens Measured", value: s.regimens_measured ?? items.length, sub: `${s.members_measured ?? "·"} members` },
            { label: "Non-Adherent", value: s.nonadherent_count ?? nonadherentCount, sub: "PDC below 80%", severity: "alert" },
            { label: "Adherence Rate", value: `${s.adherence_rate_pct ?? 0}%`, sub: "At or above 80% PDC", severity: "ok" },
            { label: "Avg PDC", value: `${s.avg_pdc_pct ?? 0}%`, sub: "Across all regimens" },
            { label: "Avoidable Medical", value: money(s.avoidable_medical_usd), sub: "Downstream medical / yr", severity: "alert" },
          ]}
        />
      </div>

      <div className="mb-3 flex items-center gap-2 flex-wrap">
        {chips.map((c) => (
          <button
            key={c.key}
            onClick={() => setFilter(c.key)}
            title={`Show ${c.label.toLowerCase()} regimens (${c.count})`}
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
        rowKey={(r) => r.rx_id}
        onRowClick={(r) => {
          setSelected(r);
          setActionMsg(null);
          setActionErr(false);
        }}
        emptyMessage="No regimens match this filter"
      />

      <DetailDrawer
        open={!!selected}
        onClose={() => {
          setSelected(null);
          setActionMsg(null);
          setActionErr(false);
        }}
        title={selected ? `Member ${selected.patient_initials}` : ""}
        subtitle={selected ? `${selected.patient_id} · ${selected.drug_name}` : ""}
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
                onClick={() => enrollOutreach(selected)}
                disabled={posting || selected.adherent || selected.status === "outreach"}
                title={
                  selected.status === "outreach"
                    ? "This member is already enrolled in adherence outreach"
                    : selected.adherent
                    ? "This member is adherent (PDC ≥ 80%) · no outreach needed"
                    : "Enroll this non-adherent member in refill sync, 90-day conversion, and pharmacist counseling"
                }
                className={clsx(
                  "inline-flex items-center gap-1.5 px-3 py-1.5 text-[13px] rounded text-white",
                  posting || selected.adherent || selected.status === "outreach"
                    ? "bg-emerald-400 cursor-not-allowed dark:bg-emerald-800"
                    : "bg-emerald-600 hover:bg-emerald-700"
                )}
              >
                <HeartPulse className="w-3.5 h-3.5" />
                {selected.status === "outreach" ? "Enrolled ✓" : posting ? "Enrolling…" : "Enroll in Adherence Outreach"}
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

            <FieldGroup title="Member">
              <Field label="Member ID" value={selected.patient_id} mono />
              <Field label="Initials" value={selected.patient_initials} />
              <Field label="Maintenance Drug" value={selected.drug_name} />
              {selected.brand_name && <Field label="Brand" value={selected.brand_name} />}
            </FieldGroup>

            <FieldGroup title="Adherence">
              <Field label="CMS Star Measure" value={selected.star_measure} />
              <Field label="Fills" value={selected.fills.toString()} mono />
              <Field
                label="PDC"
                value={
                  <span className="inline-flex items-center gap-2">
                    <PdcBar pct={selected.pdc_pct} />
                    <span
                      className={clsx(
                        "tabular-nums font-semibold",
                        selected.pdc_pct < 50
                          ? "text-red-700 dark:text-red-400"
                          : selected.pdc_pct < 80
                          ? "text-amber-700 dark:text-amber-400"
                          : "text-emerald-700 dark:text-emerald-400"
                      )}
                    >
                      {selected.pdc_pct}%
                    </span>
                  </span>
                }
              />
              <Field label="Gap Days" value={selected.gap_days > 0 ? `${selected.gap_days}d uncovered` : "None"} mono />
              <Field label="Last Fill" value={selected.last_fill || "·"} mono />
              <Field
                label="Classification"
                value={
                  selected.adherent ? (
                    <span className="text-[11px] px-2 py-0.5 rounded border font-semibold bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300">
                      Adherent
                    </span>
                  ) : (
                    <span className="text-[11px] px-2 py-0.5 rounded border font-semibold bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-300">
                      Non-Adherent
                    </span>
                  )
                }
              />
            </FieldGroup>

            <FieldGroup title="Impact">
              <Field
                label="Avoidable Medical / yr"
                value={
                  <span className={clsx("font-semibold tabular-nums", !selected.adherent ? "text-red-700 dark:text-red-400" : "text-slate-500")}>
                    {selected.avoidable_medical_usd > 0 ? money(selected.avoidable_medical_usd) : "$0"}
                  </span>
                }
              />
              <Field label="Outreach Status" value={selected.status === "outreach" ? "Enrolled · care team engaged" : "Open"} />
            </FieldGroup>

            <div className="mb-2 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 px-4 py-3 text-[12px] text-slate-600 dark:text-slate-300 leading-relaxed">
              <div className="font-semibold text-slate-700 dark:text-slate-200 mb-1">Impact basis</div>
              Each non-adherent member on chronic maintenance therapy carries roughly{" "}
              <span className="font-semibold text-slate-800 dark:text-slate-100">$3,900/yr</span> in avoidable downstream medical
              cost (hospitalizations, ED visits · NEHI/IQVIA range), scaled by the coverage gap (1 − PDC).
            </div>

            <div className="rounded-md border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 px-4 py-3 text-[12px] text-blue-900 dark:text-blue-200 leading-relaxed">
              <div className="font-semibold mb-1.5">Adherence interventions</div>
              <ul className="list-disc pl-4 space-y-1">
                <li>Refill synchronization · align all maintenance fills to a single monthly pickup date</li>
                <li>90-day mail conversion · reduce refill touchpoints from 12 to 4 per year</li>
                <li>Pharmacist counseling · targeted medication therapy management (MTM) outreach call</li>
                <li>Barrier assessment · screen for cost burden and side-effect intolerance driving the gap</li>
              </ul>
            </div>
          </>
        )}
      </DetailDrawer>
    </div>
  );
}
