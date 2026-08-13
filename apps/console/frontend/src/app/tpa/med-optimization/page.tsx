"use client";

import { useEffect, useState } from "react";
import { demoFetch, invalidate } from "@/lib/demoFetch";
import { DataTable, PageHeader, StatRow, Column } from "@/components/ui/DataTable";
import { DetailDrawer, FieldGroup, Field } from "@/components/ui/DetailDrawer";
import { DataSourceList } from "@/components/ui/DataSourceBadge";
import { TableSkeleton } from "@/components/ui/Skeleton";
import clsx from "clsx";
import { ExternalLink, Pill, ShieldCheck, Stethoscope } from "lucide-react";

type SignalKey = "beers" | "therapeutic_dup" | "polypharmacy";
type FilterKey = "all" | "beers" | "therapeutic_dup" | "polypharmacy";

interface MedItem {
  rx_id: string;
  patient_id: string;
  patient_initials: string;
  age: number | null;
  drug_name: string;
  brand_name: string | null;
  drug_class: string | null;
  signal: SignalKey;
  reason: string;
  active_med_count: number;
  annual_cost_usd: number;
  status: "open" | "reviewed";
}

const GET_URL = "/api/v1/tpa/med-optimization";

const money = (n: number) => `$${Math.round(n || 0).toLocaleString()}`;

const SIGNAL_META: Record<SignalKey, { label: string; badge: string }> = {
  beers: {
    label: "Beers PIM",
    badge:
      "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-700",
  },
  therapeutic_dup: {
    label: "Duplicate",
    badge:
      "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-700",
  },
  polypharmacy: {
    label: "Polypharmacy",
    badge:
      "bg-slate-100 text-slate-600 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600",
  },
};

function SignalBadge({ signal }: { signal: SignalKey }) {
  const m = SIGNAL_META[signal];
  return (
    <span className={clsx("text-[11px] px-2 py-0.5 rounded border font-semibold", m.badge)}>
      {m.label}
    </span>
  );
}

function StatusBadge({ status }: { status: MedItem["status"] }) {
  if (status === "reviewed") {
    return (
      <span className="text-[11px] px-2 py-0.5 rounded border font-semibold bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-700">
        Reviewed
      </span>
    );
  }
  return (
    <span className="text-[11px] px-2 py-0.5 rounded border font-semibold bg-slate-100 text-slate-600 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600">
      Open
    </span>
  );
}

