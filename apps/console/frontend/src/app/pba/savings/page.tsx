"use client";

import { useEffect, useState } from "react";
import { demoFetch, invalidate } from "@/lib/demoFetch";
import { DataTable, PageHeader, StatRow, Column } from "@/components/ui/DataTable";
import { DetailDrawer, FieldGroup, Field } from "@/components/ui/DetailDrawer";
import { DataSourceList } from "@/components/ui/DataSourceBadge";
import { TableSkeleton } from "@/components/ui/Skeleton";
import clsx from "clsx";
import { PbaSavingsPortfolio } from "@/components/dashboard/PbaCharts";

interface SavingsItem {
  rx_id: string;
  patient_initials: string;
  drug_name: string;
  brand_name: string | null;
  opportunity_type: string;
  alternative_name: string;
  basis: string;
  fill_cost_usd: number;
  alt_cost_usd: number;
  savings_per_fill_usd: number;
  annualized_savings_usd: number;
  fills_per_year: number;
  status: string;
  converted_at: string | null;
}

const TYPE_LABEL: Record<string, string> = {
  therapeutic_interchange: "Therapeutic Interchange",
  generic_substitution: "Generic Substitution",
  biosimilar: "Biosimilar",
};

const TYPE_BADGE: Record<string, string> = {
  therapeutic_interchange: "bg-blue-50 text-blue-700 border-blue-200 dark:text-blue-300 dark:bg-blue-900/20",
  generic_substitution: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:text-emerald-300 dark:bg-emerald-900/20",
  biosimilar: "bg-purple-50 text-purple-700 border-purple-200 dark:text-purple-300 dark:bg-purple-900/20",
};

const fmtUsd = (n: number) => `$${Math.round(n).toLocaleString()}`;

