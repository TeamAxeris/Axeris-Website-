"use client";

import { useEffect, useState } from "react";
import { ListChecks, ShieldAlert, Sparkles, CheckCircle2, AlertTriangle, Database, Brain, Cpu } from "lucide-react";
import { demoFetch } from "@/lib/demoFetch";

interface CheckEntry {
  num: number;
  name: string;
  engine: string;
  flag_id: string;
  data_required: string;
  evidence: string;
  v8_new?: boolean;
}

interface Manifest {
  version: string;
  total_checks: number;
  categories: Record<string, { title: string; checks: CheckEntry[] }>;
  foundational: CheckEntry & { v8_new?: boolean };
  modules: string[];
  operating_modes: { mode: string; desc: string }[];
}

interface DispositionSummary {
  dispositions: { APPROVE: number; REVIEW: number; FLAG: number };
  holds: { soft_hold: number; hard_hold: number; no_hold: number };
  avg_processing_time_ms: number;
}

export default function ChecksPage() {
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [dispo, setDispo] = useState<DispositionSummary | null>(null);

  useEffect(() => {
    demoFetch("/api/v1/v8/checks/manifest").then(setManifest).catch(() => {});
    demoFetch("/api/v1/v8/dispositions/summary").then(setDispo).catch(() => {});
  }, []);

  if (!manifest) return <div className="p-8">Loading manifest…</div>;

  const engineColor = (e: string) =>
    e === "rules" ? "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200"
    : e === "ml" ? "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-200"
    : "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200";

  const categoryIcon = (k: string) => {
    if (k === "A") return Sparkles;
    if (k === "B") return Database;
    if (k === "C") return ShieldAlert;
    if (k === "D") return CheckCircle2;
    if (k === "E") return AlertTriangle;
    return Brain;
  };

  return (
    <div>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              <ListChecks className="w-7 h-7 text-emerald-600" />
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                24-Check Coverage Manifest
              </h1>
              <span className="text-xs bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-full font-semibold">
                {manifest.version}
              </span>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              All {manifest.total_checks} numbered clinical safety checks per Axeris v8 specification (April 2026)
            </p>
          </div>
        </div>

        {/* Disposition Summary */}
        {dispo && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800 rounded-lg p-4">
              <div className="text-xs uppercase font-bold text-emerald-700 dark:text-emerald-300">APPROVE</div>
              <div className="text-3xl font-bold text-emerald-900 dark:text-emerald-100 mt-1">{dispo.dispositions.APPROVE}</div>
              <div className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">Auto-payment authorized</div>
            </div>
            <div className="bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
              <div className="text-xs uppercase font-bold text-amber-700 dark:text-amber-300">REVIEW</div>
              <div className="text-3xl font-bold text-amber-900 dark:text-amber-100 mt-1">{dispo.dispositions.REVIEW}</div>
              <div className="text-xs text-amber-600 dark:text-amber-400 mt-1">Soft hold · 24h SLA auto-release</div>
            </div>
            <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <div className="text-xs uppercase font-bold text-red-700 dark:text-red-300">FLAG</div>
              <div className="text-3xl font-bold text-red-900 dark:text-red-100 mt-1">{dispo.dispositions.FLAG}</div>
              <div className="text-xs text-red-600 dark:text-red-400 mt-1">Hard hold · explicit resolution</div>
            </div>
            <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <div className="text-xs uppercase font-bold text-blue-700 dark:text-blue-300">Avg latency</div>
              <div className="text-3xl font-bold text-blue-900 dark:text-blue-100 mt-1">{dispo.avg_processing_time_ms}<span className="text-base">ms</span></div>
              <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">3-engine pipeline · sub-200ms target</div>
            </div>
          </div>
        )}

        {/* Foundational Layer */}
        <div className="bg-gradient-to-r from-rose-50 to-pink-50 dark:from-rose-900/20 dark:to-pink-900/20 border-l-4 border-rose-500 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <ShieldAlert className="w-6 h-6 text-rose-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-gray-900 dark:text-white">Foundational: {manifest.foundational.name || "Excluded Provider Screening"}</h3>
                <span className="text-[10px] bg-emerald-600 text-white px-1.5 py-0.5 rounded font-semibold">v8 NEW</span>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                Hard-stop screening on every claim. Cross-references prescriber NPI against {manifest.foundational.evidence}.
              </p>
              <div className="text-xs text-gray-500 mt-2 font-mono">{manifest.foundational.flag_id}</div>
            </div>
          </div>
        </div>

        {/* Categories A-F */}
        {Object.entries(manifest.categories).map(([k, cat]) => {
          const Icon = categoryIcon(k);
          return (
            <div key={k} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="bg-gradient-to-r from-slate-50 to-gray-100 dark:from-slate-800 dark:to-gray-700 px-5 py-3 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold">
                    {k}
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 dark:text-white">Category {k}: {cat.title}</h3>
                    <p className="text-xs text-gray-500">{cat.checks.length} checks</p>
                  </div>
                  <Icon className="w-5 h-5 text-gray-400 ml-auto" />
                </div>
              </div>
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {cat.checks.map((c) => (
                  <div key={c.num} className="px-5 py-4 hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors">
                    <div className="flex items-start gap-4">
                      <div className="w-8 h-8 rounded-md bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-sm font-bold text-gray-600 dark:text-gray-300 flex-shrink-0">
                        {c.num}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="font-semibold text-gray-900 dark:text-white">Check {c.num}: {c.name}</h4>
                          {c.v8_new && <span className="text-[10px] bg-emerald-600 text-white px-1.5 py-0.5 rounded font-semibold">v8 NEW</span>}
                          <span className={`text-[10px] uppercase px-2 py-0.5 rounded ${engineColor(c.engine)}`}>{c.engine}</span>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          <span className="font-semibold">Evidence:</span> {c.evidence}
                        </p>
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                          <span className="font-semibold">Data tier:</span> {c.data_required}
                        </p>
                      </div>
                      <div className="text-xs font-mono text-gray-400 dark:text-gray-500 flex-shrink-0">{c.flag_id}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {/* Operating Modes + Modules */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Cpu className="w-4 h-4 text-gray-400" />
              <h3 className="font-bold text-gray-900 dark:text-white">Operating Modes</h3>
            </div>
            <div className="space-y-2">
              {manifest.operating_modes.map((m) => (
                <div key={m.mode} className="flex items-start gap-2 text-sm">
                  <span className="font-bold text-blue-600 dark:text-blue-400 w-12 flex-shrink-0">{m.mode}</span>
                  <span className="text-gray-600 dark:text-gray-300">{m.desc}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-gray-400" />
              <h3 className="font-bold text-gray-900 dark:text-white">Additional Monitoring Modules</h3>
            </div>
            <ul className="space-y-1.5 text-sm">
              {manifest.modules.map((m) => (
                <li key={m} className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" /> {m}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