export default function TPAMedOptimizationPage() {
  const [data, setData] = useState<any>(null);
  const [selected, setSelected] = useState<MedItem | null>(null);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [posting, setPosting] = useState(false);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [actionErr, setActionErr] = useState(false);

  useEffect(() => {
    demoFetch(GET_URL).then(setData).catch(() => {});
  }, []);

  if (!data) return <div className="p-6"><TableSkeleton rows={8} cols={7} /></div>;

  const items: MedItem[] = data.items || [];
  const s = data.summary || {};

  const chips: { key: FilterKey; label: string; count: number }[] = [
    { key: "all", label: "All", count: items.length },
    { key: "beers", label: "Beers", count: s.beers_count ?? items.filter((i) => i.signal === "beers").length },
    { key: "therapeutic_dup", label: "Duplication", count: s.duplication_count ?? items.filter((i) => i.signal === "therapeutic_dup").length },
    { key: "polypharmacy", label: "Polypharmacy", count: s.polypharmacy_count ?? items.filter((i) => i.signal === "polypharmacy").length },
  ];

  const filtered = filter === "all" ? items : items.filter((i) => i.signal === filter);

  const referReview = async (item: MedItem) => {
    setPosting(true);
    try {
      const res = await fetch(`/api/v1/tpa/med-optimization/${item.rx_id}/review`, {
        method: "POST",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      invalidate(GET_URL);
      setData((d: any) =>
        d
          ? {
              ...d,
              summary: {
                ...d.summary,
                reviewed: (d.summary?.reviewed || 0) + 1,
                realized_annual_usd:
                  Math.round(((d.summary?.realized_annual_usd || 0) + (item.annual_cost_usd || 0)) * 100) / 100,
              },
              items: (d.items || []).map((x: MedItem) =>
                x.rx_id === item.rx_id ? { ...x, status: "reviewed" } : x
              ),
            }
          : d
      );
      setSelected((cur) => (cur && cur.rx_id === item.rx_id ? { ...cur, status: "reviewed" } : cur));
      setActionErr(false);
      setActionMsg(
        `${item.drug_name} referred to pharmacist-led deprescribing review for member ${item.patient_initials}. Review follows STOPP/START + AGS Beers 2023 with a taper plan where needed and prescriber confirmation · up to ${money(item.annual_cost_usd)}/yr in avoidable drug spend under review.`
      );
    } catch {
      setActionErr(true);
      setActionMsg("Referral could not be submitted · backend unreachable. Please try again.");
    } finally {
      setPosting(false);
    }
  };

  const columns: Column<MedItem>[] = [
    {
      key: "drug",
      header: "Medication",
      render: (r) => (
        <div>
          <div className="font-semibold text-[13px] text-slate-900 dark:text-white">{r.drug_name}</div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400">{r.brand_name || "·"}</div>
        </div>
      ),
    },
    {
      key: "member",
      header: "Member",
      width: "110px",
      render: (r) => (
        <div>
          <div className="text-[13px] text-slate-700 dark:text-slate-300">{r.patient_initials}</div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400">age {r.age ?? "·"}</div>
        </div>
      ),
    },
    {
      key: "class",
      header: "Drug Class",
      width: "150px",
      render: (r) => <span className="text-[12px] text-slate-700 dark:text-slate-300">{r.drug_class || "·"}</span>,
    },
    {
      key: "signal",
      header: "Signal",
      width: "130px",
      render: (r) => <SignalBadge signal={r.signal} />,
    },
    {
      key: "active",
      header: "Active Meds",
      width: "100px",
      align: "right",
      render: (r) => <span className="tabular-nums text-[13px] text-slate-700 dark:text-slate-300">{r.active_med_count}</span>,
    },
    {
      key: "cost",
      header: "Annual Cost",
      width: "110px",
      align: "right",
      render: (r) => <span className="font-bold tabular-nums text-[13px] text-slate-900 dark:text-white">{money(r.annual_cost_usd)}</span>,
    },
    {
      key: "status",
      header: "Status",
      width: "100px",
      render: (r) => <StatusBadge status={r.status} />,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Medication Optimization"
        subtitle="Deprescribing & low-value medication review · AGS Beers 2023, therapeutic duplication, and polypharmacy. >50% of older adults take a medication with more harm than benefit."
        meta={<DataSourceList sources={["Truveta", "Beers", "Internal"]} />}
      />

      <div className="mb-3">
        <StatRow
          items={[
            { label: "Flagged Meds", value: s.flagged_medications ?? items.length, sub: `${s.members_affected ?? "·"} members affected` },
            { label: "Beers PIMs", value: s.beers_count ?? 0, sub: "AGS 2023 potentially-inappropriate", severity: "alert" },
            { label: "Duplication", value: s.duplication_count ?? 0, sub: "2+ agents, same drug class", severity: "warn" },
            { label: "Polypharmacy", value: s.polypharmacy_count ?? 0, sub: "≥5 active medications" },
            { label: "Annual Cost Under Review", value: money(s.avoidable_annual_usd ?? 0), sub: `${money(s.realized_annual_usd ?? 0)} referred to date`, severity: "warn" },
          ]}
        />
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        {chips.map((c) => (
          <button
            key={c.key}
            onClick={() => setFilter(c.key)}
            title={`Show ${c.label.toLowerCase()} signals`}
            className={clsx(
              "text-[12px] px-2.5 py-1 rounded-full border font-medium transition-colors",
              filter === c.key
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-600 hover:border-blue-400"
            )}
          >
            {c.label} <span className="tabular-nums opacity-70">({c.count})</span>
          </button>
        ))}
      </div>

      <DataTable
        columns={columns}
        rows={filtered}
        rowKey={(r) => r.rx_id}
        onRowClick={(r) => { setSelected(r); setActionMsg(null); setActionErr(false); }}
        emptyMessage="No flagged medications match this filter"
      />

      <DetailDrawer
        open={!!selected}
        onClose={() => { setSelected(null); setActionMsg(null); setActionErr(false); }}
        title={selected?.drug_name || ""}
        subtitle={selected ? `${SIGNAL_META[selected.signal].label} · member ${selected.patient_initials}` : ""}
        actions={selected && (
          <>
            <a
              href={`/patients/${selected.patient_id}`}
              title="Open the full member chart"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[13px] rounded border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700"
            >
              <ExternalLink className="w-3.5 h-3.5" /> Open Member Chart
            </a>
            <button
              onClick={() => referReview(selected)}
              disabled={posting || selected.status === "reviewed"}
              title={
                selected.status === "reviewed"
                  ? "Already referred to deprescribing review"
                  : "Refer this medication to pharmacist-led deprescribing review"
              }
              className={clsx(
                "inline-flex items-center gap-1.5 px-3 py-1.5 text-[13px] rounded text-white",
                selected.status === "reviewed"
                  ? "bg-blue-600 opacity-70 cursor-default"
                  : "bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              )}
            >
              <Stethoscope className="w-3.5 h-3.5" />
              {selected.status === "reviewed" ? "Referred ✓" : posting ? "Referring…" : "Refer to Deprescribing Review"}
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
                    : "bg-emerald-50 border-emerald-300 text-emerald-900 dark:bg-emerald-900/20 dark:border-emerald-700 dark:text-emerald-200"
                )}
              >
                {actionMsg}
              </div>
            )}

            <FieldGroup title="Medication">
              <Field label="Generic Name" value={selected.drug_name} />
              <Field label="Brand Name" value={selected.brand_name} />
              <Field label="Drug Class" value={selected.drug_class} />
              <Field label="Rx ID" value={selected.rx_id} mono />
            </FieldGroup>

            <FieldGroup title="Member">
              <Field label="Initials" value={selected.patient_initials} />
              <Field label="Age" value={selected.age !== null ? `${selected.age}` : "·"} />
              <Field label="Active Med Count" value={`${selected.active_med_count} active medications`} />
            </FieldGroup>

            <FieldGroup title="Signal">
              <Field
                label="Type"
                value={
                  <span className="inline-flex items-center gap-1.5">
                    <Pill className="w-3.5 h-3.5 text-slate-400" />
                    {SIGNAL_META[selected.signal].label}
                  </span>
                }
              />
              <div className="pt-2 text-[13px] text-slate-800 dark:text-slate-100 leading-relaxed font-medium">
                {selected.reason}
              </div>
              <div className="pt-1 text-[12px] text-slate-500 dark:text-slate-400">
                Annual drug spend under review: <span className="font-semibold text-slate-700 dark:text-slate-200">{money(selected.annual_cost_usd)}</span>
              </div>
            </FieldGroup>

            <FieldGroup title="Deprescribing pathway">
              <ol className="text-[12px] text-slate-600 dark:text-slate-300 leading-relaxed list-decimal pl-4 space-y-1">
                <li>Pharmacist review using <strong>STOPP/START</strong> criteria and <strong>AGS Beers 2023</strong>.</li>
                <li>Taper plan where clinically needed to avoid withdrawal or rebound.</li>
                <li>Prescriber confirmation before any regimen change is applied.</li>
                <li>Monitor for represcribing to confirm the change holds.</li>
              </ol>
            </FieldGroup>

            <div className="mt-4 rounded-md border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 px-4 py-3">
              <div className="flex items-center gap-1.5 text-[12px] font-semibold text-blue-900 dark:text-blue-300 mb-1.5">
                <ShieldCheck className="w-3.5 h-3.5" /> Why this matters
              </div>
              <p className="text-[12px] text-blue-900/90 dark:text-blue-200/90 leading-relaxed">
                The AGS reports that more than half of older adults take at least one medication with more
                harm than benefit. Deprescribing review targets Beers potentially-inappropriate medications,
                therapeutic duplications, and high-count regimens · reducing adverse drug events while removing
                low-value drug spend.
              </p>
            </div>
          </>
        )}
      </DetailDrawer>
    </div>
  );
}
