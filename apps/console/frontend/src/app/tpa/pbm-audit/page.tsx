"use client";

import { useEffect, useState, type MouseEvent } from "react";
import { demoFetch, invalidate } from "@/lib/demoFetch";
import { DataTable, PageHeader, StatRow, Column } from "@/components/ui/DataTable";
import { DetailDrawer, FieldGroup, Field } from "@/components/ui/DetailDrawer";
import { DataSourceList } from "@/components/ui/DataSourceBadge";
import { TableSkeleton } from "@/components/ui/Skeleton";
import clsx from "clsx";
import { FileWarning, Check, ExternalLink } from "lucide-react";
import { InsightPanel, RankedBars, StackedOutcome } from "@/components/dashboard/InsightCharts";

interface SpreadItem {
  claim_id: string;
  rx_id: string;
  drug_name: string;
  brand_name: string;
  pharmacy_name: string;
  allowed_usd: number;
  benchmark_usd: number;
  spread_usd: number;
  spread_pct: number;
  claim_date: string;
  status: "open" | "disputed";
}

interface PharmacySpread {
  pharmacy: string;
  claims: number;
  spread_usd: number;
}

interface RebateItem {
  employer_id: string;
  employer_name: string;
  quarter: string;
  brand_scripts: number;
  guaranteed_usd: number;
  received_usd: number;
  gap_usd: number;
  gap_pct: number;
}

interface FeeItem {
  employer_id: string;
  employer_name: string;
  service: string;
  pmpm_usd: number;
  annual_usd: number;
  disclosed: boolean;
  disclosure_requested: boolean;
}

const GET_URL = "/api/v1/tpa/pbm-audit";

const usd = (n: number) => `$${Math.round(n).toLocaleString()}`;
const usdM = (n: number) => `$${(n / 1_000_000).toFixed(1)}M`;

