"use client";

import { useEffect, useState } from "react";
import { demoFetch } from "@/lib/demoFetch";
import { DataTable, PageHeader, Column } from "@/components/ui/DataTable";
import { DetailDrawer, FieldGroup, Field } from "@/components/ui/DetailDrawer";
import { DataSourceList } from "@/components/ui/DataSourceBadge";
import clsx from "clsx";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { PbaRealtimePulse } from "@/components/dashboard/PbaCharts";

export default function PBALiveTransactionsPage() {
  const [data, setData] = useState<any>(null);
  const [auto, setAuto] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<any>(null);

  useEffect(() => {
    // First paint from cache (instant on revisit), then live polling.
    demoFetch("/api/v1/pba/live-transactions?limit=80").then(setData).catch(() => {});
    const load = () =>
      fetch("/api/v1/pba/live-transactions?limit=80").then(r => r.json()).then(setData).catch(() => {});
    if (auto) {
      const i = setInterval(load, 10000);
      return () => clearInterval(i);
    }
  }, [auto]);

  useEffect(() => {
    if (selectedId) demoFetch(`/api/v1/pba/transactions/${selectedId}`).then(setDetail).catch(() => {});
    else setDetail(null);
  }, [selectedId]);

  if (!data) return <div className="p-6"><TableSkeleton rows={10} cols={9} /></div>;

  const statusBadge = (s: string) => {
    if (s === "PAID") return "bg-emerald-50 text-emerald-700 border-emerald-200 dark:text-emerald-300 dark:bg-emerald-900/20";
    if (s === "SOFT_EDIT") return "bg-amber-50 text-amber-700 border-amber-200 dark:text-amber-300 dark:bg-amber-900/20";
    return "bg-red-50 text-red-700 border-red-200 dark:text-red-300 dark:bg-red-900/20";
  };

  const columns: Column<any>[] = [
    { key: "ts", header: "Time", width: "110px",
      render: (r) => <span className="font-mono text-[12px] text-slate-500">{r.processed_at ? new Date(r.processed_at).toLocaleTimeString() : "·"}</span> },
    { key: "tx", header: "Tx", width: "60px",
      render: (r) => <code className="bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded text-[11px] font-mono">{r.ncpdp_transaction_code}</code> },
    { key: "status", header: "Status", width: "100px",
      render: (r) => <span className={clsx("text-[12px] px-2 py-0.5 rounded border font-bold", statusBadge(r.transaction_status))}>{r.transaction_status}</span> },
    { key: "reject", header: "Reject Code", width: "120px",
      render: (r) => r.reject_code ? (
        <div>
          <code className="bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded text-[11px] font-mono font-semibold">{r.reject_code}</code>
          <div className="text-[10px] text-slate-500 mt-0.5">{r.reject_description}</div>
        </div>
      ) : <span className="text-slate-300">·</span> },
    { key: "drug", header: "Drug",
      render: (r) => (
        <div>
          <div className="text-[13px] font-semibold text-slate-900 dark:text-white">{r.drug_name}</div>
          <div className="text-[10px] text-slate-500 font-mono">NDC {r.ndc}</div>
        </div>
      )},
    { key: "patient", header: "Member", width: "100px",
      render: (r) => <span className="text-[12px]">{r.patient_name}</span> },
    { key: "prescriber", header: "Prescriber NPI", width: "130px",
      render: (r) => <span className="font-mono text-[12px] text-slate-600 dark:text-slate-400">{r.prescriber_npi || "·"}</span> },
    { key: "pharmacy", header: "Pharmacy NCPDP", width: "140px",
      render: (r) => <span className="font-mono text-[12px] text-slate-600 dark:text-slate-400">{r.pharmacy_ncpdp_id || "·"}</span> },
    { key: "latency", header: "Latency", width: "80px", align: "right",
      render: (r) => <span className={clsx("font-mono font-semibold text-[12px]",
        r.latency_ms > 200 ? "text-red-700 dark:text-red-300" : r.latency_ms > 150 ? "text-amber-700 dark:text-amber-300" : "text-emerald-700 dark:text-emerald-300"
      )}>{r.latency_ms}ms</span> },
  ];

  return (
    <div>
      <PageHeader
        title="Live NCPDP D.0 Transaction Stream"
        subtitle="Real-time pharmacy POS adjudication feed · B1 (billing), B2 (reversal), B3 (rebill)"
        meta={
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" /> LIVE
            </span>
            <DataSourceList sources={["Truveta", "NPPES"]} />
            <button onClick={() => setAuto(!auto)} className="text-[12px] px-2.5 py-1 rounded border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700">
              Auto-refresh: {auto ? "ON" : "OFF"}
            </button>
          </div>
        }
      />

      <div className="mb-5">
        <PbaRealtimePulse
          items={data.items}
          avg={Math.round(data.items.reduce((sum: number, item: any) => sum + item.latency_ms, 0) / Math.max(1, data.items.length))}
          p95={[...data.items].sort((a: any, b: any) => a.latency_ms - b.latency_ms)[Math.floor(data.items.length * .95)]?.latency_ms || 0}
        />
      </div>

      <DataTable columns={columns} rows={data.items} rowKey={(r: any) => r.rx_id} onRowClick={(r: any) => setSelectedId(r.rx_id)} />

      <DetailDrawer
        open={!!selectedId}
        onClose={() => setSelectedId(null)}
        title={detail ? `Transaction ${detail.rx_id}` : "Loading…"}
        subtitle={detail ? `${detail.drug?.generic} · ${detail.transaction_status}` : undefined}
        actions={detail && detail.transaction_status !== "PAID" && (
          <>
            {detail.patient?.id && (
              <a
                href={`/console/patients/${detail.patient.id}`}
                title="Open the member's full prescription history and clinical chart"
                className="px-3 py-1.5 text-[13px] rounded border border-slate-300 hover:bg-slate-50 text-slate-700 dark:text-slate-300"
              >
                View Member History
              </a>
            )}
            <a
              href={`/console/prescriptions/${detail.rx_id}`}
              title="Open the full claim with all NCPDP fields, flags, and adjudication detail"
              className="px-3 py-1.5 text-[13px] rounded bg-blue-600 text-white hover:bg-blue-700"
            >
              Open Full Claim
            </a>
          </>
        )}
      >
        {detail && (
          <>
            <FieldGroup title="NCPDP D.0 Transaction">
              <Field label="Rx ID" value={detail.rx_id} mono />
              <Field label="Transaction Code" value={detail.ncpdp_transaction_code} mono />
              <Field label="Status" value={detail.transaction_status} />
              {detail.reject_code && <Field label="Reject Code (511-FB)" value={`${detail.reject_code} · ${detail.reject_description}`} mono />}
              <Field label="Latency" value={`${detail.latency_ms}ms`} mono />
              <Field label="Operating Mode" value={detail.operating_mode} />
            </FieldGroup>

            <FieldGroup title="NCPDP Field Detail">
              <pre className="bg-slate-900 text-slate-200 text-[10px] font-mono p-3 rounded overflow-x-auto">
{Object.entries(detail.fields).map(([k, v]) => `${k}: ${v ?? "·"}`).join("\n")}
              </pre>
            </FieldGroup>

            {detail.drug && (
              <FieldGroup title="Drug">
                <Field label="Generic" value={detail.drug.generic} />
                <Field label="Brand" value={detail.drug.brand} />
                <Field label="NDC" value={detail.drug.ndc} mono />
                <Field label="Class" value={detail.drug.drug_class} />
                <Field label="Schedule" value={detail.drug.schedule || "Non-controlled (Rx legend)"} />
                {detail.drug.is_specialty && <Field label="Specialty" value="Yes" />}
                {detail.drug.rems_program && <Field label="REMS" value={detail.drug.rems_program} />}
              </FieldGroup>
            )}

            {detail.patient && (
              <FieldGroup title="Member">
                <Field label="ID" value={detail.patient.id} mono />
                <Field label="Initials" value={detail.patient.initials} />
                <Field label="Age" value={detail.patient.age} />
                <Field label="Gender" value={detail.patient.gender} />
              </FieldGroup>
            )}

            {detail.prescriber && (
              <FieldGroup title="Prescriber">
                <Field label="NPI" value={detail.prescriber.npi} mono />
                <Field label="Name" value={detail.prescriber.name} />
                <Field label="Specialty" value={detail.prescriber.specialty} />
                <Field label="Phone" value={detail.prescriber.phone} mono />
                <Field label="Fax" value={detail.prescriber.fax} mono />
                {detail.prescriber.is_excluded && (
                  <div className="bg-red-50 border border-red-200 text-red-800 text-[12px] px-3 py-2 rounded mt-1 dark:bg-red-900/20 dark:text-red-300">
                    ⚠ Provider on federal exclusion list · block payment
                  </div>
                )}
              </FieldGroup>
            )}

            {detail.pharmacy && (
              <FieldGroup title="Pharmacy">
                <Field label="NCPDP ID" value={detail.pharmacy.ncpdp} mono />
                <Field label="Name" value={detail.pharmacy.name} />
                <Field label="Address" value={detail.pharmacy.address} />
                <Field label="Type" value={detail.pharmacy.type} />
              </FieldGroup>
            )}

            {detail.flags?.length > 0 && (
              <FieldGroup title={`Clinical Flags (${detail.flags.length})`}>
                {detail.flags.map((f: any, i: number) => (
                  <div key={i} className="border border-slate-200 dark:border-slate-700 rounded p-2 mb-1.5">
                    <div className="flex items-center gap-2">
                      <code className="text-[10px] bg-slate-100 dark:bg-slate-700 px-1 rounded">{f.flag_id}</code>
                      <span className={clsx("text-[10px] px-1.5 py-0.5 rounded font-bold uppercase",
                        f.severity === "critical" ? "bg-red-100 text-red-800 dark:text-red-300 dark:bg-red-900/30"
                        : f.severity === "warning" ? "bg-amber-100 text-amber-800 dark:text-amber-300 dark:bg-amber-900/30"
                        : "bg-blue-100 text-blue-800 dark:text-blue-300 dark:bg-blue-900/30")}>{f.severity}</span>
                    </div>
                    <div className="text-[12px] font-semibold mt-1">{f.title}</div>
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
