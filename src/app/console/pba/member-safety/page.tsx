"use client";

import { useEffect, useState } from "react";
import { demoFetch, invalidate } from "@/lib/demoFetch";
import Link from "next/link";
import { DataTable, PageHeader, Column } from "@/components/ui/DataTable";
import { DetailDrawer, FieldGroup, Field } from "@/components/ui/DetailDrawer";
import { DataSourceList } from "@/components/ui/DataSourceBadge";
import clsx from "clsx";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { PbaSafetyTriage } from "@/components/dashboard/PbaCharts";

export default function PBAMemberSafetyPage() {
  const [data, setData] = useState<any>(null);
  const [selected, setSelected] = useState<any>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  useEffect(() => { demoFetch("/api/v1/pba/member-safety").then(setData).catch(() => {}); }, []);
  if (!data) return <div className="p-6"><TableSkeleton rows={8} cols={7} /></div>;

  // Persisted actions · POST to the backend so the status survives reloads
  const recordOutreach = async (m: any, action: "care_outreach" | "escalate_md", msg: string) => {
    try {
      await fetch(`/api/v1/pba/member-safety/${m.patient_id}/outreach`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      invalidate("/api/v1/pba/member-safety");
      const status = action === "escalate_md" ? "escalated_md" : "outreach_in_progress";
      setData((d: any) => d ? { ...d, items: d.items.map((it: any) => it.patient_id === m.patient_id ? { ...it, outreach_status: status } : it) } : d);
      setSelected((s: any) => s && s.patient_id === m.patient_id ? { ...s, outreach_status: status } : s);
      setActionMsg(msg);
    } catch {
      setActionMsg("Could not reach the backend · action not recorded.");
    }
  };
  const careMgmtOutreach = (m: any) =>
    recordOutreach(m, "care_outreach", `Care management outreach recorded for member ${m.patient_initials}. Secure portal message + phone follow-up within 48h. Care manager assigned.`);
  const escalateToMD = (m: any) =>
    recordOutreach(m, "escalate_md", `Escalation recorded for member ${m.patient_initials} (${m.alert_priority}). MD review within 24h. Audit trail logged.`);

  const priorityBadge = (p: string) =>
    p === "P1" ? "bg-red-50 text-red-700 border-red-200 dark:text-red-300 dark:bg-red-900/20"
    : p === "P2" ? "bg-amber-50 text-amber-700 border-amber-200 dark:text-amber-300 dark:bg-amber-900/20"
    : "bg-slate-50 text-slate-700 border-slate-200 dark:text-slate-300";

  const columns: Column<any>[] = [
    { key: "priority", header: "Priority", width: "70px",
      render: (m) => <span className={clsx("text-[11px] px-2 py-0.5 rounded border font-bold", priorityBadge(m.alert_priority))}>{m.alert_priority}</span> },
    { key: "member", header: "Member", width: "120px",
      render: (m) => <span className="font-mono text-[13px] font-semibold">{m.patient_initials}</span> },
    { key: "demo", header: "Demographics", width: "120px",
      render: (m) => <span className="text-[12px]">{m.gender} · age {m.age}</span> },
    { key: "criticals", header: "Critical Flags", width: "100px", align: "right",
      render: (m) => <span className="font-bold tabular-nums text-red-700 dark:text-red-300">{m.critical_flag_count}</span> },
    { key: "blocks", header: "Active Blocks", width: "100px", align: "right",
      render: (m) => <span className="tabular-nums">{m.active_rx_blocks}</span> },
    { key: "concerns", header: "Top Concerns",
      render: (m) => (
        <div>
          {m.top_concerns.slice(0, 2).map((c: string, i: number) => (
            <div key={i} className="text-[12px] text-slate-700 dark:text-slate-300 truncate max-w-md">{c}</div>
          ))}
          {m.top_concerns.length > 2 && <div className="text-[10px] text-slate-400">+{m.top_concerns.length - 2} more</div>}
        </div>
      )},
    { key: "outreach", header: "Outreach", width: "180px",
      render: (m) => <span className="text-[12px] capitalize">{m.outreach_status.replace(/_/g, " ")}</span> },
  ];

  return (
    <div>
      <PageHeader
        title="Member Safety"
        subtitle="Members with active critical-severity prescription blocks. Triggers Member Safety Officer review and care management outreach."
        meta={<DataSourceList sources={["Truveta"]} />}
      />

      <div className="mb-5"><PbaSafetyTriage data={data} /></div>

      <DataTable columns={columns} rows={data.items} rowKey={(m) => m.patient_id} onRowClick={(m) => setSelected(m)}
        emptyMessage="No active member safety alerts. Members with critical prescription blocks triggering P1/P2/P3 escalation will appear here." />

      <DetailDrawer
        open={!!selected}
        onClose={() => { setSelected(null); setActionMsg(null); }}
        title={selected ? `Member ${selected.patient_initials}` : ""}
        subtitle={selected ? `${selected.alert_priority} · ${selected.critical_flag_count} critical flag(s)` : undefined}
        actions={selected && (
          <>
            <Link
              href={`/console/patients/${selected.patient_id}`}
              title="Open the full member chart with prescription history, allergies, and clinical context"
              className="px-3 py-1.5 text-[13px] rounded border border-slate-300 hover:bg-slate-50 text-slate-700 dark:text-slate-300"
            >
              Open Member Chart
            </Link>
            <button
              onClick={() => careMgmtOutreach(selected)}
              title="Trigger care management secure portal message + 48h phone follow-up"
              className="px-3 py-1.5 text-[13px] rounded border border-slate-300 hover:bg-slate-50 text-slate-700 dark:text-slate-300"
            >
              Care Mgmt Outreach
            </button>
            <button
              onClick={() => escalateToMD(selected)}
              title="File urgent escalation to Medical Director for 24h review"
              className="px-3 py-1.5 text-[13px] rounded bg-red-600 text-white hover:bg-red-700"
            >
              Escalate to MD
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
            <FieldGroup title="Member">
              <Field label="ID" value={selected.patient_id} mono />
              <Field label="Initials" value={selected.patient_initials} />
              <Field label="Age" value={selected.age} />
              <Field label="Gender" value={selected.gender} />
              <Field label="Priority Level" value={selected.alert_priority} />
              <Field label="Outreach Status" value={selected.outreach_status.replace(/_/g, " ")} />
            </FieldGroup>
            <FieldGroup title="Active Blocks">
              <Field label="Critical flags" value={selected.critical_flag_count} />
              <Field label="Active blocks" value={selected.active_rx_blocks} />
            </FieldGroup>
            <FieldGroup title="Top Concerns">
              <ul className="text-[13px] text-slate-700 dark:text-slate-300 list-disc list-inside space-y-1">
                {selected.top_concerns.map((c: string, i: number) => <li key={i}>{c}</li>)}
              </ul>
            </FieldGroup>
            <FieldGroup title="Suggested Outreach">
              <ul className="text-[13px] text-slate-700 dark:text-slate-300 list-disc list-inside space-y-1">
                <li>Member secure portal message · preferred (within 48h)</li>
                <li>Care manager phone outreach if portal not active</li>
                <li>MD escalation if member unresponsive in 7d</li>
              </ul>
            </FieldGroup>
          </>
        )}
      </DetailDrawer>
    </div>
  );
}
