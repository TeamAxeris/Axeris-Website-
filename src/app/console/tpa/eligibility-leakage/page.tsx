"use client";

import { useEffect, useState } from "react";
import { demoFetch, invalidate } from "@/lib/demoFetch";
import { DataTable, PageHeader, StatRow, Column } from "@/components/ui/DataTable";
import { DetailDrawer, FieldGroup, Field } from "@/components/ui/DetailDrawer";
import { DataSourceList } from "@/components/ui/DataSourceBadge";
import { TableSkeleton } from "@/components/ui/Skeleton";
import clsx from "clsx";
import { Undo2, CheckCircle2 } from "lucide-react";

interface LeakedClaim {
  claim_id: string;
  patient_id: string;
  patient_initials: string;
  drug_name: string;
  term_date: string;
  claim_date: string;
  days_after_term: number;
  paid_usd: number;
  status: "open" | "recovery_initiated";
}

const GET_URL = "/api/v1/tpa/eligibility-leakage";

function money(n: number): string {
  return `$${Math.round(n).toLocaleString()}`;
}

export default function EligibilityLeakagePage() {
  const [data, setData] = useState<any>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [actionErr, setActionErr] = useState(false);

  useEffect(() => {
    demoFetch(GET_URL).then(setData).catch(() => {});
  }, []);

  if (!data) return <div className="p-6"><TableSkeleton rows={8} cols={7} /></div>;

  const items: LeakedClaim[] = data.items || [];
  const selected: LeakedClaim | null = selectedId
    ? items.find((i) => i.claim_id === selectedId) || null
    : null;

  const closeDrawer = () => {
    setSelectedId(null);
    setActionMsg(null);
    setActionErr(false);
  };

  const initiateRecovery = async () => {
    if (!selected || posting || selected.status === "recovery_initiated") return;
    // Pin the claim before the async gap · `selected` can change if the user
    // clicks another row while the POST is in flight.
    const claimId = selected.claim_id;
    const claimAmount = selected.paid_usd;
    setPosting(true);
    setActionMsg(null);
    setActionErr(false);
    try {
      const res = await fetch(`${GET_URL}/${claimId}/recover`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ claim_id: claimId }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      invalidate(GET_URL);
      // Optimistic update: flip item status and roll paid $ into the Recovery Initiated KPI.
      setData((prev: any) => {
        if (!prev) return prev;
        const item = (prev.items || []).find((i: LeakedClaim) => i.claim_id === claimId);
        if (!item || item.status === "recovery_initiated") return prev;
        return {
          ...prev,
          recovery_initiated_usd: (prev.recovery_initiated_usd || 0) + item.paid_usd,
          items: (prev.items || []).map((i: LeakedClaim) =>
            i.claim_id === claimId ? { ...i, status: "recovery_initiated" as const } : i
          ),
        };
      });
      setActionErr(false);
      setActionMsg(
        `Chargeback recovery initiated for ${claimId} · NCPDP B2 reversal queued and recoup letter generated for ${money(claimAmount)}.`
      );
    } catch {
      setActionErr(true);
      setActionMsg("Failed to initiate chargeback recovery. The recovery service did not accept the request · try again.");
    } finally {
      setPosting(false);
    }
  };

  const columns: Column<LeakedClaim>[] = [
    {
      key: "claim_id", header: "Claim ID", width: "130px",
      render: (r) => <span className="font-mono text-[12px] font-medium text-slate-900 dark:text-white">{r.claim_id}</span>,
    },
    {
      key: "member", header: "Member", width: "90px",
      render: (r) => <span className="text-[13px] font-semibold text-slate-700 dark:text-slate-300">{r.patient_initials}</span>,
    },
    {
      key: "drug", header: "Drug",
      render: (r) => <span className="text-[13px] text-slate-700 dark:text-slate-300">{r.drug_name}</span>,
    },
    {
      key: "term_date", header: "Term Date", width: "110px",
      render: (r) => <span className="text-[12px] tabular-nums text-slate-600 dark:text-slate-400">{r.term_date}</span>,
    },
    {
      key: "claim_date", header: "Claim Date", width: "110px",
      render: (r) => <span className="text-[12px] tabular-nums text-slate-600 dark:text-slate-400">{r.claim_date}</span>,
    },
    {
      key: "days_after_term", header: "After Term", width: "100px",
      render: (r) => (
        <span className="text-[11px] px-2 py-0.5 rounded border font-semibold bg-red-50 text-red-700 border-red-200 tabular-nums dark:text-red-300 dark:bg-red-900/20">
          +{r.days_after_term}d
        </span>
      ),
    },
    {
      key: "paid_usd", header: "Paid", width: "100px", align: "right",
      render: (r) => <span className="font-bold tabular-nums text-[13px] text-slate-900 dark:text-white">{money(r.paid_usd)}</span>,
    },
    {
      key: "status", header: "Status", width: "160px",
      render: (r) => (
        <span
          className={clsx(
            "text-[11px] px-2 py-0.5 rounded border font-semibold",
            r.status === "recovery_initiated"
              ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:text-emerald-300 dark:bg-emerald-900/20"
              : "bg-slate-50 text-slate-600 border-slate-200 dark:text-slate-400"
          )}
        >
          {r.status === "recovery_initiated" ? "Recovery Initiated" : "Open"}
        </span>
      ),
    },
  ];

  const alreadyInitiated = selected?.status === "recovery_initiated";

  return (
    <div>
      <PageHeader
        title="Eligibility Leakage"
        subtitle="Claims paid after member termination · 834 feed lag turns into pure recoverable dollars."
        meta={<DataSourceList sources={["Kythera", "Internal"]} />}
      />

      <div className="mb-4">
        <StatRow
          items={[
            { label: "Termed Members", value: data.termed_members },
            { label: "Leaked Claims", value: data.leaked_claims, severity: "alert" },
            { label: "Leaked $", value: money(data.leaked_usd), severity: "alert" },
            { label: "Recovery Initiated $", value: money(data.recovery_initiated_usd || 0), severity: "ok" },
          ]}
        />
      </div>

      <DataTable
        columns={columns}
        rows={items}
        rowKey={(r) => r.claim_id}
        onRowClick={(r) => { setSelectedId(r.claim_id); setActionMsg(null); setActionErr(false); }}
        emptyMessage="No post-termination claims detected"
      />

      <DetailDrawer
        open={!!selected}
        onClose={closeDrawer}
        title={selected ? `Claim ${selected.claim_id}` : ""}
        subtitle={selected ? `${selected.drug_name} · Member ${selected.patient_initials} · paid ${selected.days_after_term} days after termination` : undefined}
        actions={selected && (
          <button
            onClick={initiateRecovery}
            disabled={posting || alreadyInitiated}
            title={
              alreadyInitiated
                ? "Chargeback recovery has already been initiated for this claim"
                : "Send NCPDP B2 reversal to the pharmacy and open a recoup case for the full paid amount"
            }
            className={clsx(
              "px-4 py-2 text-[14px] font-semibold rounded text-white inline-flex items-center gap-2",
              alreadyInitiated
                ? "bg-emerald-600 opacity-60 cursor-not-allowed"
                : posting
                  ? "bg-emerald-600 opacity-70 cursor-wait"
                  : "bg-emerald-600 hover:bg-emerald-700"
            )}
          >
            {alreadyInitiated ? (
              <><CheckCircle2 className="w-4 h-4" /> Recovery Initiated ✓</>
            ) : (
              <><Undo2 className="w-4 h-4" /> {posting ? "Initiating…" : "Initiate Chargeback Recovery"}</>
            )}
          </button>
        )}
      >
        {selected && (
          <>
            {actionMsg && (
              <div
                className={clsx(
                  "mb-5 rounded-md px-4 py-3 text-[13px] border",
                  actionErr
                    ? "bg-red-50 border-red-300 text-red-900 dark:bg-red-900/20 dark:text-red-200"
                    : "bg-emerald-50 border-emerald-300 text-emerald-900 dark:bg-emerald-900/20 dark:text-emerald-200"
                )}
              >
                {actionMsg}
              </div>
            )}

            <FieldGroup title="Claim">
              <Field label="Claim ID" value={selected.claim_id} mono />
              <Field label="Patient ID" value={selected.patient_id} mono />
              <Field label="Member Initials" value={selected.patient_initials} />
              <Field label="Drug" value={selected.drug_name} />
            </FieldGroup>

            <FieldGroup title="Eligibility">
              <Field label="Termination Date" value={selected.term_date} mono />
              <Field label="Claim Date" value={selected.claim_date} mono />
              <Field
                label="Days After Term"
                value={
                  <span className="text-[11px] px-2 py-0.5 rounded border font-semibold bg-red-50 text-red-700 border-red-200 tabular-nums dark:text-red-300 dark:bg-red-900/20">
                    +{selected.days_after_term}d
                  </span>
                }
              />
            </FieldGroup>

            <FieldGroup title="Financial">
              <Field label="Paid" value={money(selected.paid_usd)} mono />
              <Field label="Recoverable" value={money(selected.paid_usd)} mono />
              <Field
                label="Status"
                value={
                  <span
                    className={clsx(
                      "text-[11px] px-2 py-0.5 rounded border font-semibold",
                      alreadyInitiated
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:text-emerald-300 dark:bg-emerald-900/20"
                        : "bg-slate-50 text-slate-600 border-slate-200 dark:text-slate-400"
                    )}
                  >
                    {alreadyInitiated ? "Recovery Initiated" : "Open"}
                  </span>
                }
              />
            </FieldGroup>

            <FieldGroup title="Recovery Path">
              <ol className="text-[13px] text-slate-700 dark:text-slate-300 list-decimal list-inside space-y-1">
                <li>NCPDP B2 reversal transaction submitted to the dispensing pharmacy.</li>
                <li>Recoup letter issued to the pharmacy with a 30-day repayment window.</li>
                <li>If unpaid after the window, the amount is offset against future remittance.</li>
              </ol>
            </FieldGroup>
          </>
        )}
      </DetailDrawer>
    </div>
  );
}
