"use client";

import { useEffect, useState } from "react";
import { demoFetch, invalidate } from "@/lib/demoFetch";
import { DataTable, PageHeader, StatRow, Column } from "@/components/ui/DataTable";
import { DetailDrawer, FieldGroup, Field } from "@/components/ui/DetailDrawer";
import { DataSourceList } from "@/components/ui/DataSourceBadge";
import { TableSkeleton } from "@/components/ui/Skeleton";
import clsx from "clsx";
import { BellRing, CheckCircle2, ExternalLink } from "lucide-react";

const GET_URL = "/api/v1/tpa/high-cost-forecast";

type Tier = "breach_projected" | "watch" | "monitor";
type TierFilter = "all" | Tier;

interface ForecastItem {
  patient_id: string;
  patient_initials: string;
  trailing_spend_usd: number;
  monthly_run_rate_usd: number;
  specialty_share_pct: number;
  projected_12mo_usd: number;
  pct_of_deductible: number;
  tier: Tier;
  top_cost_driver: string;
  stoploss_notified: boolean;
}

const TIER_META: Record<Tier, { label: string; cls: string }> = {
  breach_projected: {
    label: "Breach",
    cls: "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800",
  },
  watch: {
    label: "Watch",
    cls: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800",
  },
  monitor: {
    label: "Monitor",
    cls: "bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600",
  },
};

function money(n: number): string {
  return "$" + Math.round(n).toLocaleString();
}

function TierBadge({ tier }: { tier: Tier }) {
  const meta = TIER_META[tier] ?? TIER_META.monitor;
  return (
    <span className={clsx("text-[11px] px-2 py-0.5 rounded border font-semibold", meta.cls)}>
      {meta.label}
    </span>
  );
}

function DeductibleBar({ pct }: { pct: number }) {
  const barColor = pct >= 100 ? "bg-red-500" : pct >= 60 ? "bg-amber-500" : "bg-emerald-500";
  return (
    <div className="flex items-center gap-2">
      <div className="w-24 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
        <div className={clsx("h-full rounded-full", barColor)} style={{ width: Math.min(100, pct) + "%" }} />
      </div>
      <span className="text-[12px] tabular-nums text-slate-600 dark:text-slate-300">{Math.round(pct)}%</span>
    </div>
  );
}

