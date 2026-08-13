"use client";

import { useEffect, useState } from "react";
import { demoFetch, invalidate } from "@/lib/demoFetch";
import { DataTable, PageHeader, StatRow, Column } from "@/components/ui/DataTable";
import { DetailDrawer, FieldGroup, Field } from "@/components/ui/DetailDrawer";
import { DataSourceList } from "@/components/ui/DataSourceBadge";
import { TableSkeleton } from "@/components/ui/Skeleton";
import clsx from "clsx";
import { PbaMailOrderFunnel } from "@/components/dashboard/PbaCharts";
import { Truck } from "lucide-react";

interface MailOrderItem {
  rx_id: string;
  patient_id: string;
  patient_initials: string;
  drug_name: string;
  brand_name: string | null;
  therapeutic_category: string | null;
  current_days_supply: number;
  annual_fee_savings_usd: number;
  annual_ingredient_savings_usd: number;
  annual_savings_usd: number;
  status: "eligible" | "converted";
}

const fmtUsd = (n: number) => `$${Math.round(n).toLocaleString()}`;

export default function PBAMailOrderPage() {
  const [data, setData] = useState<any>(null);
  const [selected, setSelected] = useState<MailOrderItem | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [actionErr, setActionErr] = useState<boolean>(false);
  const [converting, setConverting] = useState(false);

  useEffect(() => {
    demoFetch("/api/v1/pba/mail-order").then(setData).catch(() => {});
  }, []);

  if (!data) return <div className="p-6"><TableSkeleton rows={8} cols={7} /></div>;

  const convert = async () => {
    if (!selected || converting || selected.status === "converted") return;
    setConverting(true);
    try {
      const res = await fetch(`/api/v1/pba/mail-order/${selected.rx_id}/convert`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      invalidate("/api/v1/pba/mail-order");
      setData((d: any) => d ? {
        ...d,
        summary: {
          ...d.summary,
          converted: d.summary.converted + 1,
          realized_savings_usd: Math.round((d.summary.realized_savings_usd + selected.annual_savings_usd) * 100) / 100,
        },
        items: d.items.map((i: MailOrderItem) => i.rx_id === selected.rx_id ? { ...i, status: "converted" } : i),
      } : d);
      setSelected((s) => s ? { ...s, status: "converted" } : s);
      setActionErr(false);
      setActionMsg(
        `Converted to 90-day mail order · member opted in and auto-refill is enrolled. ` +
        `${fmtUsd(selected.annual_savings_usd)}/yr projected savings (${fmtUsd(selected.annual_fee_savings_usd)} dispensing-fee delta + ${fmtUsd(selected.annual_ingredient_savings_usd)} mail ingredient discount) posted to plan-sponsor ROI. ` +
        `12 retail fills collapse to 4 mail fills; first 90-day supply ships in 3-5 business days.`
      );
    } catch {
      setActionErr(true);
      setActionMsg("Could not reach the backend · conversion not recorded. Please retry.");
    } finally {
      setConverting(false);
    }
  };

  const shown: MailOrderItem[] = statusFilter === "all"
    ? data.items
    : data.items.filter((i: MailOrderItem) => i.status === statusFilter);

  const columns: Column<MailOrderItem>[] = [
    { key: "member", header: "Member", width: "80px",
      render: (r) => <span className="font-mono text-[12px] text-slate-700 dark:text-slate-300">{r.patient_initials}</span> },
    { key: "drug", header: "Drug",
      render: (r) => (
        <div>
          <div className="text-[13px] font-semibold text-slate-900 dark:text-white">{r.drug_name}</div>
          {r.brand_name && <div className="text-[11px] text-slate-500 dark:text-slate-400">{r.brand_name}</div>}
        </div>
      )},
    { key: "category", header: "Therapeutic Category", width: "170px",
      render: (r) => <span className="text-[12px] text-slate-600 dark:text-slate-300">{r.therapeutic_category || "·"}</span> },
    { key: "days", header: "Days Supply", width: "100px",
      render: (r) => (
        <span className="text-[11px] px-2 py-0.5 rounded border font-semibold tabular-nums bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600">
          {r.current_days_supply}d
        </span>
      )},
    { key: "fee", header: "Fee Savings", width: "110px", align: "right",
      render: (r) => <span className="tabular-nums text-[12px] text-slate-700 dark:text-slate-300">{fmtUsd(r.annual_fee_savings_usd)}</span> },
    { key: "ingredient", header: "Ingredient Savings", width: "130px", align: "right",
      render: (r) => <span className="tabular-nums text-[12px] text-slate-700 dark:text-slate-300">{fmtUsd(r.annual_ingredient_savings_usd)}</span> },
    { key: "total", header: "Total Annual Savings", width: "150px", align: "right",
      render: (r) => <span className="font-bold tabular-nums text-emerald-700 dark:text-emerald-400">{fmtUsd(r.annual_savings_usd)}</span> },
    { key: "status", header: "Status", width: "100px",
      render: (r) => r.status === "converted"
        ? <span className="text-[11px] px-2 py-0.5 rounded border font-semibold bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-700">Converted</span>
        : <span className="text-[11px] px-2 py-0.5 rounded border font-semibold bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600">Eligible</span> },
  ];

  const eligibleCount = data.items.filter((i: MailOrderItem) => i.status === "eligible").length;
  const convertedCount = data.items.filter((i: MailOrderItem) => i.status === "converted").length;
  const chips = [
    { key: "all", label: `All (${data.items.length})` },
    { key: "eligible", label: `Eligible (${eligibleCount})` },
    { key: "converted", label: `Converted (${convertedCount})` },
  ];

  return (
    <div>
      <PageHeader
        title="90-Day Mail Conversion"
        subtitle="Chronic maintenance drugs on 30-day retail fills waste dispensing fees and lower adherence · convert to 90-day mail order."
        meta={<DataSourceList sources={["Kythera", "NADAC", "Internal"]} />}
      />

      <div className="mb-3">
        <StatRow items={[
          { label: "Eligible Fills", value: data.summary.eligible_fills, sub: "Chronic maintenance on ≤34-day retail fills" },
          { label: "Members Affected", value: data.summary.members_affected, sub: "Distinct members with a convertible fill" },
          { label: "Annual Savings", value: fmtUsd(data.summary.annual_savings_usd), sub: "If all eligible fills convert", severity: "ok" },
          { label: "Converted", value: data.summary.converted, sub: `${fmtUsd(data.summary.realized_savings_usd)} realized savings` },
          { label: "Retail Dispense Fee", value: fmtUsd(data.summary.retail_dispense_fee_usd), sub: "NCPDP national avg per fill" },
        ]} />
      </div>

      <div className="mb-5"><PbaMailOrderFunnel summary={data.summary} items={data.items} /></div>

      <div className="mb-3 flex items-center gap-2 flex-wrap">
        {chips.map((c) => (
          <button
            key={c.key}
            onClick={() => setStatusFilter(c.key)}
            title={`Show ${c.key === "all" ? "all fills" : c.key + " fills"}`}
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
        onRowClick={(r) => { setSelected(r); setActionMsg(null); setActionErr(false); }}
        emptyMessage="No mail-conversion candidates in this view. Chronic maintenance drugs on ≤34-day retail fills appear here."
      />

      <DetailDrawer
        open={!!selected}
        onClose={() => { setSelected(null); setActionMsg(null); setActionErr(false); }}
        title={selected ? `${selected.drug_name}${selected.brand_name ? ` (${selected.brand_name})` : ""}` : ""}
        subtitle={selected ? `${selected.therapeutic_category || "Maintenance"} · Rx ${selected.rx_id} · Member ${selected.patient_initials}` : undefined}
        actions={selected && (
          <>
            <a
              href={`/prescriptions/${selected.rx_id}`}
              title="Open the underlying claim with all flags and adjudication detail"
              className="px-3 py-1.5 text-[13px] rounded border border-slate-300 hover:bg-slate-50 text-slate-700 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Open Full Claim
            </a>
            <button
              onClick={convert}
              disabled={converting || selected.status === "converted"}
              title="Convert this retail fill to a 90-day mail-order supply with auto-refill enrolled"
              className="px-3 py-1.5 text-[13px] rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center gap-1.5"
            >
              <Truck className="w-4 h-4" />
              {selected.status === "converted" ? "Converted ✓" : converting ? "Converting…" : "Convert to 90-Day Mail"}
            </button>
          </>
        )}
      >
        {selected && (
          <>
            {actionMsg && (
              <div className={clsx(
                "mb-5 rounded-md px-4 py-3 text-[13px] border",
                actionErr
                  ? "bg-red-50 border-red-300 text-red-900 dark:bg-red-900/20 dark:border-red-700 dark:text-red-200"
                  : "bg-emerald-50 border-emerald-300 text-emerald-900 dark:bg-emerald-900/20 dark:border-emerald-700 dark:text-emerald-200"
              )}>
                {actionMsg}
              </div>
            )}

            <FieldGroup title="Medication">
              <Field label="Drug" value={selected.drug_name} />
              {selected.brand_name && <Field label="Brand" value={selected.brand_name} />}
              <Field label="Therapeutic Category" value={selected.therapeutic_category} />
              <Field label="Rx ID" value={selected.rx_id} mono />
              <Field label="Current Days Supply" value={`${selected.current_days_supply} days`} />
            </FieldGroup>

            <FieldGroup title="Savings Breakdown">
              <Field label="Annual Fee Savings" value={fmtUsd(selected.annual_fee_savings_usd)} />
              <Field label="Annual Ingredient Savings" value={fmtUsd(selected.annual_ingredient_savings_usd)} />
              <Field
                label="Total Annual Savings"
                value={<span className="font-bold text-emerald-700 dark:text-emerald-400">{fmtUsd(selected.annual_savings_usd)}</span>}
              />
            </FieldGroup>

            <FieldGroup title="90-Day Mail Benefits">
              <ul className="text-[13px] text-slate-700 dark:text-slate-300 list-disc list-inside space-y-1">
                <li>One dispensing fee per 90 days instead of 12 retail fees a year</li>
                <li>~2% lower unit cost on the mail channel</li>
                <li>Fewer pharmacy trips improve medication adherence</li>
                <li>Auto-refill reduces gaps in therapy and refill lapses</li>
              </ul>
            </FieldGroup>
          </>
        )}
      </DetailDrawer>
    </div>
  );
}
