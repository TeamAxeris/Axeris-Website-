"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { DataTable, PageHeader, Column } from "@/components/ui/DataTable";
import { DetailDrawer, FieldGroup, Field } from "@/components/ui/DetailDrawer";
import { DataSourceList } from "@/components/ui/DataSourceBadge";
import clsx from "clsx";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { demoFetch } from "@/lib/demoFetch";
import { PbaRejectPareto } from "@/components/dashboard/PbaCharts";

export default function PBANCPDPRejectsPage() {
  const [data, setData] = useState<any>(null);
  const [filter, setFilter] = useState("");
  const [selected, setSelected] = useState<any>(null);
  const [detail, setDetail] = useState<any>(null);

  useEffect(() => {
    const url = filter ? `/api/v1/pba/ncpdp-rejects?reject_code=${filter}` : "/api/v1/pba/ncpdp-rejects";
    demoFetch(url).then(setData).catch(() => {});
  }, [filter]);

  useEffect(() => {
    if (selected) demoFetch(`/api/v1/pba/transactions/${selected.rx_id}`).then(setDetail).catch(() => {});
    else setDetail(null);
  }, [selected]);

  if (!data) return <div className="p-6"><TableSkeleton rows={8} cols={6} /></div>;

  const columns: Column<any>[] = [
    { key: "rx", header: "Rx ID", width: "100px",
      render: (r) => <span className="font-mono text-[12px] text-blue-600 dark:text-blue-400">{r.rx_id}</span> },
    { key: "code", header: "Reject", width: "200px",
      render: (r) => (
        <div>
          <code className="bg-red-50 text-red-800 text-[11px] px-1.5 py-0.5 rounded font-mono font-bold dark:bg-red-900/20 dark:text-red-300">{r.ncpdp_reject_code}</code>
          <div className="text-[11px] text-slate-500 mt-0.5">{r.reject_description}</div>
        </div>
      )},
    { key: "drug", header: "Drug",
      render: (r) => <span className="text-[13px] font-semibold">{r.drug_name}</span> },
    { key: "patient", header: "Member", width: "100px",
      render: (r) => <span className="font-mono text-[13px]">{r.patient_initials}</span> },
    { key: "msg", header: "NCPDP 526-FQ Message",
      render: (r) => <span className="text-[12px] text-slate-700 truncate max-w-md inline-block dark:text-slate-300">{r.field_526_FQ}</span> },
    { key: "ts", header: "Time", width: "100px", align: "right",
      render: (r) => <span className="font-mono text-[11px] text-slate-500">{r.rejected_at ? new Date(r.rejected_at).toLocaleTimeString() : "·"}</span> },
  ];

  return (
    <div>
      <PageHeader
        title="Pre-Dispense Stops"
        subtitle={`NCPDP D.0 reject codes (field 511-FB) returned to dispensing pharmacy POS · ${data.total} rejects`}
        meta={<DataSourceList sources={["Truveta", "DailyMed"]} />}
      />

      <div className="mb-5"><PbaRejectPareto data={data.code_summary} /></div>

      <div className="mb-3 grid grid-cols-2 md:grid-cols-5 gap-2">
        {data.code_summary.map((c: any) => (
          <button key={c.code} onClick={() => setFilter(filter === c.code ? "" : c.code)}
            className={clsx("text-left rounded border p-3 transition",
              filter === c.code ? "border-red-600 bg-red-50/50" : "border-slate-200 bg-white hover:border-slate-400 dark:bg-slate-800"
            )}>
            <div className="flex items-baseline justify-between">
              <code className="text-[14px] font-mono font-bold text-red-700 dark:text-red-300">{c.code}</code>
              <span className="text-xl font-bold tabular-nums text-slate-900">{c.count}</span>
            </div>
            <div className="text-[10px] text-slate-500 mt-1 line-clamp-2">{c.description}</div>
          </button>
        ))}
      </div>

      <div className="mb-3 flex items-center gap-2">
        <span className="text-[12px] text-slate-500">Filter: {filter || "All"} · {data.items.length} shown</span>
        {filter && <button onClick={() => setFilter("")} className="text-[12px] text-blue-600 hover:underline dark:text-blue-400">Clear</button>}
      </div>

      <DataTable columns={columns} rows={data.items} rowKey={(r) => r.rx_id} onRowClick={(r) => setSelected(r)} />

      <DetailDrawer open={!!selected} onClose={() => setSelected(null)}
        title={selected ? `Reject ${selected.rx_id}` : ""}
        subtitle={selected ? `${selected.ncpdp_reject_code} · ${selected.reject_description}` : undefined}
        actions={detail && (
          <>
            <Link href={`/console/prescriptions/${detail.rx_id}`} className="px-3 py-1.5 text-[13px] rounded border border-slate-300 hover:bg-slate-50">
              Open Full Claim
            </Link>
            <Link href={`/console/pba/callbacks`} className="px-3 py-1.5 text-[13px] rounded bg-blue-600 text-white">
              Open Callback Queue
            </Link>
          </>
        )}
      >
        {detail && (
          <>
            <FieldGroup title="Reject">
              <Field label="Reject Code (511-FB)" value={`${detail.reject_code} · ${detail.reject_description}`} mono />
              <Field label="Latency" value={`${detail.latency_ms}ms`} mono />
            </FieldGroup>
            {detail.drug && (
              <FieldGroup title="Drug">
                <Field label="Generic" value={detail.drug.generic} />
                <Field label="Brand" value={detail.drug.brand} />
                <Field label="NDC" value={detail.drug.ndc} mono />
              </FieldGroup>
            )}
            {detail.prescriber && (
              <FieldGroup title="Prescriber">
                <Field label="NPI" value={detail.prescriber.npi} mono />
                <Field label="Name" value={detail.prescriber.name} />
                <Field label="Specialty" value={detail.prescriber.specialty} />
              </FieldGroup>
            )}
            {detail.flags?.length > 0 && (
              <FieldGroup title={`Triggering Flags (${detail.flags.length})`}>
                {detail.flags.map((f: any, i: number) => (
                  <div key={i} className="border border-slate-200 rounded p-2 mb-1.5">
                    <div className="text-[12px] font-semibold">{f.title}</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">{f.evidence_source}</div>
                  </div>
                ))}
              </FieldGroup>
            )}
          </>
        )}
      </DetailDrawer>
    </div>
  );
}
