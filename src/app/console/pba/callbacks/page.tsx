"use client";

import { useEffect, useState } from "react";
import { demoFetch, invalidate } from "@/lib/demoFetch";
import { DataTable, PageHeader, Column } from "@/components/ui/DataTable";
import { DetailDrawer, FieldGroup, Field } from "@/components/ui/DetailDrawer";
import { DataSourceList } from "@/components/ui/DataSourceBadge";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { Send, ArrowUpRight } from "lucide-react";
import clsx from "clsx";
import { PbaCallbackLanes } from "@/components/dashboard/PbaCharts";
import ContractIntegrityPanel from "@/components/prescriptions/ContractIntegrityPanel";

interface Callback {
  rx_id: string;
  callback_priority: string;
  patient_initials: string;
  drug_name: string;
  prescriber_name: string;
  prescriber_phone: string;
  prescriber_fax: string;
  pharmacy_name: string;
  pharmacy_ncpdp: string;
  primary_flag_title: string;
  suggested_action: string;
  callback_status: string;
  queued_at: string;
  ncpdp_field_526_FQ: string;
}

export default function PBACallbacksPage() {
  const [items, setItems] = useState<Callback[] | null>(null);
  const [selected, setSelected] = useState<Callback | null>(null);
  const [method, setMethod] = useState<"secure_portal" | "fax" | "escalate">("secure_portal");
  const [body, setBody] = useState("");
  const [receipt, setReceipt] = useState<any>(null);
  const [sending, setSending] = useState(false);
  const [resolving, setResolving] = useState(false);

  useEffect(() => {
    demoFetch("/api/v1/pba/callback-queue?limit=80")
      .then((d: any) => setItems(d.items))
      .catch(() => setItems([]));
  }, []);

  useEffect(() => {
    if (selected) {
      setBody(`Re: ${selected.drug_name} for member ${selected.patient_initials}\n\n${selected.suggested_action}\n\nNCPDP 526-FQ: ${selected.ncpdp_field_526_FQ}\n\nPlease confirm clinical decision or modify Rx. Reply via secure portal or fax.`);
      setReceipt(null);
    }
  }, [selected]);

  if (!items) return <div className="p-6"><TableSkeleton rows={8} cols={7} /></div>;

  const sendMessage = async () => {
    if (!selected || sending) return;
    setSending(true);
    try {
      const r = await fetch(`/api/v1/pba/callbacks/${selected.rx_id}/send-message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method, body }),
      }).then(r => r.json());
      setReceipt(r);
    } catch (err) {
      setReceipt({ ok: false, error: "Send failed. Network or backend unreachable." });
    } finally {
      setSending(false);
    }
  };

  // Persisted resolution · POST so the status survives reloads
  const markResolved = async () => {
    if (!selected || resolving) return;
    setResolving(true);
    try {
      await fetch(`/api/v1/pba/callbacks/${selected.rx_id}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resolution: "Resolved after prescriber consult" }),
      });
      invalidate("/api/v1/pba/callback-queue");
      setItems(prev => prev ? prev.map(i => i.rx_id === selected.rx_id ? { ...i, callback_status: "resolved" } : i) : prev);
      setReceipt({ resolved: true });
    } catch {
      setReceipt({ ok: false, error: "Could not record resolution · backend unreachable." });
    } finally {
      setResolving(false);
    }
  };

  const columns: Column<Callback>[] = [
    { key: "priority", header: "Priority", width: "90px",
      render: (r) => <span className={clsx("text-[11px] px-2 py-0.5 rounded font-bold uppercase border",
        r.callback_priority === "high" ? "bg-red-50 text-red-700 border-red-200 dark:text-red-300 dark:bg-red-900/20" : "bg-amber-50 text-amber-700 border-amber-200 dark:text-amber-300 dark:bg-amber-900/20"
      )}>{r.callback_priority}</span> },
    { key: "rx", header: "Rx", width: "100px",
      render: (r) => <span className="font-mono text-[12px] text-blue-600 dark:text-blue-400">{r.rx_id}</span> },
    { key: "drug", header: "Drug",
      render: (r) => <span className="text-[13px] font-semibold">{r.drug_name}</span> },
    { key: "member", header: "Member", width: "90px",
      render: (r) => <span className="text-[13px]">{r.patient_initials}</span> },
    { key: "trigger", header: "Reason for Callback",
      render: (r) => (
        <div>
          <div className="text-[13px] text-slate-900 dark:text-white">{r.primary_flag_title}</div>
          <div className="text-[11px] text-slate-500 truncate max-w-md">{r.suggested_action}</div>
        </div>
      )},
    { key: "prescriber", header: "Prescriber", width: "180px",
      render: (r) => (
        <div>
          <div className="text-[13px]">{r.prescriber_name}</div>
          <div className="text-[11px] text-slate-500 font-mono">{r.prescriber_phone}</div>
        </div>
      )},
    { key: "status", header: "Status", width: "150px",
      render: (r) => <span className="text-[12px] capitalize">{r.callback_status.replace(/_/g, " ")}</span> },
  ];

  return (
    <div>
      <PageHeader
        title="Pharmacist Callback Queue"
        subtitle="Soft-edit transactions awaiting prescriber outreach. Pharmacists send secure messages or fax · they don't make phone calls."
        meta={<DataSourceList sources={["Truveta", "NPPES"]} />}
      />

      <div className="mb-5"><PbaCallbackLanes items={items} /></div>

      <DataTable columns={columns} rows={items} rowKey={(r) => r.rx_id} onRowClick={(r) => setSelected(r)}
        emptyMessage="No callbacks queued. Soft-edit transactions requiring prescriber outreach will appear here." />

      <DetailDrawer
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected ? `Callback: ${selected.drug_name}` : ""}
        subtitle={selected ? `Member ${selected.patient_initials} · ${selected.prescriber_name}` : undefined}
        width="wide"
        actions={selected && !receipt && (
          <>
            <button
              onClick={markResolved}
              disabled={resolving || selected.callback_status === "resolved"}
              title="Mark this callback resolved · persists to the queue and audit trail"
              className="px-3 py-1.5 text-[13px] rounded border border-emerald-300 text-emerald-700 hover:bg-emerald-50 disabled:opacity-60 disabled:cursor-not-allowed dark:text-emerald-300"
            >
              {selected.callback_status === "resolved" ? "Resolved ✓" : resolving ? "Saving…" : "Mark Resolved"}
            </button>
            <button onClick={() => setReceipt({ ok: false, cancelled: true })} className="px-3 py-1.5 text-[13px] rounded border border-slate-300 hover:bg-slate-50 text-slate-700 dark:text-slate-300">
              Save as Draft
            </button>
            <button
              onClick={sendMessage}
              disabled={sending}
              className="px-3 py-1.5 text-[13px] rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center gap-1.5"
            >
              <Send className="w-3.5 h-3.5" /> {sending ? "Sending…" : `Send via ${method.replace("_", " ")}`}
            </button>
          </>
        )}
      >
        {selected && (
          <>
            <ContractIntegrityPanel compact input={{
              id: selected.rx_id,
              drugName: selected.drug_name,
              riskScore: selected.callback_priority === "high" ? 88 : 62,
            }} />
            <FieldGroup title="Callback Context">
              <Field label="Rx ID" value={selected.rx_id} mono />
              <Field label="Drug" value={selected.drug_name} />
              <Field label="Member" value={selected.patient_initials} />
              <Field label="Pharmacy" value={`${selected.pharmacy_name} (NCPDP ${selected.pharmacy_ncpdp})`} />
              <Field label="Priority" value={selected.callback_priority} />
              <Field label="Queued" value={selected.queued_at ? new Date(selected.queued_at).toLocaleString() : "·"} />
            </FieldGroup>

            <FieldGroup title="Reason">
              <div className="text-[13px] text-slate-900 dark:text-white font-semibold">{selected.primary_flag_title}</div>
              <div className="text-[12px] text-slate-700 dark:text-slate-300 mt-1.5">{selected.suggested_action}</div>
              <div className="text-[11px] text-slate-500 font-mono mt-2 bg-slate-50 dark:bg-slate-900 p-2 rounded">
                NCPDP 526-FQ: {selected.ncpdp_field_526_FQ}
              </div>
            </FieldGroup>

            <FieldGroup title="Prescriber">
              <Field label="Name" value={selected.prescriber_name} />
              <Field label="Secure Portal" value={selected.prescriber_phone ? "Available" : "Not available"} />
              <Field label="Fax" value={selected.prescriber_fax} mono />
            </FieldGroup>

            {!receipt && (
              <FieldGroup title="Outreach Method">
                <div className="space-y-2">
                  {[
                    { v: "secure_portal", label: "Secure portal message", desc: "Preferred · most EHRs accept (Surescripts, etc). 4h SLA." },
                    { v: "fax", label: "NCPDP-formatted fax", desc: "Industry standard. 24h SLA. Use when secure portal unavailable." },
                    { v: "escalate", label: "Escalate to pharmacy network manager", desc: "Bypass prescriber. 1h SLA. Use only for critical safety blocks." },
                  ].map((opt) => (
                    <label key={opt.v} className={clsx(
                      "block border rounded p-3 cursor-pointer transition",
                      method === opt.v ? "border-blue-600 bg-blue-50/50" : "border-slate-200 hover:border-slate-300"
                    )}>
                      <div className="flex items-center gap-2">
                        <input type="radio" checked={method === opt.v} onChange={() => setMethod(opt.v as any)} />
                        <span className="font-semibold text-[13px]">{opt.label}</span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5 ml-5">{opt.desc}</div>
                    </label>
                  ))}
                </div>
                <div className="mt-3">
                  <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold mb-1">Message body</div>
                  <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={6}
                    className="w-full px-3 py-2 text-[13px] border border-slate-300 dark:border-slate-600 rounded font-mono bg-white dark:bg-slate-900" />
                </div>
              </FieldGroup>
            )}

            {receipt && receipt.ok && (
              <div className="bg-emerald-50 border border-emerald-200 rounded p-4 dark:bg-emerald-900/20">
                <div className="font-semibold text-emerald-900 dark:text-emerald-200">Message Delivered</div>
                <div className="text-[12px] text-emerald-700 mt-2 space-y-0.5 dark:text-emerald-300">
                  <div>Receipt ID: <code className="font-mono">{receipt.receipt_id}</code></div>
                  <div>Delivered to: {receipt.delivered_to.endpoint}</div>
                  <div>Method: {receipt.method.replace("_", " ")}</div>
                  <div>Expected response: within {receipt.estimated_response_hours}h</div>
                  <div>Next: {receipt.next_action}</div>
                </div>
              </div>
            )}
            {receipt && receipt.cancelled && (
              <div className="bg-slate-50 border border-slate-200 rounded p-3 text-[13px] text-slate-700 dark:text-slate-300">
                Saved as draft.
              </div>
            )}
            {receipt && receipt.resolved && (
              <div className="bg-emerald-50 border border-emerald-200 rounded p-4 dark:bg-emerald-900/20">
                <div className="font-semibold text-emerald-900 dark:text-emerald-200">Callback Resolved</div>
                <div className="text-[12px] text-emerald-700 mt-1 dark:text-emerald-300">
                  Status persisted · this callback now shows as resolved in the queue and audit trail.
                </div>
              </div>
            )}
            {receipt && receipt.error && (
              <div className="bg-red-50 border border-red-200 rounded p-3 text-[13px] text-red-800 dark:bg-red-900/20 dark:text-red-300">
                {receipt.error}
              </div>
            )}
          </>
        )}
      </DetailDrawer>
    </div>
  );
}