export default function TPAPbmAuditPage() {
  const [data, setData] = useState<any>(null);
  const [section, setSection] = useState<"spread" | "rebates" | "fees">("spread");
  const [selected, setSelected] = useState<SpreadItem | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [actionErr, setActionErr] = useState(false);
  const [posting, setPosting] = useState(false);
  const [feeMsg, setFeeMsg] = useState<string | null>(null);
  const [feeErr, setFeeErr] = useState(false);
  const [feePosting, setFeePosting] = useState<string | null>(null);

  useEffect(() => {
    demoFetch(GET_URL).then(setData).catch(() => {});
  }, []);

  if (!data) return <div className="p-6"><TableSkeleton rows={8} cols={7} /></div>;

  const spreadItems: SpreadItem[] = data.spread?.items ?? [];
  const rebateItems: RebateItem[] = data.rebates?.items ?? [];
  const feeItems: FeeItem[] = data.fees?.items ?? [];
  const byPharmacy: PharmacySpread[] = data.spread?.by_pharmacy ?? [];
  const flaggedCount: number = data.spread?.flagged_claims ?? spreadItems.length;
  const disputedCount: number =
    data.spread?.disputed_claims ?? spreadItems.filter((i) => i.status === "disputed").length;

  const openFinding = async (row: SpreadItem) => {
    if (posting || row.status === "disputed") return;
    setPosting(true);
    setActionMsg(null);
    setActionErr(false);
    try {
      const res = await fetch(`/api/v1/tpa/pbm-audit/${row.claim_id}/open-finding`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ claim_id: row.claim_id, rx_id: row.rx_id }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      invalidate(GET_URL);
      setData((prev: any) =>
        prev
          ? {
              ...prev,
              spread: {
                ...prev.spread,
                disputed_claims: (prev.spread?.disputed_claims ?? 0) + 1,
                items: (prev.spread?.items ?? []).map((it: SpreadItem) =>
                  it.claim_id === row.claim_id ? { ...it, status: "disputed" as const } : it
                ),
              },
            }
          : prev
      );
      setSelected((s) => (s && s.claim_id === row.claim_id ? { ...s, status: "disputed" } : s));
      setActionMsg(
        `Audit finding opened for ${row.claim_id} (${usd(row.spread_usd)} spread vs NADAC benchmark). PBM response due in 30 days per ASA §7.2.`
      );
    } catch {
      setActionErr(true);
      setActionMsg(`Failed to open audit finding for ${row.claim_id}. Backend unreachable · try again.`);
    } finally {
      setPosting(false);
    }
  };

  const demandDisclosure = async (row: FeeItem, e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (feePosting || row.disclosure_requested) return;
    setFeePosting(row.employer_id);
    setFeeMsg(null);
    setFeeErr(false);
    try {
      const res = await fetch(`/api/v1/tpa/pbm-audit/${row.employer_id}/request-fee-disclosure`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employer_id: row.employer_id }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      invalidate(GET_URL);
      setData((prev: any) =>
        prev
          ? {
              ...prev,
              fees: {
                ...prev.fees,
                items: (prev.fees?.items ?? []).map((it: FeeItem) =>
                  it.employer_id === row.employer_id ? { ...it, disclosure_requested: true } : it
                ),
              },
            }
          : prev
      );
      setFeeMsg(
        `Fee disclosure demanded from PBM for ${row.employer_name}, citing proposed rule FR 2026-01907 and ERISA §408(b)(2). Written fee schedule due in 30 days.`
      );
    } catch {
      setFeeErr(true);
      setFeeMsg(`Failed to demand fee disclosure for ${row.employer_name}. Backend unreachable · try again.`);
    } finally {
      setFeePosting(null);
    }
  };

  const statusBadge = (s: SpreadItem["status"]) => (
    <span
      className={clsx(
        "text-[11px] px-2 py-0.5 rounded border font-semibold",
        s === "disputed"
          ? "bg-red-50 text-red-700 border-red-200 dark:text-red-300 dark:bg-red-900/20"
          : "bg-amber-50 text-amber-700 border-amber-200 dark:text-amber-300 dark:bg-amber-900/20"
      )}
    >
      {s === "disputed" ? "Disputed" : "Open"}
    </span>
  );

  const spreadColumns: Column<SpreadItem>[] = [
    {
      key: "claim",
      header: "Claim",
      width: "120px",
      render: (r) => <span className="font-mono text-[12px] text-slate-900 dark:text-white">{r.claim_id}</span>,
    },
    {
      key: "drug",
      header: "Drug",
      render: (r) => (
        <div>
          <div className="text-[13px] font-medium text-slate-900 dark:text-white">{r.drug_name}</div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400">{r.brand_name}</div>
        </div>
      ),
    },
    {
      key: "pharmacy",
      header: "Pharmacy",
      render: (r) => <span className="text-[13px] text-slate-700 dark:text-slate-300">{r.pharmacy_name}</span>,
    },
    {
      key: "allowed",
      header: "Allowed",
      width: "100px",
      align: "right",
      render: (r) => <span className="text-[13px] tabular-nums">{usd(r.allowed_usd)}</span>,
    },
    {
      key: "benchmark",
      header: "Benchmark",
      width: "100px",
      align: "right",
      render: (r) => <span className="text-[13px] tabular-nums text-slate-600 dark:text-slate-400">{usd(r.benchmark_usd)}</span>,
    },
    {
      key: "spread",
      header: "Spread $",
      width: "100px",
      align: "right",
      render: (r) => <span className="text-[13px] tabular-nums font-bold text-red-600 dark:text-red-400">{usd(r.spread_usd)}</span>,
    },
    {
      key: "spread_pct",
      header: "Spread %",
      width: "90px",
      align: "right",
      render: (r) => <span className="text-[12px] tabular-nums text-slate-600 dark:text-slate-400">{Number(r.spread_pct).toFixed(1)}%</span>,
    },
    {
      key: "status",
      header: "Status",
      width: "100px",
      render: (r) => statusBadge(r.status),
    },
  ];

  const rebateColumns: Column<RebateItem>[] = [
    {
      key: "employer",
      header: "Employer",
      render: (r) => (
        <div>
          <div className="text-[13px] font-medium text-slate-900 dark:text-white">{r.employer_name}</div>
          <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400">{r.employer_id}</div>
        </div>
      ),
    },
    {
      key: "quarter",
      header: "Quarter",
      width: "90px",
      render: (r) => <span className="font-mono text-[12px] text-slate-700 dark:text-slate-300">{r.quarter}</span>,
    },
    {
      key: "scripts",
      header: "Brand Scripts",
      width: "110px",
      align: "right",
      render: (r) => <span className="text-[13px] tabular-nums">{r.brand_scripts.toLocaleString()}</span>,
    },
    {
      key: "guaranteed",
      header: "Guaranteed",
      width: "110px",
      align: "right",
      render: (r) => <span className="text-[13px] tabular-nums">{usd(r.guaranteed_usd)}</span>,
    },
    {
      key: "received",
      header: "Received",
      width: "110px",
      align: "right",
      render: (r) => <span className="text-[13px] tabular-nums text-slate-600 dark:text-slate-400">{usd(r.received_usd)}</span>,
    },
    {
      key: "gap",
      header: "Gap $",
      width: "100px",
      align: "right",
      render: (r) => <span className="text-[13px] tabular-nums font-bold text-red-600 dark:text-red-400">{usd(r.gap_usd)}</span>,
    },
    {
      key: "gap_pct",
      header: "Gap %",
      width: "80px",
      align: "right",
      render: (r) => <span className="text-[12px] tabular-nums text-slate-600 dark:text-slate-400">{Number(r.gap_pct).toFixed(1)}%</span>,
    },
  ];

  const disclosedBadge = (d: boolean) => (
    <span
      className={clsx(
        "text-[11px] px-2 py-0.5 rounded border font-semibold inline-flex items-center gap-1",
        d
          ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800"
          : "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800"
      )}
    >
      {d ? (
        <>
          <Check className="w-3 h-3" /> Disclosed
        </>
      ) : (
        "Undisclosed"
      )}
    </span>
  );

  const feeColumns: Column<FeeItem>[] = [
    {
      key: "employer",
      header: "Employer",
      render: (r) => (
        <div>
          <div className="text-[13px] font-medium text-slate-900 dark:text-white">{r.employer_name}</div>
          <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400">{r.employer_id}</div>
        </div>
      ),
    },
    {
      key: "service",
      header: "Service",
      render: (r) => <span className="text-[13px] text-slate-700 dark:text-slate-300">{r.service}</span>,
    },
    {
      key: "pmpm",
      header: "PMPM $",
      width: "90px",
      align: "right",
      render: (r) => <span className="text-[13px] tabular-nums">${Number(r.pmpm_usd).toFixed(2)}</span>,
    },
    {
      key: "annual",
      header: "Annual $",
      width: "110px",
      align: "right",
      render: (r) => (
        <span className="text-[13px] tabular-nums font-bold text-slate-900 dark:text-white">{usd(r.annual_usd)}</span>
      ),
    },
    {
      key: "disclosed",
      header: "Disclosed",
      width: "120px",
      render: (r) => disclosedBadge(r.disclosed),
    },
    {
      key: "action",
      header: "",
      width: "160px",
      align: "right",
      render: (r) =>
        r.disclosed ? null : (
          <button
            onClick={(e) => demandDisclosure(r, e)}
            disabled={r.disclosure_requested || feePosting === r.employer_id}
            title={
              r.disclosure_requested
                ? "Fee disclosure already demanded for this employer"
                : "Send a formal fee disclosure demand to the PBM citing FR 2026-01907 and ERISA §408(b)(2)"
            }
            className={clsx(
              "text-[11px] px-2 py-1 rounded border font-semibold transition-colors",
              r.disclosure_requested
                ? "border-emerald-300 text-emerald-700 dark:border-emerald-700 dark:text-emerald-400 cursor-default"
                : "border-red-300 text-red-700 dark:border-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-60 disabled:cursor-not-allowed"
            )}
          >
            {r.disclosure_requested
              ? "Demanded ✓"
              : feePosting === r.employer_id
              ? "Demanding…"
              : "Demand Disclosure"}
          </button>
        ),
    },
  ];

  const chipBase = "text-[12px] px-2.5 py-1 rounded-full border font-medium transition-colors";
  const chipActive = "bg-blue-600 text-white border-blue-600";
  const chipInactive =
    "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-600 hover:border-blue-400";

  const drawerRow = selected;
  const alreadyDisputed = drawerRow?.status === "disputed";

  return (
    <div>
      <PageHeader
        title="Spread & Rebates Audit"
        subtitle="Independent audit of PBM pricing: per-claim spread vs acquisition benchmark, and rebate guarantees vs pass-through."
        meta={<DataSourceList sources={["NADAC", "Kythera", "Truveta"]} />}
      />

      <div className="mb-4">
        <StatRow
          items={[
            {
              label: "Spread Identified",
              value: usd(data.spread?.total_spread_usd ?? 0),
              sub: data.spread?.pct_of_allowed != null ? `${Number(data.spread.pct_of_allowed).toFixed(1)}% of allowed` : undefined,
              severity: "alert",
            },
            { label: "Flagged Claims", value: flaggedCount, sub: "allowed above benchmark" },
            {
              label: "Rebate Gap",
              value: usd(data.rebates?.total_gap_usd ?? 0),
              sub: data.rebates?.guarantee_per_brand_script_usd != null
                ? `$${data.rebates.guarantee_per_brand_script_usd}/brand script guaranteed`
                : undefined,
              severity: "alert",
            },
            { label: "Disputed", value: disputedCount, sub: "audit findings open", severity: disputedCount > 0 ? "warn" : "ok" },
            {
              label: "Undisclosed Fees / yr",
              value: usdM(data.fees?.undisclosed_annual_usd ?? 0),
              sub: data.fees?.services_tracked != null ? `${data.fees.services_tracked} service categories tracked` : undefined,
              severity: "alert",
            },
          ]}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4 mb-5">
        <InsightPanel title="Spread concentration by pharmacy" description="The chart replaces a wall of pharmacy labels and makes the few dominant pricing gaps immediately visible." className="xl:col-span-3">
          <RankedBars data={byPharmacy.slice(0, 8).map((row) => ({ label: row.pharmacy, value: row.spread_usd, note: `${row.claims} flagged claims` }))} valueFormatter={usd} height={280} color="#dc4b45" />
        </InsightPanel>
        <InsightPanel title="Audit exposure" description="Three contract levers, shown on one comparable annual-dollar scale." className="xl:col-span-2">
          <RankedBars data={[
            { label: "Undisclosed fees", value: data.fees?.undisclosed_annual_usd || 0, color: "#7654d6" },
            { label: "Rebate gap", value: data.rebates?.total_gap_usd || 0, color: "#c98a12" },
            { label: "Pricing spread", value: data.spread?.total_spread_usd || 0, color: "#dc4b45" },
          ]} valueFormatter={usd} height={190} />
          <div className="mt-3"><StackedOutcome segments={[
            { label: "Open", value: Math.max(0, flaggedCount - disputedCount), color: "#dc4b45" },
            { label: "Disputed", value: disputedCount, color: "#c98a12" },
            { label: "Resolved", value: 0, color: "#0f8f69" },
          ]} /></div>
        </InsightPanel>
      </div>

      <div className="flex items-center gap-2 mb-4">
        <button
          title="Show per-claim spread pricing audit"
          onClick={() => setSection("spread")}
          className={clsx(chipBase, section === "spread" ? chipActive : chipInactive)}
        >
          Spread Pricing ({flaggedCount})
        </button>
        <button
          title="Show rebate guarantee reconciliation by employer and quarter"
          onClick={() => setSection("rebates")}
          className={clsx(chipBase, section === "rebates" ? chipActive : chipInactive)}
        >
          Rebate Reconciliation
        </button>
        <button
          title="Show PBM administrative fee disclosure audit by employer and service"
          onClick={() => setSection("fees")}
          className={clsx(chipBase, section === "fees" ? chipActive : chipInactive)}
        >
          Fee Disclosure
        </button>
      </div>

      {section === "spread" && (
        <div>
          <div className="flex items-end justify-between mb-3"><div><h2 className="text-[15px] font-semibold text-slate-900 dark:text-white">Claims behind the spread</h2><p className="text-[11.5px] text-slate-500 mt-0.5">Prioritized by recoverable dollars; open a row to create an audit finding.</p></div><span className="text-[11px] text-slate-400">{spreadItems.length} claims</span></div>
          <DataTable
            columns={spreadColumns}
            rows={spreadItems}
            rowKey={(r) => r.claim_id}
            onRowClick={(r) => {
              setSelected(r);
              setActionMsg(null);
              setActionErr(false);
            }}
            emptyMessage="No spread-flagged claims"
          />
        </div>
      )}

      {section === "rebates" && (
        <div>
          <InsightPanel title="Rebate gap by plan sponsor" description="Guaranteed value not passed through, ranked by employer." className="mb-4">
            <RankedBars data={Object.values(rebateItems.reduce((acc, row) => { const current = acc[row.employer_name] || { label: row.employer_name, value: 0 }; current.value += row.gap_usd; acc[row.employer_name] = current; return acc; }, {} as Record<string, { label: string; value: number }>))} valueFormatter={usd} height={260} color="#c98a12" />
          </InsightPanel>
          <DataTable
            columns={rebateColumns}
            rows={rebateItems}
            rowKey={(r) => `${r.employer_id}-${r.quarter}`}
            emptyMessage="No rebate reconciliation gaps"
          />
        </div>
      )}

      {section === "fees" && (
        <div>
          <InsightPanel title="Undisclosed fees by service" description="Annual compensation that needs a disclosure or contract response." className="mb-4">
            <RankedBars data={Object.values(feeItems.filter((row) => !row.disclosed).reduce((acc, row) => { const current = acc[row.service] || { label: row.service, value: 0 }; current.value += row.annual_usd; acc[row.service] = current; return acc; }, {} as Record<string, { label: string; value: number }>))} valueFormatter={usd} height={230} color="#7654d6" />
          </InsightPanel>

          {feeMsg && (
            <div
              className={clsx(
                "mb-4 rounded-md px-4 py-3 text-[13px]",
                feeErr
                  ? "bg-red-50 border border-red-300 text-red-900 dark:bg-red-900/20 dark:border-red-800 dark:text-red-200"
                  : "bg-emerald-50 border border-emerald-300 text-emerald-900 dark:bg-emerald-900/20 dark:border-emerald-800 dark:text-emerald-200"
              )}
            >
              {feeMsg}
            </div>
          )}

          <DataTable
            columns={feeColumns}
            rows={feeItems}
            rowKey={(r) => `${r.employer_id}-${r.service}`}
            emptyMessage="No PBM fees tracked"
          />
        </div>
      )}

      <DetailDrawer
        open={!!drawerRow}
        onClose={() => {
          setSelected(null);
          setActionMsg(null);
          setActionErr(false);
        }}
        title={drawerRow ? `Spread Finding · ${drawerRow.claim_id}` : ""}
        subtitle={drawerRow ? `${drawerRow.drug_name} (${drawerRow.brand_name}) · ${drawerRow.pharmacy_name}` : undefined}
        actions={
          drawerRow && (
            <>
              <a
                href={`/prescriptions/${drawerRow.rx_id}`}
                title="Open the full claim record in the prescriptions workspace"
                className="px-4 py-2 text-[14px] font-semibold rounded border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 inline-flex items-center gap-1.5"
              >
                <ExternalLink className="w-4 h-4" /> Open Full Claim
              </a>
              <button
                onClick={() => openFinding(drawerRow)}
                disabled={posting || alreadyDisputed}
                title={
                  alreadyDisputed
                    ? "Audit finding already opened for this claim"
                    : "Open a formal audit finding against the PBM for this claim's pricing spread"
                }
                className={clsx(
                  "px-4 py-2 text-[14px] font-semibold rounded inline-flex items-center gap-1.5",
                  alreadyDisputed
                    ? "bg-emerald-600 text-white cursor-default"
                    : "bg-red-600 text-white hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed"
                )}
              >
                {alreadyDisputed ? (
                  <>
                    <Check className="w-4 h-4" /> Finding Opened
                  </>
                ) : (
                  <>
                    <FileWarning className="w-4 h-4" /> {posting ? "Opening…" : "Open Audit Finding"}
                  </>
                )}
              </button>
            </>
          )
        }
      >
        {drawerRow && (
          <>
            {actionMsg && (
              <div
                className={clsx(
                  "mb-5 rounded-md px-4 py-3 text-[13px]",
                  actionErr
                    ? "bg-red-50 border border-red-300 text-red-900 dark:bg-red-900/20 dark:text-red-200"
                    : "bg-emerald-50 border border-emerald-300 text-emerald-900 dark:bg-emerald-900/20 dark:text-emerald-200"
                )}
              >
                {actionMsg}
              </div>
            )}

            <FieldGroup title="Claim">
              <Field label="Claim ID" value={drawerRow.claim_id} mono />
              <Field label="Rx ID" value={drawerRow.rx_id} mono />
              <Field label="Claim Date" value={drawerRow.claim_date} mono />
              <Field label="Status" value={statusBadge(drawerRow.status)} />
            </FieldGroup>

            <FieldGroup title="Pricing">
              <Field label="Allowed (PBM invoiced)" value={usd(drawerRow.allowed_usd)} mono />
              <Field label="Benchmark (NADAC acquisition)" value={usd(drawerRow.benchmark_usd)} mono />
              <Field
                label="Spread"
                value={<span className="font-bold text-red-600 dark:text-red-400">{usd(drawerRow.spread_usd)}</span>}
                mono
              />
              <Field label="Spread %" value={`${Number(drawerRow.spread_pct).toFixed(1)}%`} mono />
            </FieldGroup>

            <FieldGroup title="Pharmacy">
              <Field label="Pharmacy" value={drawerRow.pharmacy_name} />
              <Field label="Drug" value={`${drawerRow.drug_name} (${drawerRow.brand_name})`} />
            </FieldGroup>
          </>
        )}
      </DetailDrawer>
    </div>
  );
}
