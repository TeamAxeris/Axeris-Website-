"use client";

import { useEffect, useState } from "react";
import { demoFetch, invalidate } from "@/lib/demoFetch";
import { DataTable, PageHeader, StatRow, Column } from "@/components/ui/DataTable";
import { DetailDrawer, FieldGroup, Field } from "@/components/ui/DetailDrawer";
import { DataSourceList } from "@/components/ui/DataSourceBadge";
import { TableSkeleton } from "@/components/ui/Skeleton";
import clsx from "clsx";
import { PbaSiteOfCareDumbbell } from "@/components/dashboard/PbaCharts";
import { Home, Building2 } from "lucide-react";

interface SiteOfCareItem {
  rx_id: string;
  patient_id: string;
  patient_initials: string;
  drug_name: string;
  brand_name: string | null;
  current_site: string;
  proposed_site: string;
  per_infusion_hopd_usd: number;
  per_infusion_home_usd: number;
  per_infusion_savings_usd: number;
  annualized_savings_usd: number;
  infusions_per_year: number;
  last_infusion: string | null;
  status: "eligible" | "redirected";
}

const fmtUsd = (n: number) => `$${Math.round(n).toLocaleString()}`;

export default function PBASiteOfCarePage() {
  const [data, setData] = useState<any>(null);
  const [selected, setSelected] = useState<SiteOfCareItem | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | "eligible" | "redirected">("all");
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [actionErr, setActionErr] = useState(false);
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    demoFetch("/api/v1/pba/site-of-care").then(setData).catch(() => {});
  }, []);

  if (!data) return <div className="p-6"><TableSkeleton rows={8} cols={7} /></div>;

  const summary = data.summary || {};

  const redirect = async () => {
    if (!selected || redirecting || selected.status === "redirected") return;
    setRedirecting(true);
    setActionErr(false);
    try {
      const res = await fetch(`/api/v1/pba/site-of-care/${selected.rx_id}/redirect`, { method: "POST" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      invalidate("/api/v1/pba/site-of-care");
      setData((d: any) => d ? {
        ...d,
        summary: {
          ...d.summary,
          redirected: (d.summary.redirected || 0) + 1,
          realized_savings_usd: Math.round(((d.summary.realized_savings_usd || 0) + selected.annualized_savings_usd) * 100) / 100,
        },
        items: d.items.map((i: SiteOfCareItem) => i.rx_id === selected.rx_id ? { ...i, status: "redirected" } : i),
      } : d);
      setSelected((s) => s ? { ...s, status: "redirected" } : s);
      setActionMsg(
        `Redirect recorded · ${fmtUsd(selected.annualized_savings_usd)}/yr moved to realized savings. ` +
        `Home-infusion nurse scheduling + prior-auth transfer queued via case management.`
      );
    } catch {
      setActionErr(true);
      setActionMsg("Could not reach the backend · redirect not recorded.");
    } finally {
      setRedirecting(false);
    }
  };

  const shown: SiteOfCareItem[] = statusFilter === "all"
    ? data.items
    : data.items.filter((i: SiteOfCareItem) => i.status === statusFilter);

  const eligibleCount = data.items.filter((i: SiteOfCareItem) => i.status === "eligible").length;
  const redirectedCount = data.items.filter((i: SiteOfCareItem) => i.status === "redirected").length;

  const columns: Column<SiteOfCareItem>[] = [
    { key: "member", header: "Member", width: "80px",
      render: (r) => <span className="font-mono text-[12px] text-slate-900 dark:text-white">{r.patient_initials}</span> },
    { key: "drug", header: "Specialty Infusion",
      render: (r) => (
        <div>
          <div className="text-[13px] font-semibold text-slate-900 dark:text-white">{r.drug_name}</div>
          {r.brand_name && <div className="text-[11px] text-slate-500 dark:text-slate-400">{r.brand_name}</div>}
        </div>
      )},
    { key: "site", header: "Current → Proposed",
      render: () => (
        <div className="flex items-center gap-1.5 text-[11px]">
          <span className="inline-flex items-center gap-1 text-slate-600 dark:text-slate-300">
            <Building2 className="w-3 h-3" /> Hospital Outpatient
          </span>
          <span className="text-slate-400 dark:text-slate-500">→</span>
          <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
            <Home className="w-3 h-3" /> Home / Office
          </span>
        </div>
      )},
    { key: "hopd", header: "Per-Infusion HOPD", width: "130px", align: "right",
      render: (r) => <span className="tabular-nums text-[12px] text-slate-700 dark:text-slate-300">{fmtUsd(r.per_infusion_hopd_usd)}</span> },
    { key: "home", header: "Per-Infusion Home", width: "130px", align: "right",
      render: (r) => <span className="tabular-nums text-[12px] text-slate-700 dark:text-slate-300">{fmtUsd(r.per_infusion_home_usd)}</span> },
    { key: "persave", header: "Savings / Infusion", width: "130px", align: "right",
      render: (r) => <span className="tabular-nums text-[12px] text-amber-700 dark:text-amber-400">{fmtUsd(r.per_infusion_savings_usd)}</span> },
    { key: "annual", header: "Annualized", width: "110px", align: "right",
      render: (r) => <span className="font-bold tabular-nums text-emerald-700 dark:text-emerald-400">{fmtUsd(r.annualized_savings_usd)}</span> },
    { key: "status", header: "Status", width: "100px",
      render: (r) => r.status === "redirected"
        ? <span className="text-[11px] px-2 py-0.5 rounded border font-semibold bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-700">Redirected</span>
        : <span className="text-[11px] px-2 py-0.5 rounded border font-semibold bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-600">Eligible</span> },
  ];

  const chips: { key: "all" | "eligible" | "redirected"; label: string }[] = [
    { key: "all", label: `All (${data.items.length})` },
    { key: "eligible", label: `Eligible (${eligibleCount})` },
    { key: "redirected", label: `Redirected (${redirectedCount})` },
  ];

  return (
    <div>
      <PageHeader
        title="Site-of-Care Optimization"
        subtitle="Specialty IV infusions billed at hospital outpatient (HOPD) cost ~110% more than home/office · same drug, matched outcomes (JMCP 2025, up to 57% employer savings)."
        meta={<DataSourceList sources={["Truveta", "NADAC", "Internal"]} />}
      />

      <div className="mb-3">
        <StatRow items={[
          { label: "Eligible Members", value: summary.eligible_members ?? 0, sub: "Clinic-infused biologics with ≥ $100 savings/infusion" },
          { label: "HOPD Premium", value: `${Math.round(summary.hopd_premium_pct ?? 0)}%`, sub: "Facility markup vs home/office", severity: "alert" },
          { label: "Annualized Savings", value: fmtUsd(summary.annualized_savings_usd ?? 0), sub: "All eligible + redirected", severity: "ok" },
          { label: "Avg / Member", value: fmtUsd(summary.avg_savings_per_member_usd ?? 0), sub: "Per redirected member / yr" },
          { label: "Redirected", value: summary.redirected ?? 0, sub: "Persisted to audit trail" },
        ]} />
      </div>

      <div className="mb-5"><PbaSiteOfCareDumbbell items={data.items} /></div>

      <div className="mb-3 flex items-center gap-2 flex-wrap">
        {chips.map((c) => (
          <button
            key={c.key}
            onClick={() => setStatusFilter(c.key)}
            title={`Show ${c.key === "all" ? "all members" : c.key} infusion episodes`}
            className={clsx(
              "text-[12px] px-2.5 py-1 rounded-full border font-medium transition-colors",
              statusFilter === c.key
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
        onRowClick={(r) => { setSelected(r); setActionMsg(null); setActionErr(false); }}
        emptyMessage="No infusion episodes in this category. Clinic-infused biologics billed at HOPD with ≥ $100 savings per infusion appear here."
      />

      <DetailDrawer
        open={!!selected}
        onClose={() => { setSelected(null); setActionMsg(null); setActionErr(false); }}
        title={selected ? selected.drug_name : ""}
        subtitle={selected ? `${selected.brand_name ? selected.brand_name + " · " : ""}Rx ${selected.rx_id} · ${selected.patient_initials}` : undefined}
        actions={selected && (
          <>
            <a
              href={`/patients/${selected.patient_id}`}
              title="Open this member's chart with full clinical and claim history"
              className="px-3 py-1.5 text-[13px] rounded border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300"
            >
              Open Member Chart
            </a>
            <button
              onClick={redirect}
              disabled={redirecting || selected.status === "redirected"}
              title="Redirect this infusion to home/office via case management · moves savings to realized"
              className="px-3 py-1.5 text-[13px] rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {selected.status === "redirected" ? "Redirected ✓" : redirecting ? "Recording…" : "Redirect to Home Infusion"}
            </button>
          </>
        )}
      >
        {selected && (
          <>
            {actionMsg && (
              <div className={clsx(
                "mb-5 rounded-md px-4 py-3 text-[13px] border",
                actionErr
                  ? "bg-red-50 border-red-300 text-red-900 dark:bg-red-900/20 dark:border-red-700 dark:text-red-200"
                  : "bg-emerald-50 border-emerald-300 text-emerald-900 dark:bg-emerald-900/20 dark:border-emerald-700 dark:text-emerald-200"
              )}>
                {actionMsg}
              </div>
            )}

            <FieldGroup title="Therapy">
              <Field label="Drug" value={selected.drug_name} />
              <Field label="Brand" value={selected.brand_name} />
              <Field label="Rx ID" value={selected.rx_id} mono />
              <Field label="Last Infusion" value={selected.last_infusion || "·"} />
              <Field label="Infusions / Year" value={selected.infusions_per_year} />
            </FieldGroup>

            <FieldGroup title="Site Economics">
              <Field label="Current Site" value={selected.current_site} />
              <Field label="Proposed Site" value={selected.proposed_site} />
              <Field label="Per-Infusion HOPD" value={fmtUsd(selected.per_infusion_hopd_usd)} />
              <Field label="Per-Infusion Home / Office" value={fmtUsd(selected.per_infusion_home_usd)} />
              <Field label="Savings per Infusion" value={fmtUsd(selected.per_infusion_savings_usd)} />
              <Field label="Annualized Savings" value={fmtUsd(selected.annualized_savings_usd)} />
            </FieldGroup>

            <FieldGroup title="Why Redirect">
              <ul className="text-[13px] text-slate-700 dark:text-slate-300 list-disc list-inside space-y-1">
                <li>Matched clinical outcomes at home/office vs hospital outpatient (JMCP 2025)</li>
                <li>Nurse-administered with the same safety monitoring and reaction protocols</li>
                <li>Member consent obtained + prior-authorization transferred to the new site</li>
                <li>HOPD facility fee is the main cost driver · the drug and dose are unchanged</li>
              </ul>
            </FieldGroup>
          </>
        )}
      </DetailDrawer>
    </div>
  );
}
