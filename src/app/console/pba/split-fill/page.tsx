"use client";

import { useEffect, useState } from "react";
import { demoFetch, invalidate } from "@/lib/demoFetch";
import { DataTable, PageHeader, Column } from "@/components/ui/DataTable";
import { DetailDrawer, FieldGroup, Field } from "@/components/ui/DetailDrawer";
import { DataSourceList } from "@/components/ui/DataSourceBadge";
import { TableSkeleton } from "@/components/ui/Skeleton";
import clsx from "clsx";
import { PbaSplitFillShield } from "@/components/dashboard/PbaCharts";

interface SplitFillItem {
  rx_id: string;
  patient_initials: string;
  drug_name: string;
  brand_name: string | null;
  category: string;
  days_supply: number;
  fill_cost_usd: number;
  waste_at_risk_usd: number;
  expected_waste_avoided_usd: number;
  status: "eligible" | "enrolled";
  date_written: string;
}

const fmtUsd = (n: number) => `$${Math.round(n).toLocaleString()}`;

export default function PBASplitFillPage() {
  const [data, setData] = useState<any>(null);
  const [selected, setSelected] = useState<SplitFillItem | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [enrolling, setEnrolling] = useState(false);

  useEffect(() => {
    demoFetch("/api/v1/pba/split-fill").then(setData).catch(() => {});
  }, []);

  if (!data) return <div className="p-6"><TableSkeleton rows={10} cols={8} /></div>;

  const enroll = async () => {
    if (!selected || enrolling || selected.status === "enrolled") return;
    setEnrolling(true);
    try {
      await fetch(`/api/v1/pba/split-fill/${selected.rx_id}/enroll`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      invalidate("/api/v1/pba/split-fill");
      setData((d: any) => d ? {
        ...d,
        summary: {
          ...d.summary,
          enrolled: d.summary.enrolled + 1,
          realized_waste_avoided_usd: Math.round((d.summary.realized_waste_avoided_usd + selected.expected_waste_avoided_usd) * 100) / 100,
        },
        items: d.items.map((i: any) => i.rx_id === selected.rx_id ? { ...i, status: "enrolled" } : i),
      } : d);
      setSelected((s) => s ? { ...s, status: "enrolled" } : s);
      setActionMsg(
        `Enrolled in Split-Fill · first dispense limited to 15 days. ` +
        `${fmtUsd(selected.expected_waste_avoided_usd)} expected waste avoided posted to plan sponsor ROI. ` +
        `Pharmacist tolerance call scheduled for day 10-12.`
      );
    } catch {
      setActionMsg("Could not reach the backend · enrollment not recorded.");
    } finally {
      setEnrolling(false);
    }
  };

  const shown: SplitFillItem[] = statusFilter === "all"
    ? data.items
    : data.items.filter((i: SplitFillItem) => i.status === statusFilter);

  const columns: Column<SplitFillItem>[] = [
    { key: "rx", header: "Rx", width: "90px",
      render: (r) => <span className="font-mono text-[12px] text-slate-700 dark:text-slate-300">{r.rx_id}</span> },
    { key: "drug", header: "Drug",
      render: (r) => (
        <div>
          <div className="text-[13px] font-semibold text-slate-900 dark:text-white">{r.drug_name}</div>
          {r.brand_name && <div className="text-[11px] text-slate-500">{r.brand_name}</div>}
        </div>
      )},
    { key: "category", header: "Category", width: "140px",
      render: (r) => <span className="text-[12px] text-slate-600 dark:text-slate-300">{r.category}</span> },
    { key: "member", header: "Member", width: "80px",
      render: (r) => <span className="font-mono text-[12px]">{r.patient_initials}</span> },
    { key: "days", header: "Days Supply", width: "100px", align: "right",
      render: (r) => <span className="tabular-nums text-[12px]">{r.days_supply}</span> },
    { key: "cost", header: "Fill Cost", width: "100px", align: "right",
      render: (r) => <span className="tabular-nums text-[12px]">{fmtUsd(r.fill_cost_usd)}</span> },
    { key: "waste", header: "Waste at Risk", width: "110px", align: "right",
      render: (r) => <span className="tabular-nums text-[12px] text-amber-700 dark:text-amber-400">{fmtUsd(r.waste_at_risk_usd)}</span> },
    { key: "avoided", header: "Expected Avoided", width: "130px", align: "right",
      render: (r) => <span className="font-bold tabular-nums text-emerald-700 dark:text-emerald-400">{fmtUsd(r.expected_waste_avoided_usd)}</span> },
    { key: "status", header: "Status", width: "100px",
      render: (r) => r.status === "enrolled"
        ? <span className="text-[11px] px-2 py-0.5 rounded border font-semibold bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-700">Enrolled</span>
        : <span className="text-[11px] px-2 py-0.5 rounded border font-semibold bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600">Eligible</span> },
  ];

  const eligibleCount = data.items.filter((i: SplitFillItem) => i.status === "eligible").length;
  const enrolledCount = data.items.filter((i: SplitFillItem) => i.status === "enrolled").length;
  const chips = [
    { key: "all", label: `All (${data.items.length})` },
    { key: "eligible", label: `Eligible (${eligibleCount})` },
    { key: "enrolled", label: `Enrolled (${enrolledCount})` },
  ];

  return (
    <div>
      <PageHeader
        title="Split-Fill Program"
        subtitle="15-day first fills on specialty & oral-oncology new starts · 34% discontinue early; stop paying for the unused half (JCO Oncology Practice)."
        meta={<DataSourceList sources={["Truveta", "NADAC", "Internal"]} />}
      />

      <div className="mb-5"><PbaSplitFillShield summary={data.summary} /></div>

      <div className="mb-3 flex items-center gap-2 flex-wrap">
        {chips.map((c) => (
          <button
            key={c.key}
            onClick={() => setStatusFilter(c.key)}
            title={`Show ${c.key === "all" ? "all prescriptions" : c.key + " prescriptions"}`}
            className={clsx(
              "text-[12px] px-2.5 py-1 rounded-full border font-medium transition-colors",
              statusFilter === c.key
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-600 hover:border-blue-400"
            )}
          >
            {c.label}
          </button>
        ))}
      </div>

      <DataTable
        columns={columns}
        rows={shown}
        rowKey={(r) => r.rx_id}
        onRowClick={(r) => setSelected(r)}
        emptyMessage="No split-fill candidates in this view. Specialty and oral-oncology new starts appear here on their first fill."
      />

      <DetailDrawer
        open={!!selected}
        onClose={() => { setSelected(null); setActionMsg(null); }}
        title={selected ? `${selected.drug_name}${selected.brand_name ? ` (${selected.brand_name})` : ""}` : ""}
        subtitle={selected ? `${selected.category} · Rx ${selected.rx_id} · Member ${selected.patient_initials}` : undefined}
        actions={selected && (
          <>
            <a
              href={`/console/prescriptions/${selected.rx_id}`}
              title="Open the underlying claim with all flags and adjudication detail"
              className="px-3 py-1.5 text-[13px] rounded border border-slate-300 hover:bg-slate-50 text-slate-700 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Open Full Claim
            </a>
            <button
              onClick={enroll}
              disabled={enrolling || selected.status === "enrolled"}
              title="Enroll this new start · first dispense limited to 15 days, balance dispensed only if therapy continues"
              className="px-3 py-1.5 text-[13px] rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {selected.status === "enrolled" ? "Enrolled ✓" : enrolling ? "Enrolling…" : "Enroll in Split-Fill"}
            </button>
          </>
        )}
      >
        {selected && (
          <>
            {actionMsg && (
              <div className="mb-5 bg-emerald-50 border border-emerald-300 rounded-md px-4 py-3 text-[13px] text-emerald-900 dark:bg-emerald-900/20 dark:text-emerald-200">
                {actionMsg}
              </div>
            )}
            <FieldGroup title="Prescription">
              <Field label="Rx ID" value={selected.rx_id} mono />
              <Field label="Drug" value={selected.drug_name} />
              {selected.brand_name && <Field label="Brand" value={selected.brand_name} />}
              <Field label="Category" value={selected.category} />
              <Field label="Days Supply" value={selected.days_supply} />
              <Field label="Written" value={new Date(selected.date_written).toLocaleDateString()} />
            </FieldGroup>

            <FieldGroup title="Economics">
              <Field label="Fill Cost" value={fmtUsd(selected.fill_cost_usd)} />
              <Field label="Waste at Risk" value={fmtUsd(selected.waste_at_risk_usd)} />
              <Field label="Expected Avoided" value={`${fmtUsd(selected.expected_waste_avoided_usd)} (34% early-discontinuation rate applied)`} />
            </FieldGroup>

            <FieldGroup title="Program Mechanics">
              <ul className="text-[13px] text-slate-700 dark:text-slate-300 list-disc list-inside space-y-1">
                <li>Dispense a 15-day supply on the first fill</li>
                <li>Pharmacist tolerance call at day 10-12</li>
                <li>Balance dispenses only if therapy continues</li>
                <li>Member pays one copay for the full month</li>
              </ul>
            </FieldGroup>
          </>
        )}
      </DetailDrawer>
    </div>
  );
}
