"use client";

import { useEffect, useState } from "react";
import { DataTable, PageHeader, Column } from "@/components/ui/DataTable";
import { DetailDrawer, FieldGroup, Field } from "@/components/ui/DetailDrawer";
import { DataSourceList } from "@/components/ui/DataSourceBadge";
import clsx from "clsx";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { demoFetch } from "@/lib/demoFetch";
import { PbaFormularyOrbit } from "@/components/dashboard/PbaCharts";

const TIER_COLOR: Record<number, string> = {
  1: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:text-emerald-300 dark:bg-emerald-900/20",
  2: "bg-blue-50 text-blue-700 border-blue-200 dark:text-blue-300 dark:bg-blue-900/20",
  3: "bg-indigo-50 text-indigo-700 border-indigo-200 dark:text-indigo-300",
  4: "bg-amber-50 text-amber-700 border-amber-200 dark:text-amber-300 dark:bg-amber-900/20",
  5: "bg-red-50 text-red-700 border-red-200 dark:text-red-300 dark:bg-red-900/20",
};

export default function PBAFormularyMgmtPage() {
  const [data, setData] = useState<any>(null);
  const [tier, setTier] = useState<number | null>(null);
  const [selected, setSelected] = useState<any>(null);
  useEffect(() => { demoFetch("/api/v1/pba/formulary-mgmt").then(setData).catch(() => {}); }, []);
  if (!data) return <div className="p-6"><TableSkeleton rows={10} cols={8} /></div>;

  const filtered = tier ? data.items.filter((d: any) => d.tier === tier) : data.items;

  const columns: Column<any>[] = [
    { key: "drug", header: "Drug",
      render: (d) => (
        <div>
          <div className="font-semibold text-[13px]">{d.drug_name}</div>
          {d.brand_name && <div className="text-[11px] text-slate-500">({d.brand_name})</div>}
        </div>
      )},
    { key: "class", header: "Class", width: "180px",
      render: (d) => <span className="text-[12px] text-slate-700 dark:text-slate-300">{d.drug_class}</span> },
    { key: "tier", header: "Tier", width: "150px",
      render: (d) => <span className={clsx("text-[11px] px-2 py-0.5 rounded font-bold border", TIER_COLOR[d.tier])}>T{d.tier} {d.tier_name}</span> },
    { key: "copay", header: "Copay", width: "90px",
      render: (d) => <span className="text-[12px]">{d.copay_range}</span> },
    { key: "pa", header: "PA", width: "50px", align: "center",
      render: (d) => d.pa_required ? <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-300">Yes</span> : <span className="text-slate-300">·</span> },
    { key: "step", header: "Step", width: "50px", align: "center",
      render: (d) => d.step_therapy_required ? <span className="text-[11px] font-semibold text-blue-700 dark:text-blue-300">Yes</span> : <span className="text-slate-300">·</span> },
    { key: "qty", header: "Qty Limit", width: "80px",
      render: (d) => <span className="text-[11px] text-slate-600 dark:text-slate-400">{d.quantity_limit_30d ? `${d.quantity_limit_30d}/30d` : "·"}</span> },
    { key: "rems", header: "REMS", width: "120px",
      render: (d) => d.rems_program ? <span className="text-[11px] px-1.5 py-0.5 bg-red-50 text-red-700 rounded font-mono dark:text-red-300 dark:bg-red-900/20">{d.rems_program}</span> : <span className="text-slate-300">·</span> },
  ];

  return (
    <div>
      <PageHeader
        title="Formulary"
        subtitle="Plan formulary tier assignments · prior authorization · step therapy · quantity limits"
        meta={<DataSourceList sources={["NADAC", "RxNorm", "DailyMed"]} />}
      />
      <div className="mb-5"><PbaFormularyOrbit data={data} /></div>

      <div className="mb-3 flex items-center gap-2">
        <span className="text-[12px] text-slate-500">Filter tier:</span>
        {[1, 2, 3, 4, 5].map(t => (
          <button key={t} onClick={() => setTier(tier === t ? null : t)}
            className={clsx("text-[11px] px-2 py-0.5 rounded border font-semibold",
              tier === t ? TIER_COLOR[t] : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50 dark:text-slate-300 dark:bg-slate-800")}>
            T{t}
          </button>
        ))}
        {tier && <button onClick={() => setTier(null)} className="text-[11px] text-blue-600 hover:underline ml-2 dark:text-blue-400">Clear</button>}
        <span className="text-[12px] text-slate-500 ml-auto">{filtered.length} drugs shown</span>
      </div>
      <DataTable columns={columns} rows={filtered} rowKey={(d) => d.drug_id} onRowClick={(d) => setSelected(d)} />

      <DetailDrawer open={!!selected} onClose={() => setSelected(null)}
        title={selected?.drug_name || ""} subtitle={selected?.brand_name ? `(${selected.brand_name}) · ${selected.drug_class}` : selected?.drug_class}
      >
        {selected && (
          <>
            <FieldGroup title="Drug Identity">
              <Field label="Drug ID (NDC)" value={selected.drug_id} mono />
              <Field label="Generic Name" value={selected.drug_name} />
              <Field label="Brand Name" value={selected.brand_name} />
              <Field label="Class" value={selected.drug_class} />
              <Field label="Specialty" value={selected.is_specialty ? "Yes" : "No"} />
              {selected.rems_program && <Field label="REMS Program" value={selected.rems_program} mono />}
              <Field label="Biosimilar Available" value={selected.biosimilar_available ? "Yes" : "No"} />
            </FieldGroup>
            <FieldGroup title="Plan Coverage">
              <Field label="Tier" value={`${selected.tier} · ${selected.tier_name}`} />
              <Field label="Copay" value={selected.copay_range} />
              <Field label="Prior Authorization" value={selected.pa_required ? "Required" : "Not required"} />
              <Field label="Step Therapy" value={selected.step_therapy_required ? "Required" : "Not required"} />
              <Field label="Quantity Limit (30d)" value={selected.quantity_limit_30d || "None"} />
            </FieldGroup>
          </>
        )}
      </DetailDrawer>
    </div>
  );
}
