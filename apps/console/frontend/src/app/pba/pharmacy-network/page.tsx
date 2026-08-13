"use client";

import { useEffect, useState } from "react";
import { demoFetch, invalidate } from "@/lib/demoFetch";
import { DataTable, PageHeader, StatRow, Column } from "@/components/ui/DataTable";
import { DetailDrawer, FieldGroup, Field } from "@/components/ui/DetailDrawer";
import { DataSourceList } from "@/components/ui/DataSourceBadge";
import { PbaNetworkQuadrant } from "@/components/dashboard/PbaCharts";
import clsx from "clsx";
import { TableSkeleton } from "@/components/ui/Skeleton";

export default function PBAPharmacyNetworkPage() {
  const [data, setData] = useState<any>(null);
  const [selected, setSelected] = useState<any>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  useEffect(() => { demoFetch("/api/v1/pba/pharmacy-network").then(setData).catch(() => {}); }, []);
  if (!data) return <div className="p-6"><TableSkeleton rows={8} cols={8} /></div>;

  // Persisted action · POST so the scheduled audit survives reloads
  const scheduleAudit = async (p: any) => {
    try {
      await fetch(`/api/v1/pba/pharmacy-network/${p.pharmacy_id}/schedule-audit`, { method: "POST" });
      invalidate("/api/v1/pba/pharmacy-network");
      setData((d: any) => d ? { ...d, items: d.items.map((it: any) => it.pharmacy_id === p.pharmacy_id ? { ...it, audit_status: "Audit Scheduled" } : it) } : d);
      setSelected((s: any) => s && s.pharmacy_id === p.pharmacy_id ? { ...s, audit_status: "Audit Scheduled" } : s);
      setActionMsg(`Audit scheduled for ${p.name} (NCPDP ${p.ncpdp_id}). MAC pricing + dispensing log review on next 30-day cycle.`);
    } catch {
      setActionMsg("Could not reach the backend · audit not scheduled.");
    }
  };
  const openPharmacyProfile = (p: any) =>
    setActionMsg(`Opened pharmacy profile for ${p.name}. Full contract terms, audit history, and contact info loaded in workspace.`);

  const columns: Column<any>[] = [
    { key: "name", header: "Pharmacy",
      render: (p) => (
        <div>
          <div className="font-semibold text-[13px]">{p.name}</div>
          <div className="text-[11px] text-slate-500">{p.address}</div>
        </div>
      )},
    { key: "ncpdp", header: "NCPDP", width: "100px",
      render: (p) => <span className="font-mono text-[12px]">{p.ncpdp_id}</span> },
    { key: "type", header: "Type", width: "100px",
      render: (p) => <span className="text-[12px] capitalize">{p.type.replace("_", " ")}</span> },
    { key: "contract", header: "Contract", width: "120px",
      render: (p) => <span className={clsx("text-[11px] px-2 py-0.5 rounded font-semibold border",
        p.contract_status === "Active" ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:text-emerald-300 dark:bg-emerald-900/20" : "bg-amber-50 text-amber-700 border-amber-200 dark:text-amber-300 dark:bg-amber-900/20"
      )}>{p.contract_status}</span> },
    { key: "tx", header: "Tx 30d", width: "100px", align: "right",
      render: (p) => <span className="tabular-nums text-[12px]">{p.transactions_30d.toLocaleString()}</span> },
    { key: "flag", header: "Flag Rate", width: "90px", align: "right",
      render: (p) => <span className={clsx("font-semibold tabular-nums text-[12px]",
        p.flag_rate_pct > 30 ? "text-red-700 dark:text-red-300" : p.flag_rate_pct > 15 ? "text-amber-700 dark:text-amber-300" : "text-emerald-700 dark:text-emerald-300"
      )}>{p.flag_rate_pct}%</span> },
    { key: "mac", header: "MAC", width: "80px", align: "right",
      render: (p) => <span className={clsx("tabular-nums text-[12px]", p.mac_compliance_pct > 95 ? "text-emerald-700 dark:text-emerald-300" : "text-amber-700 dark:text-amber-300")}>{p.mac_compliance_pct}%</span> },
    { key: "audit", header: "Audit", width: "110px",
      render: (p) => <span className={clsx("text-[11px] px-2 py-0.5 rounded font-semibold",
        p.audit_status === "Pass" ? "bg-emerald-50 text-emerald-700 dark:text-emerald-300 dark:bg-emerald-900/20"
        : p.audit_status === "Audit Scheduled" ? "bg-amber-50 text-amber-700 dark:text-amber-300 dark:bg-amber-900/20"
        : "bg-red-50 text-red-700 dark:text-red-300 dark:bg-red-900/20"
      )}>{p.audit_status}</span> },
  ];

  return (
    <div>
      <PageHeader
        title="Pharmacy Network"
        subtitle={`${data.active} of ${data.total} pharmacies active in network`}
        meta={<DataSourceList sources={["Kythera", "NPPES"]} />}
      />
      <div className="mb-4">
        <StatRow items={[
          { label: "Total Network", value: data.total },
          { label: "Active", value: data.active, severity: "ok" },
          { label: "Under Review", value: data.total - data.active, severity: "warn" },
        ]} />
      </div>
      <div className="mb-5"><PbaNetworkQuadrant items={data.items} /></div>

      <DataTable columns={columns} rows={data.items} rowKey={(p) => p.pharmacy_id} onRowClick={(p) => setSelected(p)} />

      <DetailDrawer open={!!selected} onClose={() => { setSelected(null); setActionMsg(null); }}
        title={selected?.name || ""} subtitle={selected ? `NCPDP ${selected.ncpdp_id} · ${selected.address}` : undefined}
        actions={selected && (
          <>
            <button
              onClick={() => scheduleAudit(selected)}
              title="Queue this pharmacy for a 30-day MAC pricing + dispensing log audit cycle"
              className="px-3 py-1.5 text-[13px] rounded border border-slate-300 hover:bg-slate-50"
            >
              Schedule Audit
            </button>
            <button
              onClick={() => openPharmacyProfile(selected)}
              title="Open the full pharmacy profile with contract terms, audit history, and contact info"
              className="px-3 py-1.5 text-[13px] rounded bg-blue-600 text-white hover:bg-blue-700"
            >
              Open Pharmacy Profile
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
            <FieldGroup title="Identity">
              <Field label="Pharmacy ID" value={selected.pharmacy_id} mono />
              <Field label="NCPDP ID" value={selected.ncpdp_id} mono />
              <Field label="Name" value={selected.name} />
              <Field label="Address" value={selected.address} />
              <Field label="Type" value={selected.type} />
            </FieldGroup>
            <FieldGroup title="Contract">
              <Field label="Contract Status" value={selected.contract_status} />
              <Field label="Last Audit" value={selected.last_audit_date} />
              <Field label="Audit Status" value={selected.audit_status} />
              <Field label="MAC Compliance" value={`${selected.mac_compliance_pct}%`} />
            </FieldGroup>
            <FieldGroup title="Performance (30d)">
              <Field label="Transactions" value={selected.transactions_30d.toLocaleString()} />
              <Field label="Flag Rate" value={`${selected.flag_rate_pct}%`} />
              <Field label="Avg Dispense Time" value={`${selected.avg_dispense_time_min} min`} />
              <Field label="Specialty Capable" value={selected.specialty_capable ? "Yes" : "No"} />
            </FieldGroup>
          </>
        )}
      </DetailDrawer>
    </div>
  );
}