export default function HighCostForecastPage() {
  const [data, setData] = useState<any>(null);
  const [tierFilter, setTierFilter] = useState<TierFilter>("all");
  const [selected, setSelected] = useState<ForecastItem | null>(null);
  const [posting, setPosting] = useState(false);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [actionOk, setActionOk] = useState(true);

  useEffect(() => {
    demoFetch(GET_URL).then(setData).catch(() => {});
  }, []);

  if (!data) return <div className="p-6"><TableSkeleton rows={8} cols={7} /></div>;

  const items: ForecastItem[] = data.items || [];
  const deductible: number = data.stop_loss_deductible_usd ?? 75000;
  const counts: Record<TierFilter, number> = {
    all: items.length,
    breach_projected: items.filter((i) => i.tier === "breach_projected").length,
    watch: items.filter((i) => i.tier === "watch").length,
    monitor: items.filter((i) => i.tier === "monitor").length,
  };
  const filtered = tierFilter === "all" ? items : items.filter((i) => i.tier === tierFilter);

  const openRow = (row: ForecastItem) => {
    setActionMsg(null);
    setActionOk(true);
    setSelected(row);
  };

  const notifyStopLoss = async (item: ForecastItem) => {
    setPosting(true);
    try {
      const res = await fetch(`/api/v1/tpa/high-cost-forecast/${item.patient_id}/notify-stoploss`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patient_id: item.patient_id }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      invalidate(GET_URL);
      setData((prev: any) =>
        prev
          ? {
              ...prev,
              items: (prev.items || []).map((r: ForecastItem) =>
                r.patient_id === item.patient_id ? { ...r, stoploss_notified: true } : r
              ),
            }
          : prev
      );
      setSelected((prev) =>
        prev && prev.patient_id === item.patient_id ? { ...prev, stoploss_notified: true } : prev
      );
      setActionOk(true);
      setActionMsg(
        `Stop-loss notice filed for member ${item.patient_initials} · carrier notified at ` +
          `${Math.round(item.pct_of_deductible)}% of the ${money(deductible)} specific deductible.`
      );
    } catch {
      setActionOk(false);
      setActionMsg("Failed to file stop-loss notice · the backend did not accept the request. Please retry.");
    } finally {
      setPosting(false);
    }
  };

  const columns: Column<ForecastItem>[] = [
    {
      key: "member",
      header: "Member",
      render: (r) => <span className="font-mono text-[12.5px] font-semibold">{r.patient_initials}</span>,
    },
    {
      key: "trailing",
      header: "Trailing Spend",
      align: "right",
      render: (r) => <span className="tabular-nums">{money(r.trailing_spend_usd)}</span>,
    },
    {
      key: "run_rate",
      header: "Monthly Run Rate",
      align: "right",
      render: (r) => <span className="tabular-nums">{money(r.monthly_run_rate_usd)}</span>,
    },
    {
      key: "specialty",
      header: "Specialty Share",
      align: "right",
      render: (r) => <span className="tabular-nums">{Math.round(r.specialty_share_pct)}%</span>,
    },
    {
      key: "projected",
      header: "Projected 12-Mo",
      align: "right",
      render: (r) => <span className="tabular-nums font-bold">{money(r.projected_12mo_usd)}</span>,
    },
    {
      key: "pct_deductible",
      header: "% of Deductible",
      width: "160px",
      render: (r) => <DeductibleBar pct={r.pct_of_deductible} />,
    },
    {
      key: "tier",
      header: "Tier",
      render: (r) => <TierBadge tier={r.tier} />,
    },
    {
      key: "driver",
      header: "Top Cost Driver",
      render: (r) => <span className="text-[13px]">{r.top_cost_driver}</span>,
    },
    {
      key: "notified",
      header: "Notified",
      render: (r) =>
        r.stoploss_notified ? (
          <span
            title="50% stop-loss notice filed with the carrier"
            className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded border font-semibold bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800"
          >
            <CheckCircle2 className="w-3 h-3" /> Filed
          </span>
        ) : (
          <span
            title="No stop-loss notice on file for this member"
            className="text-[11px] px-2 py-0.5 rounded border font-semibold bg-slate-50 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-600"
          >
            Not filed
          </span>
        ),
    },
  ];

  const chips: { key: TierFilter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "breach_projected", label: "Breach" },
    { key: "watch", label: "Watch" },
    { key: "monitor", label: "Monitor" },
  ];

  return (
    <div className="p-6">
      <PageHeader
        title="Stop-Loss Forecast"
        subtitle="High-cost claimant early warning · projected member drug spend vs the $75k specific deductible, before the carrier lasers you at renewal."
        meta={<DataSourceList sources={["Truveta", "Kythera", "Internal"]} />}
      />

      <div className="mb-5">
        <StatRow
          items={[
            { label: "Breach Projected", value: data.breach_projected ?? 0, sub: "projected ≥100% of deductible", severity: "alert" },
            { label: "Watch", value: data.watch ?? 0, sub: "trending toward deductible", severity: "warn" },
            { label: "Monitor", value: data.monitor ?? 0, sub: "elevated but contained" },
            { label: "Projected Exposure", value: money(data.projected_exposure_usd ?? 0), sub: "spend above deductible", severity: "alert" },
            { label: "Specific Deductible", value: money(deductible), sub: "per-member stop-loss attachment" },
          ]}
        />
      </div>

      <div className="flex items-center gap-2 mb-4">
        {chips.map((c) => (
          <button
            key={c.key}
            onClick={() => setTierFilter(c.key)}
            title={`Show ${c.label.toLowerCase() === "all" ? "all members" : c.label + " tier members"} (${counts[c.key]})`}
            className={clsx(
              "text-[12px] px-2.5 py-1 rounded-full border font-medium transition-colors",
              tierFilter === c.key
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-600 hover:border-blue-400"
            )}
          >
            {c.label} <span className="tabular-nums">({counts[c.key]})</span>
          </button>
        ))}
      </div>

      <DataTable<ForecastItem>
        columns={columns}
        rows={filtered}
        rowKey={(r) => r.patient_id}
        onRowClick={openRow}
        emptyMessage="No members in this tier."
      />

      <DetailDrawer
        open={selected !== null}
        onClose={() => setSelected(null)}
        title={selected ? `Member ${selected.patient_initials}` : ""}
        subtitle={selected ? `Stop-loss trajectory · ${TIER_META[selected.tier]?.label ?? "Monitor"} tier` : undefined}
        actions={
          selected && (
            <>
              <a
                href={`/patients/${selected.patient_id}`}
                title="Open the full member chart for this patient"
                className="inline-flex items-center gap-1.5 text-[13px] px-3.5 py-2 rounded-md border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 hover:border-blue-400 font-medium transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" /> Open Member Chart
              </a>
              <button
                onClick={() => notifyStopLoss(selected)}
                disabled={posting || selected.stoploss_notified}
                title={
                  selected.stoploss_notified
                    ? "A 50% stop-loss notice is already on file with the carrier"
                    : "File the 50% advance notice with the stop-loss carrier for this member"
                }
                className={clsx(
                  "inline-flex items-center gap-1.5 text-[13px] px-3.5 py-2 rounded-md font-semibold text-white transition-colors",
                  posting || selected.stoploss_notified
                    ? "bg-blue-400 cursor-not-allowed"
                    : "bg-blue-600 hover:bg-blue-700"
                )}
              >
                {selected.stoploss_notified ? (
                  <>Notice Filed ✓</>
                ) : (
                  <>
                    <BellRing className="w-3.5 h-3.5" /> {posting ? "Filing Notice…" : "Notify Stop-Loss Carrier"}
                  </>
                )}
              </button>
            </>
          )
        }
      >
        {selected && (
          <>
            {actionMsg && (
              <div
                className={clsx(
                  "mb-5 rounded-md px-4 py-3 text-[13px] border",
                  actionOk
                    ? "bg-emerald-50 border-emerald-300 text-emerald-900 dark:bg-emerald-900/20 dark:text-emerald-200"
                    : "bg-red-50 border-red-300 text-red-900 dark:bg-red-900/20 dark:text-red-200"
                )}
              >
                {actionMsg}
              </div>
            )}

            <FieldGroup title="Member">
              <Field label="Initials" value={selected.patient_initials} mono />
              <Field label="Patient ID" value={selected.patient_id} mono />
              <Field
                label="Stop-Loss Notice"
                value={
                  selected.stoploss_notified ? (
                    <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded border font-semibold bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800">
                      <CheckCircle2 className="w-3 h-3" /> Filed
                    </span>
                  ) : (
                    <span className="text-[11px] px-2 py-0.5 rounded border font-semibold bg-slate-50 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-600">
                      Not filed
                    </span>
                  )
                }
              />
              <Field label="Tier" value={<TierBadge tier={selected.tier} />} />
            </FieldGroup>

            <FieldGroup title="Spend Trajectory">
              <Field label="Trailing Spend" value={money(selected.trailing_spend_usd)} mono />
              <Field label="Monthly Run Rate" value={money(selected.monthly_run_rate_usd)} mono />
              <Field label="Specialty Share" value={`${Math.round(selected.specialty_share_pct)}%`} mono />
              <Field label="Projected 12-Mo Spend" value={money(selected.projected_12mo_usd)} mono />
              <Field
                label="% of Specific Deductible"
                value={<DeductibleBar pct={selected.pct_of_deductible} />}
              />
            </FieldGroup>

            <FieldGroup title="Driver">
              <Field label="Top Cost Driver" value={selected.top_cost_driver} />
            </FieldGroup>

            <FieldGroup title="Why this matters">
              <ul className="list-disc pl-4 space-y-1.5 text-[13px] text-slate-600 dark:text-slate-300 leading-relaxed">
                <li>
                  Filing the 50% advance notice preserves current coverage terms · the carrier cannot claim
                  late disclosure once this member is on record.
                </li>
                <li>
                  Late disclosure of a known high-cost claimant invites a laser (member-specific higher
                  deductible) or a premium load at renewal.
                </li>
                <li>
                  A care-management referral now · site-of-care shift, biosimilar switch, or copay-assistance
                  capture · can bend the trajectory before the deductible is breached.
                </li>
              </ul>
            </FieldGroup>
          </>
        )}
      </DetailDrawer>
    </div>
  );
}
