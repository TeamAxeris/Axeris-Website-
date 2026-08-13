"use client";

import { useEffect, useState } from "react";
import { demoFetch, invalidate } from "@/lib/demoFetch";
import { DataTable, PageHeader, StatRow, Column } from "@/components/ui/DataTable";
import { DetailDrawer, FieldGroup, Field } from "@/components/ui/DetailDrawer";
import { DataSourceList } from "@/components/ui/DataSourceBadge";
import { TableSkeleton } from "@/components/ui/Skeleton";
import clsx from "clsx";
import { Award, ExternalLink, ShieldCheck } from "lucide-react";

type FilterKey = "all" | "eligible" | "carded";

interface GoldCardItem {
  provider_id: string;
  provider_name: string;
  specialty: string;
  claims_reviewed: number;
  approval_rate_pct: number;
  pa_requests_annual: number;
  avg_turnaround_hours: number;
  gold_card_eligible: boolean;
  gold_carded: boolean;
  admin_hours_avoidable: number;
  admin_cost_avoidable_usd: number;
}

const GET_URL = "/api/v1/tpa/pa-gold-card";

const money = (n: number) => `$${Math.round(n || 0).toLocaleString()}`;

function rateColor(pct: number): { bar: string; text: string } {
  if (pct >= 90) return { bar: "bg-emerald-500", text: "text-emerald-700 dark:text-emerald-400" };
  if (pct >= 75) return { bar: "bg-amber-500", text: "text-amber-700 dark:text-amber-400" };
  return { bar: "bg-red-500", text: "text-red-700 dark:text-red-400" };
}

function StatusBadge({ item }: { item: GoldCardItem }) {
  if (item.gold_carded) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-semibold bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-700">
        <Award className="w-3 h-3" /> Carded
      </span>
    );
  }
  if (item.gold_card_eligible) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full border text-[11px] font-semibold bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300 dark:border-emerald-700">
        Eligible
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full border text-[11px] font-semibold bg-slate-100 text-slate-600 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600">
      Standard
    </span>
  );
}

