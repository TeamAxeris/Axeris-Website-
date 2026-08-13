"use client";

import clsx from "clsx";

export type DataSource = "Truveta" | "Kythera" | "NPPES" | "LEIE" | "NADAC" | "RxNorm" | "DailyMed" | "CredibleMeds" | "CPIC" | "Beers" | "CDC" | "Internal";

const SRC_META: Record<DataSource, { label: string; tone: string; tooltip: string }> = {
  Kythera: { label: "Kythera", tone: "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200", tooltip: "Kythera Labs Wayfinder · open claims (310M patients, 9.7B claims)" },
  Truveta: { label: "Truveta", tone: "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300", tooltip: "Truveta Data Model (TDM) · primary EHR + linked claims (120M+ patients, ~40 normalized tables, LOINC/RxNorm/SNOMED)" },
  NPPES: { label: "NPPES", tone: "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300", tooltip: "NPPES NPI Registry (CMS, live API)" },
  LEIE: { label: "LEIE", tone: "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300", tooltip: "HHS-OIG List of Excluded Individuals/Entities" },
  NADAC: { label: "NADAC", tone: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300", tooltip: "CMS National Average Drug Acquisition Cost (weekly)" },
  RxNorm: { label: "RxNorm", tone: "bg-slate-100 text-slate-700 dark:text-slate-300", tooltip: "NLM RxNorm · drug normalization" },
  DailyMed: { label: "DailyMed", tone: "bg-slate-100 text-slate-700 dark:text-slate-300", tooltip: "FDA DailyMed SPL labels" },
  CredibleMeds: { label: "CredibleMeds", tone: "bg-amber-50 text-amber-700 dark:text-amber-300 dark:bg-amber-900/20", tooltip: "Arizona CERT QT prolongation registry" },
  CPIC: { label: "CPIC", tone: "bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300", tooltip: "CPIC pharmacogenomic guidelines (Level A)" },
  Beers: { label: "Beers 2023", tone: "bg-amber-50 text-amber-700 dark:text-amber-300 dark:bg-amber-900/20", tooltip: "AGS Beers Criteria 2023 (DOI 10.1111/jgs.18372)" },
  CDC: { label: "CDC", tone: "bg-slate-100 text-slate-700 dark:text-slate-300", tooltip: "CDC 2022 Opioid Guideline (MMWR 2022;71(RR-3))" },
  Internal: { label: "Internal", tone: "bg-slate-100 text-slate-500", tooltip: "Axeris derived metric" },
};

export function DataSourceBadge({ source, size = "xs" }: { source: DataSource; size?: "xs" | "sm" }) {
  // Fall back gracefully for unregistered source names · a bad string must
  // never take down the whole page.
  const meta = SRC_META[source] ?? { label: source, tone: "bg-slate-100 text-slate-500", tooltip: source };
  return (
    <span
      title={meta.tooltip}
      className={clsx(
        "inline-flex items-center rounded font-mono font-semibold",
        meta.tone,
        size === "xs" ? "text-[9px] px-1.5 py-px" : "text-[11px] px-2 py-0.5"
      )}
    >
      {meta.label}
    </span>
  );
}

export function DataSourceList({ sources }: { sources: DataSource[] }) {
  return (
    <div className="inline-flex items-center gap-1">
      <span className="text-[10px] text-slate-400 uppercase tracking-wider">Sourced:</span>
      {sources.map((s) => (
        <DataSourceBadge key={s} source={s} />
      ))}
    </div>
  );
}
