"use client";

import Link from "next/link";
import { ArrowRight, BrainCircuit, CircleCheck, Database, Radar, ShieldCheck } from "lucide-react";

type DataSourceItem = {
  name: string;
  type: "validation" | "live_api" | "batch" | "ml_model";
  used_for: string;
  upstream?: string;
};

const GROUPS = {
  validation: {
    label: "Claim context",
    icon: Database,
    tone: "#2f2fe6",
    description: "Confirms member and claim history",
  },
  live_api: {
    label: "Safety evidence",
    icon: ShieldCheck,
    tone: "#0f8f69",
    description: "Checks current clinical references",
  },
  batch: {
    label: "Control lists",
    icon: Radar,
    tone: "#b56f0b",
    description: "Screens pricing and exclusions",
  },
  ml_model: {
    label: "Risk signal",
    icon: BrainCircuit,
    tone: "#7654d6",
    description: "Prioritizes the highest-impact work",
  },
} as const;

/** A decision-flow summary, intentionally not a vendor inventory. */
export function WorkflowDataSources({ workflow, sources }: { workflow: string; sources: DataSourceItem[] }) {
  const groups = (Object.keys(GROUPS) as Array<keyof typeof GROUPS>)
    .map((type) => ({ type, meta: GROUPS[type], items: sources.filter((source) => source.type === type) }))
    .filter((group) => group.items.length > 0);

  return (
    <section className="decision-stack mb-5" aria-label={`${workflow} decision stack`}>
      <div className="flex items-center justify-between gap-4 mb-4">
        <div>
          <div className="flex items-center gap-2 text-[13px] font-semibold text-slate-900 dark:text-white">
            <CircleCheck className="w-4 h-4 text-emerald-600" />
            Decision stack
          </div>
          <p className="text-[11.5px] text-slate-500 dark:text-slate-400 mt-0.5">
            {sources.length} signals reduce the queue to the work that needs a human decision.
          </p>
        </div>
        <Link href="/console/data-sources" className="text-[12px] font-medium text-blue-600 dark:text-blue-400 inline-flex items-center gap-1 whitespace-nowrap">
          Review sources <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2.5">
        {groups.map(({ type, meta, items }, index) => {
          const Icon = meta.icon;
          return (
            <div key={type} className="relative rounded-xl border border-slate-200/80 dark:border-slate-700 bg-white/70 dark:bg-slate-800/60 px-3.5 py-3 min-w-0">
              {index < groups.length - 1 && <span className="hidden xl:block absolute top-1/2 -right-2.5 w-2.5 border-t border-dashed border-slate-300 dark:border-slate-600" />}
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${meta.tone}14`, color: meta.tone }}>
                  <Icon className="w-3.5 h-3.5" />
                </span>
                <div className="min-w-0">
                  <div className="text-[12px] font-semibold text-slate-900 dark:text-white">{meta.label}</div>
                  <div className="text-[10.5px] text-slate-500 dark:text-slate-400 truncate">{items.map((item) => item.name).join(" · ")}</div>
                </div>
                <span className="ml-auto text-[10px] tabular-nums text-slate-400">{items.length}</span>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-2 leading-snug">{meta.description}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
