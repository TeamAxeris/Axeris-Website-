"use client";

import { Landmark, Scale, ShieldCheck, TrendingDown } from "lucide-react";
import { buildContractAudit, type ContractAuditInput } from "@/lib/contractAudit";

const statusStyle = {
  clear: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800",
  review: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800",
  recover: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/20 dark:text-rose-300 dark:border-rose-800",
};

export default function ContractIntegrityPanel({ input, compact = false }: { input: ContractAuditInput; compact?: boolean }) {
  const audit = buildContractAudit(input);
  const benchmarkPct = Math.max(8, Math.round((audit.benchmark / audit.allowed) * 100));
  const recoverablePct = Math.max(4, Math.round((audit.recoverable / audit.allowed) * 100));

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <div className="border-b border-indigo-300 bg-[linear-gradient(120deg,#373bd0,#5b7be7)] px-4 py-4 text-white dark:border-indigo-500 sm:px-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.14em] text-indigo-100">
              <Landmark className="h-3.5 w-3.5" /> Contract integrity scan
            </div>
            <h2 className="mt-1 text-[18px] font-semibold tracking-[-0.02em]">Clinical and financial evidence, one case</h2>
            <p className="mt-1 max-w-2xl text-[12px] leading-relaxed text-indigo-100">
              Every case is checked against pricing, rebate, ownership, channel, benefit, and eligibility terms before disposition.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2">
            <ShieldCheck className="h-4 w-4 text-emerald-200" />
            <div>
              <div className="text-[10px] text-indigo-100">Checks needing attention</div>
              <div className="text-[16px] font-bold tabular-nums">{audit.attentionCount} of {audit.checks.length}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 p-4 sm:p-5 lg:grid-cols-[0.78fr_1.22fr]">
        <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-900/40">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Claim economics</div>
              <div className="mt-1 text-[12px] text-slate-500">Allowed amount compared with independent benchmark</div>
            </div>
            <TrendingDown className="h-4 w-4 text-violet-600" />
          </div>
          <div className="space-y-3">
            <AuditBar label="Allowed" value={audit.allowed} width={100} color="#7377e8" />
            <AuditBar label="Benchmark" value={audit.benchmark} width={benchmarkPct} color="#2f2fe6" />
            <AuditBar label="Recoverable" value={audit.recoverable} width={recoverablePct} color="#dc4b45" />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 border-t border-slate-200 pt-3 dark:border-slate-700">
            <div>
              <div className="text-[10px] text-slate-500">Case opportunity</div>
              <div className="mt-0.5 text-[19px] font-semibold tabular-nums text-slate-900 dark:text-white">${Math.round(audit.recoverable).toLocaleString()}</div>
            </div>
            <div>
              <div className="text-[10px] text-slate-500">Annualized signal</div>
              <div className="mt-0.5 text-[19px] font-semibold tabular-nums text-slate-900 dark:text-white">${audit.annualized.toLocaleString()}</div>
            </div>
          </div>
        </div>

        <div className={compact ? "grid gap-2 sm:grid-cols-2" : "grid gap-2 sm:grid-cols-2 xl:grid-cols-3"}>
          {audit.checks.map((check) => (
            <div key={check.key} className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
              <div className="flex items-start justify-between gap-2">
                <div className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">{check.label}</div>
                <span className={`rounded-full border px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider ${statusStyle[check.status]}`}>
                  {check.status === "recover" ? "Recover" : check.status}
                </span>
              </div>
              <div className="mt-2 text-[16px] font-semibold tracking-[-0.02em] text-slate-900 dark:text-white">{check.value}</div>
              <div className="mt-1 text-[10.5px] leading-snug text-slate-500 dark:text-slate-400">{check.detail}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-2 border-t border-slate-200 px-4 py-2 text-[9.5px] text-slate-400 dark:border-slate-700 sm:px-5">
        <Scale className="h-3 w-3" /> Demo case economics · source trail available in the underlying audit workspace
      </div>
    </section>
  );
}

function AuditBar({ label, value, width, color }: { label: string; value: number; width: number; color: string }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-[10.5px] text-slate-500">
        <span>{label}</span><span className="font-mono tabular-nums">${Math.round(value).toLocaleString()}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
        <div className="h-full rounded-full" style={{ width: `${Math.min(100, width)}%`, background: color }} />
      </div>
    </div>
  );
}