export default function PBASavingsPage() {
  const [data, setData] = useState<any>(null);
  const [selected, setSelected] = useState<SavingsItem | null>(null);
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [converting, setConverting] = useState(false);

  useEffect(() => {
    demoFetch("/api/v1/pba/savings-opportunities").then(setData).catch(() => {});
  }, []);

  if (!data) return <div className="p-6"><TableSkeleton rows={10} cols={7} /></div>;

  const convert = async () => {
    if (!selected || converting || selected.status === "converted") return;
    setConverting(true);
    try {
      await fetch(`/api/v1/pba/savings/${selected.rx_id}/convert`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          annualized_savings_usd: selected.annualized_savings_usd,
          note: `Prescriber accepted ${TYPE_LABEL[selected.opportunity_type] || "interchange"}`,
        }),
      });
      invalidate("/api/v1/pba/savings-opportunities");
      setData((d: any) => d ? {
        ...d,
        converted_count: d.converted_count + 1,
        realized_annualized_usd: Math.round((d.realized_annualized_usd + selected.annualized_savings_usd) * 100) / 100,
        items: d.items.map((i: any) => i.rx_id === selected.rx_id ? { ...i, status: "converted" } : i),
      } : d);
      setSelected((s) => s ? { ...s, status: "converted" } : s);
      setActionMsg(
        `Interchange recorded · ${fmtUsd(selected.annualized_savings_usd)}/yr moved to realized savings. ` +
        `Prescriber confirmation letter queued via secure portal.`
      );
    } catch {
      setActionMsg("Could not reach the backend · conversion not recorded.");
    } finally {
      setConverting(false);
    }
  };

  const shown: SavingsItem[] = typeFilter === "all"
    ? data.items
    : data.items.filter((i: SavingsItem) => i.opportunity_type === typeFilter);

  const columns: Column<SavingsItem>[] = [
    { key: "type", header: "Type", width: "170px",
      render: (r) => <span className={clsx("text-[11px] px-2 py-0.5 rounded border font-semibold", TYPE_BADGE[r.opportunity_type] || "bg-slate-50 text-slate-700 border-slate-200 dark:text-slate-300")}>{TYPE_LABEL[r.opportunity_type] || r.opportunity_type}</span> },
    { key: "drug", header: "Current → Alternative",
      render: (r) => (
        <div>
          <div className="text-[13px] font-semibold text-slate-900 dark:text-white">
            {r.drug_name}{r.brand_name ? ` (${r.brand_name})` : ""}
          </div>
          <div className="text-[11px] text-slate-500">→ {r.alternative_name}</div>
        </div>
      )},
    { key: "member", header: "Member", width: "80px",
      render: (r) => <span className="font-mono text-[12px]">{r.patient_initials}</span> },
    { key: "fill", header: "Fill Cost", width: "100px", align: "right",
      render: (r) => <span className="tabular-nums text-[12px]">{fmtUsd(r.fill_cost_usd)}</span> },
    { key: "perfill", header: "Savings / Fill", width: "110px", align: "right",
      render: (r) => <span className="tabular-nums text-[12px] text-emerald-700 dark:text-emerald-400">{fmtUsd(r.savings_per_fill_usd)}</span> },
    { key: "annual", header: "Annualized", width: "110px", align: "right",
      render: (r) => <span className="font-bold tabular-nums text-emerald-700 dark:text-emerald-400">{fmtUsd(r.annualized_savings_usd)}</span> },
    { key: "status", header: "Status", width: "100px",
      render: (r) => r.status === "converted"
        ? <span className="text-[11px] px-2 py-0.5 rounded border font-semibold bg-emerald-50 text-emerald-700 border-emerald-200 dark:text-emerald-300 dark:bg-emerald-900/20">Converted</span>
        : <span className="text-[11px] px-2 py-0.5 rounded border font-semibold bg-slate-50 text-slate-600 border-slate-200 dark:text-slate-400">Open</span> },
  ];

  const chips = [
    { key: "all", label: `All (${data.items.length})` },
    ...data.by_type.map((t: any) => ({
      key: t.type,
      label: `${TYPE_LABEL[t.type] || t.type} (${t.count})`,
    })),
  ];

  return (
    <div>
      <PageHeader
        title="Savings Opportunities"
        subtitle="Cost-avoidance worklist · therapeutic interchange, generic substitution, and biosimilar conversion, ranked by annualized savings."
        meta={<DataSourceList sources={["Kythera", "Truveta", "NADAC"]} />}
      />

      <div className="mb-3">
        <StatRow items={[
          { label: "Identified / yr", value: fmtUsd(data.identified_annualized_usd), sub: "Annualized, all open + converted", severity: "ok" },
          { label: "Realized / yr", value: fmtUsd(data.realized_annualized_usd), sub: "Converted by prescriber agreement", severity: "ok" },
          { label: "Opportunities", value: data.opportunity_count, sub: "≥ $25 savings per fill" },
          { label: "Converted", value: data.converted_count, sub: "Persisted to audit trail" },
        ]} />
      </div>

      <div className="mb-5"><PbaSavingsPortfolio data={data} /></div>

      <div className="mb-3 flex items-center gap-2 flex-wrap">
        {chips.map((c) => (
          <button
            key={c.key}
            onClick={() => setTypeFilter(c.key)}
            className={clsx(
              "text-[12px] px-2.5 py-1 rounded-full border font-medium transition-colors",
              typeFilter === c.key
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
        emptyMessage="No savings opportunities in this category. Interchange, generic, and biosimilar candidates with ≥ $25 savings per fill appear here."
      />

      <DetailDrawer
        open={!!selected}
        onClose={() => { setSelected(null); setActionMsg(null); }}
        title={selected ? `${selected.drug_name} → ${selected.alternative_name}` : ""}
        subtitle={selected ? `${TYPE_LABEL[selected.opportunity_type] || selected.opportunity_type} · Rx ${selected.rx_id}` : undefined}
        actions={selected && (
          <>
            <a
              href={`/prescriptions/${selected.rx_id}`}
              title="Open the underlying claim with all flags and adjudication detail"
              className="px-3 py-1.5 text-[13px] rounded border border-slate-300 hover:bg-slate-50 text-slate-700 dark:text-slate-300"
            >
              Open Full Claim
            </a>
            <button
              onClick={convert}
              disabled={converting || selected.status === "converted"}
              title="Record prescriber agreement to switch · moves this opportunity to realized savings"
              className="px-3 py-1.5 text-[13px] rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {selected.status === "converted" ? "Converted ✓" : converting ? "Recording…" : "Convert Opportunity"}
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
            <FieldGroup title="Opportunity">
              <Field label="Type" value={TYPE_LABEL[selected.opportunity_type] || selected.opportunity_type} />
              <Field label="Evidence Basis" value={selected.basis} />
              <Field label="Status" value={selected.status === "converted" ? "Converted" : "Open"} />
              {selected.converted_at && <Field label="Converted" value={new Date(selected.converted_at).toLocaleString()} />}
            </FieldGroup>

            <FieldGroup title="Current Therapy">
              <Field label="Drug" value={selected.drug_name} />
              {selected.brand_name && <Field label="Brand" value={selected.brand_name} />}
              <Field label="Member" value={selected.patient_initials} />
              <Field label="Cost per Fill" value={fmtUsd(selected.fill_cost_usd)} />
              <Field label="Fills per Year" value={selected.fills_per_year} />
            </FieldGroup>

            <FieldGroup title="Proposed Alternative">
              <Field label="Alternative" value={selected.alternative_name} />
              <Field label="Cost per Fill" value={fmtUsd(selected.alt_cost_usd)} />
              <Field label="Savings per Fill" value={fmtUsd(selected.savings_per_fill_usd)} />
              <Field label="Annualized Savings" value={fmtUsd(selected.annualized_savings_usd)} />
            </FieldGroup>

            <FieldGroup title="Conversion Workflow">
              <ul className="text-[13px] text-slate-700 dark:text-slate-300 list-disc list-inside space-y-1">
                <li>Secure portal proposal to prescriber with equivalence evidence</li>
                <li>Member copay comparison included (tier change disclosure)</li>
                <li>On agreement: Convert here · savings post to plan sponsor ROI</li>
                <li>No therapy interruption: current fill honored, switch at next fill</li>
              </ul>
            </FieldGroup>
          </>
        )}
      </DetailDrawer>
    </div>
  );
}
