"use client";

import { useEffect, useMemo, useState } from "react";
import { BrainCircuit, CircleCheck, Database, FileCheck2, RadioTower, ShieldCheck } from "lucide-react";
import { demoFetch } from "@/lib/demoFetch";
import { PageHeader } from "@/components/ui/DataTable";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { InsightPanel, SignalCard } from "@/components/dashboard/InsightCharts";

const MODEL_LABELS: Record<string, string> = {
  XGBoost: "Claim fraud",
  LightGBM: "Prescriber outliers",
  "Isolation Forest": "Unusual behavior",
  DBSCAN: "Network relationships",
  "Meta-learner (LR)": "Final risk blend",
  "BioClinicalBERT + PubMedBERT (Engine 3)": "Member context",
};

export default function DataSourcesPage() {
  const [manifest, setManifest] = useState<any>(null);
  const [catalog, setCatalog] = useState<any>(null);
  const [mlStatus, setMlStatus] = useState<any>(null);

  useEffect(() => {
    Promise.all([
      demoFetch("/api/v1/data-sources/manifest"),
      demoFetch("/api/v1/public-apis/catalog"),
      demoFetch("/api/v1/ml-engine/status"),
    ]).then(([nextManifest, nextCatalog, nextStatus]) => {
      setManifest(nextManifest);
      setCatalog(nextCatalog);
      setMlStatus(nextStatus);
    }).catch(() => {});
  }, []);

  const referenceGroups = useMemo(() => {
    if (!catalog) return [];
    const all = [
      ...(catalog.live_apis || []).map((source: any) => ({ ...source, cadence: "On demand" })),
      ...(catalog.batch_synced_apis || []).map((source: any) => ({ ...source, owner: source.owner || "Public reference", cadence: source.frequency })),
    ];
    const groups = all.reduce((acc: Record<string, any[]>, source: any) => {
      const owner = source.owner || "Public reference";
      (acc[owner] ||= []).push(source);
      return acc;
    }, {});
    return Object.entries(groups).map(([owner, sources]) => ({ owner, sources }));
  }, [catalog]);

  if (!manifest || !catalog) return <div className="p-6"><TableSkeleton rows={7} cols={5} /></div>;

  const liveCount = catalog.live_apis?.length || 0;
  const batchCount = catalog.batch_synced_apis?.length || 0;
  const models = manifest.ml_engine?.models || [];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Data Foundation"
        subtitle="A concise view of the evidence behind every decision: claim context, clinical references, model signals, and audit output."
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <SignalCard label="Core datasets" value={manifest.validation_databases.length} detail="Member context and claims breadth" icon={<Database className="w-4 h-4" />} />
        <SignalCard label="Clinical references" value={liveCount + batchCount} detail={`${liveCount} on demand · ${batchCount} synchronized`} tone="#0f8f69" icon={<RadioTower className="w-4 h-4" />} />
        <SignalCard label="Decision models" value={models.length} detail="One blended, explainable risk result" tone="#7654d6" icon={<BrainCircuit className="w-4 h-4" />} />
        <SignalCard label="Overall status" value="Good" detail="Sources are available to the decision stack" tone="#0f8f69" icon={<CircleCheck className="w-4 h-4" />} />
      </div>

      <InsightPanel title="From raw claim to auditable decision" description="Four layers turn fragmented healthcare data into a concise reviewer recommendation.">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {[
            { n: "01", title: "Assemble context", text: "Link the claim with member history, diagnoses, labs, and prior therapy.", icon: Database, tone: "#2f2fe6" },
            { n: "02", title: "Verify evidence", text: "Check current safety, pricing, identity, exclusion, and formulary references.", icon: ShieldCheck, tone: "#0f8f69" },
            { n: "03", title: "Score the signal", text: "Compare the case with peer behavior and known clinical risk patterns.", icon: BrainCircuit, tone: "#7654d6" },
            { n: "04", title: "Record the reason", text: "Save the evidence, recommendation, and reviewer action in one audit trail.", icon: FileCheck2, tone: "#b56f0b" },
          ].map((step) => {
            const Icon = step.icon;
            return (
              <div key={step.n} className="rounded-2xl border border-slate-200 dark:border-slate-700 p-4 bg-slate-50/50 dark:bg-slate-900/25">
                <div className="flex items-center justify-between"><span className="text-[10px] text-slate-400">{step.n}</span><Icon className="w-4 h-4" style={{ color: step.tone }} /></div>
                <h3 className="text-[13px] font-semibold text-slate-900 dark:text-white mt-5">{step.title}</h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed mt-2">{step.text}</p>
              </div>
            );
          })}
        </div>
      </InsightPanel>

      <InsightPanel title="Core data layer" description="Two complementary datasets: one provides clinical depth, the other provides market-wide claims breadth.">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {manifest.validation_databases.map((source: any) => (
            <div key={source.id} className="rounded-2xl border border-slate-200 dark:border-slate-700 p-5">
              <div className="flex items-start justify-between gap-3">
                <div><div className="text-[10px] uppercase tracking-[0.12em] text-slate-400">{source.primary ? "Primary clinical context" : "Market validation"}</div><h3 className="text-[17px] font-semibold text-slate-900 dark:text-white mt-1">{source.name}</h3></div>
                <span className="inline-flex items-center gap-1 text-[10px] text-emerald-700 dark:text-emerald-300"><CircleCheck className="w-3.5 h-3.5" /> Good</span>
              </div>
              <p className="text-[12px] text-slate-600 dark:text-slate-300 leading-relaxed mt-4">{source.use_in_axeris}</p>
              <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                <div><div className="text-[10px] text-slate-400">Coverage</div><div className="text-[11.5px] text-slate-700 dark:text-slate-300 mt-1">{String(source.patients).split("·")[0]}</div></div>
                <div><div className="text-[10px] text-slate-400">Role</div><div className="text-[11.5px] text-slate-700 dark:text-slate-300 mt-1">{source.primary ? "All three engines" : "Model validation"}</div></div>
              </div>
            </div>
          ))}
        </div>
      </InsightPanel>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
        <InsightPanel title="Reference network" description="Grouped by steward so reviewers can see who maintains the evidence without scanning a long technical inventory." className="xl:col-span-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {referenceGroups.map((group: any) => (
              <div key={group.owner} className="rounded-xl bg-slate-50 dark:bg-slate-900/30 p-3.5">
                <div className="flex items-center justify-between"><span className="text-[11px] font-semibold text-slate-900 dark:text-white">{group.owner}</span><span className="text-[10px] text-slate-400 tabular-nums">{group.sources.length} sources</span></div>
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {group.sources.map((source: any) => <span key={source.id} title={source.purpose} className="text-[10px] px-2 py-1 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">{source.name}</span>)}
                </div>
              </div>
            ))}
          </div>
        </InsightPanel>

        <InsightPanel title="Model responsibilities" description="The job each model performs, expressed in operational language." className="xl:col-span-2">
          <div className="space-y-2">
            {models.map((model: any) => (
              <div key={model.name} className="flex items-start gap-3 rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-2.5">
                <span className="w-7 h-7 rounded-lg bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 flex items-center justify-center"><BrainCircuit className="w-3.5 h-3.5" /></span>
                <div className="min-w-0"><div className="text-[11.5px] font-semibold text-slate-900 dark:text-white">{MODEL_LABELS[model.name] || model.name}</div><div className="text-[10.5px] text-slate-500 truncate" title={model.purpose}>{model.purpose}</div></div>
              </div>
            ))}
          </div>
        </InsightPanel>
      </div>

      <div className="rounded-2xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/60 dark:bg-emerald-900/15 px-4 py-3 flex items-center gap-3">
        <CircleCheck className="w-5 h-5 text-emerald-700 dark:text-emerald-300" />
        <div><div className="text-[12px] font-semibold text-emerald-900 dark:text-emerald-200">Decision stack is ready</div><div className="text-[10.5px] text-emerald-800/70 dark:text-emerald-300/70">{mlStatus?.trained ? `Models last trained ${new Date(mlStatus.trained_at).toLocaleDateString()}` : "Core data and reference sources are available"} · explanations are retained with each claim.</div></div>
      </div>
    </div>
  );
}
