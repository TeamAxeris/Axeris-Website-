"use client";

import { useEffect, useState } from "react";
import { DataTable, StatRow, PageHeader, Column } from "@/components/ui/DataTable";
import { DetailDrawer, FieldGroup, Field } from "@/components/ui/DetailDrawer";
import { DataSourceList } from "@/components/ui/DataSourceBadge";
import { WorkflowDataSources } from "@/components/ui/WorkflowDataSources";
import clsx from "clsx";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { demoFetch } from "@/lib/demoFetch";

interface Dispute {
  id: string; rx_id: string; pbm: string; filed_date: string; amount_usd: number;
  category: string; status: string; dispute_type: string; x12_277_code: string;
  expected_resolution: string; resolution_amount_usd?: number;
}

export default function TPAASADisputesPage() {
  const [data, setData] = useState<any>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<any>(null);
  const [actionResult, setActionResult] = useState<any>(null);

  useEffect(() => { demoFetch("/api/v1/tpa/asa-disputes").then(setData).catch(() => {}); }, []);
  useEffect(() => {
    if (selectedId) demoFetch(`/api/v1/tpa/asa-disputes/${selectedId}`).then(setDetail).catch(() => {});
    else setDetail(null);
  }, [selectedId]);

  if (!data) return <div className="p-6"><TableSkeleton rows={8} cols={8} /></div>;

  const escalate = async () => {
    if (!selectedId) return;
    try {
      const res = await fetch(`/api/v1/tpa/asa-disputes/${selectedId}/escalate`, { method: "POST" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setActionResult({ type: "escalate", data: await res.json() });
    } catch {
      setActionResult({ type: "error", data: { message: "Escalation failed · backend unreachable. Try again." } });
    }
  };

  const fileX12 = async () => {
    if (!selectedId) return;
    try {
      const res = await fetch(`/api/v1/tpa/asa-disputes/${selectedId}/file-277u`, { method: "POST" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setActionResult({ type: "x12", data: await res.json() });
    } catch {
      setActionResult({ type: "error", data: { message: "X12 filing failed · backend unreachable. Try again." } });
    }
  };

  const statusTone = (s: string) =>
    s === "Recovered" ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:text-emerald-300 dark:bg-emerald-900/20"
    : s.includes("Open") || s.includes("Pending") ? "bg-amber-50 text-amber-700 border-amber-200 dark:text-amber-300 dark:bg-amber-900/20"
    : "bg-blue-50 text-blue-700 border-blue-200 dark:text-blue-300 dark:bg-blue-900/20";

  const columns: Column<Dispute>[] = [
    { key: "id", header: "Dispute ID", width: "150px",
      render: (r) => <span className="font-mono text-[13px] font-medium text-slate-900 dark:text-white">{r.id}</span> },
    { key: "rx", header: "Claim", width: "100px",
      render: (r) => <span className="font-mono text-[12px] text-blue-600 dark:text-blue-400">{r.rx_id}</span> },
    { key: "pbm", header: "PBM", width: "100px",
      render: (r) => <span className="text-[13px]">{r.pbm}</span> },
    { key: "category", header: "Dispute Category",
      render: (r) => <span className="text-[13px] text-slate-700 dark:text-slate-300">{r.category}</span> },
    { key: "amount", header: "Amount", width: "100px", align: "right",
      render: (r) => <span className="font-semibold tabular-nums text-[13px]">${r.amount_usd.toLocaleString()}</span> },
    { key: "x12", header: "X12 Code", width: "80px", align: "center",
      render: (r) => <code className="bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded text-[11px] font-mono">{r.x12_277_code}</code> },
    { key: "status", header: "Status", width: "180px",
      render: (r) => <span className={clsx("text-[12px] px-2 py-0.5 rounded border font-semibold", statusTone(r.status))}>{r.status}</span> },
    { key: "target", header: "Target", width: "110px", align: "right",
      render: (r) => <span className="text-[12px] text-slate-500">{r.expected_resolution}</span> },
  ];

  return (
    <div>
      <PageHeader
        title="ASA Disputes"
        subtitle="X12 276/277 claim status disputes filed against PBM under the Administrative Services Agreement"
        meta={<DataSourceList sources={["Kythera", "Truveta"]} />}
      />

      <div className="mb-4">
        <StatRow items={[
          { label: "Total Disputes", value: data.total },
          { label: "Open / In Review", value: data.open, severity: "warn" },
          { label: "Recovered", value: data.recovered, severity: "ok" },
          { label: "Recovered $", value: `$${(data.amount_recovered_usd / 1000).toFixed(1)}K`, severity: "ok" },
          { label: "In Dispute $", value: `$${(data.amount_in_dispute_usd / 1000).toFixed(1)}K`, severity: "warn" },
        ]} />
      </div>

      <WorkflowDataSources workflow="ASA Disputes" sources={[
        { name: "Kythera Wayfinder", type: "validation", used_for: "Pharmacy claim history for dispute substantiation" },
        { name: "Truveta TDM", type: "validation", used_for: "EHR + linked claims baseline for pricing comparison" },
        { name: "CMS NADAC", type: "live_api", used_for: "Drug pricing benchmark for spread-pricing detection" },
        { name: "FDA Orange Book", type: "live_api", used_for: "AB-rated generic equivalents" },
        { name: "RxNorm (NLM)", type: "live_api", used_for: "NDC normalization across PBM rebill cycles" },
        { name: "ASC X12N 277", type: "batch", used_for: "Health Care Claim Status Update standard" },
      ]} />

      <DataTable
        columns={columns}
        rows={data.items}
        rowKey={(r) => r.id}
        onRowClick={(r) => setSelectedId(r.id)}
      />

      <DetailDrawer
        open={!!selectedId}
        onClose={() => { setSelectedId(null); setActionResult(null); }}
        title={detail ? `Dispute ${detail.id}` : "Loading…"}
        subtitle={detail ? `${detail.pbm} · ${detail.category}` : undefined}
        actions={detail && (
          <>
            <button onClick={escalate} className="px-4 py-2 text-[14px] font-semibold rounded border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700">
              Escalate to PBM Acct Mgr
            </button>
            <button onClick={fileX12} className="px-4 py-2 text-[14px] font-semibold rounded bg-blue-600 text-white hover:bg-blue-700">
              File X12 277U Update
            </button>
          </>
        )}
      >
        {detail && (
          <>
            {actionResult?.type === "escalate" && (
              <div className="mb-5 bg-emerald-50 border border-emerald-300 rounded-md p-4 dark:bg-emerald-900/20">
                <div className="font-bold text-emerald-900 text-[15px] dark:text-emerald-200">Escalated successfully</div>
                <div className="text-[13px] text-emerald-800 mt-1.5 space-y-0.5 dark:text-emerald-300">
                  <div>Dispute ID: <code className="font-mono">{actionResult.data.dispute_id}</code></div>
                  <div>Escalation path: {actionResult.data.escalation_path.join(" → ")}</div>
                  <div>Expected response: {actionResult.data.expected_response_hours}h</div>
                </div>
              </div>
            )}
            {actionResult?.type === "x12" && (
              <div className="mb-5 bg-blue-50 border border-blue-300 rounded-md p-4 dark:bg-blue-900/20">
                <div className="font-bold text-blue-900 text-[15px] dark:text-blue-200">X12 277U Filed</div>
                <div className="text-[13px] text-blue-800 mt-1.5 space-y-0.5 dark:text-blue-300">
                  <div>Transaction ID: <code className="font-mono">{actionResult.data.transaction_id}</code></div>
                  <div>EDI Standard: {actionResult.data.edi_standard}</div>
                  <div>Filed at: {new Date(actionResult.data.filed_at).toLocaleString()}</div>
                  <div>Next: {actionResult.data.next_state}</div>
                  <div>Expected PBM ack: {actionResult.data.expected_pbm_ack_hours}h</div>
                </div>
              </div>
            )}
            <FieldGroup title="Dispute Status">
              <Field label="Dispute ID" value={detail.id} mono />
              <Field label="PBM" value={detail.pbm} />
              <Field label="Filed" value={detail.filed_date} />
              <Field label="Status" value={detail.status} />
              <Field label="Expected Resolution" value={detail.expected_resolution} />
              <Field label="Amount" value={`$${detail.amount_usd.toLocaleString()}`} />
              {detail.resolution_amount_usd && (
                <Field label="Recovered" value={`$${detail.resolution_amount_usd.toLocaleString()}`} />
              )}
            </FieldGroup>

            <FieldGroup title="Claim Context">
              <Field label="Rx ID" value={detail.rx_context.rx_id} mono />
              <Field label="Drug" value={detail.rx_context.drug ? `${detail.rx_context.drug}${detail.rx_context.drug_brand ? ` (${detail.rx_context.drug_brand})` : ""}` : "Drug record archived"} />
              <Field label="NDC" value={detail.rx_context.ndc || "Not on file"} mono />
              <Field label="Patient" value={detail.rx_context.patient_name || "Member privacy redacted"} />
              <Field label="Prescriber" value={detail.rx_context.prescriber_name ? `${detail.rx_context.prescriber_name}${detail.rx_context.prescriber_npi ? ` (NPI ${detail.rx_context.prescriber_npi})` : ""}` : "Prescriber not recorded"} />
              <Field label="Days Supply" value={detail.rx_context.days_supply ?? "30"} />
              <Field
                label="Billed / Allowed / Paid"
                value={
                  detail.rx_context.billed_amount != null
                    ? `$${detail.rx_context.billed_amount.toFixed(2)} / $${(detail.rx_context.allowed_amount ?? detail.rx_context.billed_amount * 0.78).toFixed(2)} / $${(detail.rx_context.paid_amount ?? detail.rx_context.billed_amount * 0.62).toFixed(2)}`
                    : `$${detail.amount_usd.toFixed(2)} disputed (claim closed in PBM ledger)`
                }
                mono
              />
            </FieldGroup>

            <FieldGroup title="X12 276 Payload (sample)">
              <pre className="bg-slate-900 text-slate-200 text-[11px] font-mono p-3 rounded overflow-x-auto">{Object.entries(detail.x12_276_payload_sample).map(([k, v]) => `${k}: ${v}`).join("\n")}</pre>
            </FieldGroup>

            <FieldGroup title="Evidence Chain">
              <ol className="text-[13px] text-slate-700 dark:text-slate-300 list-decimal list-inside space-y-1">
                {detail.evidence_chain.map((s: string, i: number) => <li key={i}>{s}</li>)}
              </ol>
            </FieldGroup>

            <FieldGroup title="Next Actions">
              <ul className="text-[13px] text-slate-700 dark:text-slate-300 list-disc list-inside space-y-1">
                {detail.next_actions.map((s: string, i: number) => <li key={i}>{s}</li>)}
              </ul>
            </FieldGroup>
          </>
        )}
      </DetailDrawer>
    </div>
  );
}
