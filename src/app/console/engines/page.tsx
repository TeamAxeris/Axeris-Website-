"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, BrainCircuit, Clock3, GitMerge, Layers3, ShieldCheck, Sparkles } from "lucide-react";
import { demoFetch } from "@/lib/demoFetch";
import { PageHeader } from "@/components/ui/DataTable";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { InsightPanel, RankedBars, SignalCard, StackedOutcome } from "@/components/dashboard/InsightCharts";

const ENGINE_META: Record<number, { label: string; role: string; answer: string; tone: string }> = {
  1: { label: "Policy guardrail", role: "Reads clinical rules, plan policy, exclusions, dose limits, and drug interactions.", answer: "Is this claim allowed?", tone: "#2f2fe6" },
  2: { label: "Pattern detector", role: "Compares claims and prescribers with peer behavior to surface unusual patterns.", answer: "Does this look unusual?", tone: "#7654d6" },
  3: { label: "Member context", role: "Uses diagnoses, labs, pharmacogenomics, age, and current therapy to personalize risk.", answer: "Is it right for this member?", tone: "#0f8f69" },
};

const MODEL_LABELS: Record<string, string> = {
  xgboost: "Claim fraud",
  lightgbm: "Prescriber outlier",
  isolation_forest: "Anomaly scan",
  dbscan: "Network clusters",
  meta_learner_lr: "Ensemble blend",
  patient_context_layer: "Patient context",
};