export default function TPAPaGoldCardPage() {
  const [data, setData] = useState<any>(null);
  const [selected, setSelected] = useState<GoldCardItem | null>(null);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [posting, setPosting] = useState(false);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [actionErr, setActionErr] = useState(false);

  useEffect(() => {
    demoFetch(GET_URL).then(setData).catch(() => {});
  }, []);

  if (!data) return <div className="p-6"><TableSkeleton rows={8} cols={7} /></div>;

  const items: GoldCardItem[] = data.items || [];
  const s = data.summary || {};

  const chips: { key: FilterKey; label: string; count: number }[] = [
    { key: "all", label: "All", count: items.length },
    { key: "eligible", label: "Gold-Card Eligible", count: items.filter((i) => i.gold_card_eligible).length },
    { key: "carded", label: "Carded", count: items.filter((i) => i.gold_carded).length },
  ];

  const filtered =
    filter === "all"
      ? items
      : filter === "eligible"
      ? items.filter((i) => i.gold_card_eligible)
      : items.filter((i) => i.gold_carded);

  const issueGoldCard = async (item: GoldCardItem) => {
    setPosting(true);
    try {
      const res = await fetch(`/api/v1/tpa/pa-gold-card/${item.provider_id}/issue`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider_id: item.provider_id }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      invalidate(GET_URL);
      setData((d: any) =>
        d
          ? {
              ...d,
              summary: {
                ...d.summary,
                gold_carded: (d.summary?.gold_carded || 0) + 1,
                realized_hours_saved:
                  Math.round(((d.summary?.realized_hours_saved || 0) + (item.admin_hours_avoidable || 0)) * 10) / 10,
              },
              items: (d.items || []).map((x: GoldCardItem) =>
                x.provider_id === item.provider_id ? { ...x, gold_carded: true } : x
              ),
            }
          : d
      );
      setSelected((cur) =>
        cur && cur.provider_id === item.provider_id ? { ...cur, gold_carded: true } : cur
      );
      setActionErr(false);
      setActionMsg(
        `Gold card issued to ${item.provider_name}. PA requirements waived for 12 months · approximately ${item.pa_requests_annual} annual PA requests and ${item.admin_hours_avoidable} staff-hours avoided. Auto-revoke triggers on audit failure.`
      );
    } catch {
      setActionErr(true);
      setActionMsg("Gold card could not be issued · backend unreachable. Please try again.");
    } finally {
      setPosting(false);
    }
  };

  const columns: Column<GoldCardItem>[] = [
    {
      key: "prescriber",
      header: "Prescriber",
      render: (r) => (
        <div>
          <div className="font-semibold text-slate-900 dark:text-white">{r.provider_name}</div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400">{r.specialty}</div>
        </div>
      ),
    },
    {
      key: "claims",
      header: "Claims Reviewed",
      width: "110px",
      align: "right",
      render: (r) => <span className="tabular-nums text-[13px] text-slate-700 dark:text-slate-300">{r.claims_reviewed.toLocaleString()}</span>,
    },
    {
      key: "approval",
      header: "Approval Rate",
      width: "160px",
      render: (r) => {
        const c = rateColor(r.approval_rate_pct);
        return (
          <div>
            <div className={clsx("text-[13px] font-semibold tabular-nums", c.text)}>
              {r.approval_rate_pct.toFixed(1)}%
            </div>
            <div className="mt-1 h-1.5 w-full rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
              <div
                className={clsx("h-full rounded-full", c.bar)}
                style={{ width: `${Math.min(100, Math.max(0, r.approval_rate_pct))}%` }}
              />
            </div>
          </div>
        );
      },
    },
    {
      key: "pa_volume",
      header: "Annual PAs",
      width: "90px",
      align: "right",
      render: (r) => <span className="tabular-nums text-[13px] text-slate-700 dark:text-slate-300">{r.pa_requests_annual.toLocaleString()}</span>,
    },
    {
      key: "turnaround",
      header: "Avg Turnaround",
      width: "120px",
      align: "right",
      render: (r) =>
        r.avg_turnaround_hours > 168 ? (
          <span
            className="inline-flex items-center px-2 py-0.5 rounded-full border text-[11px] font-semibold tabular-nums bg-red-50 text-red-700 border-red-200 dark:bg-red-900/40 dark:text-red-300 dark:border-red-700"
            title="Exceeds the 7-day (168h) CMS-0057 decision window"
          >
            {r.avg_turnaround_hours.toFixed(0)}h
          </span>
        ) : (
          <span className="tabular-nums text-[13px] text-slate-700 dark:text-slate-300">{r.avg_turnaround_hours.toFixed(0)}h</span>
        ),
    },
    {
      key: "hours",
      header: "Hours Avoidable",
      width: "110px",
      align: "right",
      render: (r) => <span className="font-bold tabular-nums text-slate-900 dark:text-white">{r.admin_hours_avoidable.toFixed(1)}</span>,
    },
    {
      key: "status",
      header: "Status",
      width: "110px",
      render: (r) => <StatusBadge item={r} />,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Prior Auth & Gold Card"
        subtitle="PA turnaround performance and a gold-card program · prescribers with ≥90% approval rates earn a 12-month PA exemption (AMA 2025: 43 PAs/week, 16 staff-hours)."
        meta={<DataSourceList sources={["Truveta", "NPPES", "Internal"]} />}
      />

      <div className="mb-3">
        <StatRow
          items={[
            { label: "Eligible Prescribers", value: s.gold_card_eligible ?? "·", sub: `of ${s.prescribers_tracked ?? "·"} tracked · ≥90% approval`, severity: "ok" },
            { label: "Gold-Carded", value: s.gold_carded ?? 0, sub: "12-month PA exemption active" },
            { label: "Annual PAs Avoidable", value: (s.annual_pas_avoidable ?? 0).toLocaleString(), sub: "If all eligible prescribers carded" },
            { label: "Admin Hours Avoidable", value: (s.admin_hours_avoidable ?? 0).toLocaleString(), sub: `≈ ${money(s.admin_cost_avoidable_usd ?? 0)} staff cost` },
            { label: "CMS 7-Day Compliance", value: `${s.cms_7day_compliance_pct ?? 0}%`, sub: `p50 turnaround ${s.turnaround_p50_hours ?? "·"}h` },
          ]}
        />
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        {chips.map((c) => (
          <button
            key={c.key}
            onClick={() => setFilter(c.key)}
            title={`Show ${c.label.toLowerCase()} prescribers`}
            className={clsx(
              "px-3 py-1 rounded-full border text-[12px] font-medium transition-colors",
              filter === c.key
                ? "bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900 dark:border-white"
                : "bg-white text-slate-600 border-slate-300 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600 dark:hover:bg-slate-700"
            )}
          >
            {c.label} <span className="tabular-nums opacity-70">({c.count})</span>
          </button>
        ))}
      </div>

      <DataTable
        columns={columns}
        rows={filtered}
        rowKey={(r) => r.provider_id}
        onRowClick={(r) => { setSelected(r); setActionMsg(null); }}
        emptyMessage="No prescribers match this filter"
      />

      <DetailDrawer
        open={!!selected}
        onClose={() => { setSelected(null); setActionMsg(null); }}
        title={selected?.provider_name || ""}
        subtitle={selected ? `${selected.specialty} · ${selected.claims_reviewed.toLocaleString()} claims reviewed` : ""}
        actions={selected && (
          <>
            <a
              href={`/providers/${selected.provider_id}`}
              title="Open the full prescriber profile"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[13px] rounded border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700"
            >
              <ExternalLink className="w-3.5 h-3.5" /> View Prescriber
            </a>
            <button
              onClick={() => issueGoldCard(selected)}
              disabled={posting || !selected.gold_card_eligible || selected.gold_carded}
              title={
                selected.gold_carded
                  ? "Gold card already active for this prescriber"
                  : selected.gold_card_eligible
                  ? "Waive PA requirements for this prescriber for 12 months"
                  : "Requires a ≥90% PA approval rate to qualify"
              }
              className={clsx(
                "inline-flex items-center gap-1.5 px-3 py-1.5 text-[13px] rounded text-white",
                selected.gold_carded
                  ? "bg-amber-500 opacity-70 cursor-default"
                  : "bg-amber-500 hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed"
              )}
            >
              <Award className="w-3.5 h-3.5" />
              {selected.gold_carded ? "Gold Carded ✓" : posting ? "Issuing…" : "Issue Gold Card"}
            </button>
          </>
        )}
      >
        {selected && (
          <>
            {actionMsg && (
              <div
                className={clsx(
                  "mb-5 rounded-md px-4 py-3 text-[13px] border",
                  actionErr
                    ? "bg-red-50 border-red-300 text-red-900 dark:bg-red-900/30 dark:border-red-700 dark:text-red-200"
                    : "bg-emerald-50 border-emerald-300 text-emerald-900 dark:bg-emerald-900/20 dark:text-emerald-200"
                )}
              >
                {actionMsg}
              </div>
            )}

            <FieldGroup title="Prescriber">
              <Field label="Provider ID" value={selected.provider_id} mono />
              <Field label="Name" value={selected.provider_name} />
              <Field label="Specialty" value={selected.specialty} />
              <Field label="Status" value={selected.gold_carded ? "Gold Carded (12-month PA exemption)" : selected.gold_card_eligible ? "Gold-Card Eligible" : "Standard PA review"} />
            </FieldGroup>

            <FieldGroup title="PA Performance">
              <Field label="Claims Reviewed" value={selected.claims_reviewed.toLocaleString()} />
              <Field label="Approval Rate" value={`${selected.approval_rate_pct.toFixed(1)}% ${selected.approval_rate_pct >= 90 ? "(meets ≥90% gold-card threshold)" : "(below 90% threshold)"}`} />
              <Field label="Annual PA Volume" value={selected.pa_requests_annual.toLocaleString()} />
              <Field label="Avg Turnaround" value={`${selected.avg_turnaround_hours.toFixed(0)}h ${selected.avg_turnaround_hours > 168 ? "· exceeds CMS 7-day window" : "· within CMS 7-day window"}`} />
            </FieldGroup>

            <FieldGroup title="Burden">
              <Field label="Admin Hours Avoidable" value={`${selected.admin_hours_avoidable.toFixed(1)} staff-hours / year`} />
              <Field label="Admin Cost Avoidable" value={money(selected.admin_cost_avoidable_usd)} />
              <div className="mt-2 text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                Basis: AMA 2025 prior-authorization survey · physician practices complete an average of 43
                PAs per physician per week, consuming about 16 staff-hours. Avoidable burden here scales
                that benchmark by this prescriber&rsquo;s annual PA volume.
              </div>
            </FieldGroup>

            <div className="mt-4 rounded-md border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 px-4 py-3">
              <div className="flex items-center gap-1.5 text-[12px] font-semibold text-amber-900 dark:text-amber-300 mb-1.5">
                <ShieldCheck className="w-3.5 h-3.5" /> How gold-carding works
              </div>
              <ul className="text-[12px] text-amber-900/90 dark:text-amber-200/90 leading-relaxed list-disc pl-4 space-y-1">
                <li>Prescribers with a &ge;90% PA approval rate earn a <strong>12-month exemption</strong> from prior-authorization requirements.</li>
                <li>Exemptions <strong>auto-revoke on audit failure</strong> · periodic claim sampling continues during the exemption window.</li>
                <li>Precedent: Texas HB 3459 gold-card law, plus UnitedHealthcare and Humana national gold-card programs.</li>
                <li><strong>CMS-0057-F</strong> requires payers to decide standard PA requests within <strong>&le;7 days</strong> by 2026 · gold-carding reduces the queue that must meet that clock.</li>
              </ul>
            </div>
          </>
        )}
      </DetailDrawer>
    </div>
  );
}