export default function EngineIntelligencePage() {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    demoFetch("/api/v1/ml-engine/intelligence").then(setData).catch(() => {});
  }, []);

  if (!data) return <div className="p-6"><TableSkeleton rows={8} cols={7} /></div>;

  const engines: any[] = data.engines || [];
  const latency = data.latency || {};
  const ensemble = data.ensemble_value || {};
  const context = data.context_layer || {};
  const modelsWrap = data.models || {};
  const models: Record<string, any> = modelsWrap.models || {};
  const checks: any[] = (data.top_checks || []).slice(0, 8);
  const totalClaims = engines.reduce((sum, engine) => sum + (engine.claims_touched || 0), 0);
  const totalFlags = engines.reduce((sum, engine) => sum + (engine.flags || 0), 0);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Decision Intelligence"
        subtitle="One verdict built from policy, pattern recognition, and member context—with the contribution of every layer visible."
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <SignalCard label="Claims evaluated" value={totalClaims.toLocaleString()} detail="Across all three decision layers" icon={<Layers3 className="w-4 h-4" />} />
        <SignalCard label="Signals produced" value={totalFlags.toLocaleString()} detail="Critical, warning, and informational" tone="#7654d6" icon={<Sparkles className="w-4 h-4" />} />
        <SignalCard label="p95 decision time" value={`${latency.p95_ms ?? "·"}ms`} detail={`${latency.within_sla_pct ?? "·"}% inside the 200ms budget`} tone="#0f8f69" icon={<Clock3 className="w-4 h-4" />} />
        <SignalCard label="Models contributing" value={Object.keys(models).length} detail="Blended into one explainable result" tone="#b56f0b" icon={<BrainCircuit className="w-4 h-4" />} />
      </div>

      <InsightPanel title="How a claim becomes a decision" description="Each layer answers a different question. Agreement raises confidence; disagreement routes the claim for human review.">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          {engines.map((engine, index) => {
            const meta = ENGINE_META[engine.engine] || ENGINE_META[1];
            return (
              <div key={engine.engine} className="relative rounded-2xl p-4 border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-900/25">
                {index < engines.length - 1 && <ArrowRight className="hidden lg:block absolute -right-3.5 top-1/2 z-10 w-4 h-4 text-slate-300" />}
                <div className="flex items-center gap-2">
                  <span className="w-8 h-8 rounded-xl flex items-center justify-center text-[12px] font-bold text-white" style={{ background: meta.tone }}>{engine.engine}</span>
                  <div>
                    <div className="text-[11px] text-slate-500">{meta.label}</div>
                    <div className="text-[13px] font-semibold text-slate-900 dark:text-white">{engine.name}</div>
                  </div>
                </div>
                <p className="text-[11.5px] text-slate-600 dark:text-slate-300 mt-3 leading-relaxed min-h-[50px]">{meta.role}</p>
                <div className="text-[12px] font-medium mt-3" style={{ color: meta.tone }}>{meta.answer}</div>
                <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-slate-200 dark:border-slate-700">
                  <div><div className="text-[16px] font-semibold tabular-nums">{engine.claims_touched}</div><div className="text-[9.5px] text-slate-500">claims</div></div>
                  <div><div className="text-[16px] font-semibold tabular-nums text-red-600">{engine.critical}</div><div className="text-[9.5px] text-slate-500">critical</div></div>
                  <div><div className="text-[16px] font-semibold tabular-nums text-amber-600">{engine.warning}</div><div className="text-[9.5px] text-slate-500">review</div></div>
                </div>
              </div>
            );
          })}
        </div>
      </InsightPanel>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
        <InsightPanel title="Signal workload by layer" description="Patient context carries the most signals because it evaluates the claim against the entire member picture." className="xl:col-span-3">
          <RankedBars data={engines.map((engine) => ({ label: ENGINE_META[engine.engine]?.label || engine.name, value: engine.flags, color: ENGINE_META[engine.engine]?.tone, note: `${engine.claims_touched} claims touched` }))} height={230} />
        </InsightPanel>
        <InsightPanel title="Why the ensemble matters" description="Unique catches are the value that a single rules-only or ML-only system would miss." className="xl:col-span-2" action={<GitMerge className="w-4 h-4 text-slate-400" />}>
          <StackedOutcome segments={[
            { label: "Both agree", value: ensemble.claims_flagged_by_both || 0, color: "#0f8f69" },
            { label: "ML only", value: ensemble.ml_only_catches || 0, color: "#7654d6" },
            { label: "Rules only", value: ensemble.rules_only_catches || 0, color: "#2f2fe6" },
          ]} />
          <p className="mt-5 text-[11.5px] text-slate-600 dark:text-slate-300 leading-relaxed">{ensemble.narrative}</p>
        </InsightPanel>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <InsightPanel title="Decision speed" description="The full three-layer decision remains inside the real-time adjudication budget.">
          <div className="space-y-4 pt-1">
            {[
              { label: "Median", value: latency.p50_ms },
              { label: "95th percentile", value: latency.p95_ms },
              { label: "99th percentile", value: latency.p99_ms },
            ].map((row) => (
              <div key={row.label}>
                <div className="flex items-center justify-between text-[11px] mb-1.5"><span className="text-slate-500">{row.label}</span><span className="font-semibold tabular-nums">{row.value}ms</span></div>
                <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden"><div className="h-full rounded-full bg-emerald-600" style={{ width: `${Math.min(100, (row.value / (latency.sla_target_ms || 200)) * 100)}%` }} /></div>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2 mt-5 text-[11px] text-emerald-700 dark:text-emerald-300"><ShieldCheck className="w-4 h-4" /> {latency.within_sla_pct}% of decisions completed inside {latency.sla_target_ms}ms</div>
        </InsightPanel>

        <InsightPanel title="What member context changed" description="The context layer prevents both unnecessary friction and unsafe approvals.">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 p-4"><div className="text-[1.8rem] tracking-[-0.04em] text-emerald-700 dark:text-emerald-300 tabular-nums">{context.suppressed_to_auto_approve || 0}</div><div className="text-[11px] font-medium mt-1">False positives removed</div><p className="text-[10.5px] text-slate-500 mt-2">Member evidence made the claim safe enough to auto-approve.</p></div>
            <div className="rounded-2xl bg-red-50 dark:bg-red-900/20 p-4"><div className="text-[1.8rem] tracking-[-0.04em] text-red-700 dark:text-red-300 tabular-nums">{context.escalated_to_hard_block || 0}</div><div className="text-[11px] font-medium mt-1">Risks escalated</div><p className="text-[10.5px] text-slate-500 mt-2">Labs, diagnoses, or active therapy raised the claim to a hard stop.</p></div>
          </div>
        </InsightPanel>
      </div>

      <InsightPanel title="Model portfolio" description="The model name is secondary; the operational question it answers is what matters.">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {Object.entries(models).map(([key, model]: [string, any]) => (
            <div key={key} className="rounded-xl border border-slate-200 dark:border-slate-700 p-3.5">
              <div className="text-[12px] font-semibold text-slate-900 dark:text-white">{MODEL_LABELS[key] || key.replace(/_/g, " ")}</div>
              <div className="text-[10px] text-slate-400 mt-0.5 font-mono">{model.type || key}</div>
              <div className="flex items-end gap-4 mt-3">
                {model.n_training_samples != null && <div><div className="text-[15px] font-semibold tabular-nums">{Number(model.n_training_samples).toLocaleString()}</div><div className="text-[9.5px] text-slate-500">training rows</div></div>}
                {model.n_clusters_found != null && <div><div className="text-[15px] font-semibold tabular-nums">{model.n_clusters_found}</div><div className="text-[9.5px] text-slate-500">clusters</div></div>}
              </div>
            </div>
          ))}
        </div>
      </InsightPanel>

      <InsightPanel title="Signals appearing most often" description="A quick view of what is driving review volume on this book.">
        <RankedBars data={checks.map((check) => ({ label: check.flag_id, value: check.hits, note: check.title, color: check.engine === "PAT" ? "#0f8f69" : check.engine === "ML" ? "#7654d6" : "#2f2fe6" }))} height={280} />
        <div className="mt-3 text-right"><Link href="/console/checks" className="text-[12px] font-medium text-blue-600 dark:text-blue-400 inline-flex items-center gap-1">Review all coverage checks <ArrowRight className="w-3.5 h-3.5" /></Link></div>
      </InsightPanel>
    </div>
  );
}
