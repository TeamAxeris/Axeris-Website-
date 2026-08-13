"use client";

import { useEffect, useState } from "react";
import { StatRow } from "@/components/ui/DataTable";
import { demoFetch } from "@/lib/demoFetch";
import { TableSkeleton } from "@/components/ui/Skeleton";

export default function InvestorPage() {
  const [manifest, setManifest] = useState<any>(null);
  const [mlStatus, setMlStatus] = useState<any>(null);
  const [tpaData, setTpaData] = useState<any>(null);
  const [pbaData, setPbaData] = useState<any>(null);

  useEffect(() => {
    demoFetch("/api/v1/data-sources/manifest").then(setManifest).catch(() => {});
    demoFetch("/api/v1/ml-engine/status").then(setMlStatus).catch(() => {});
    demoFetch("/api/v1/tpa/dashboard").then(setTpaData).catch(() => {});
    demoFetch("/api/v1/pba/dashboard").then(setPbaData).catch(() => {});
  }, []);

  const loading = !manifest || !tpaData || !pbaData;

  const mlModelCount = mlStatus?.models ? Object.keys(mlStatus.models).length : 6;
  const liveApiCount = 9;
  const validationDbs = manifest?.validation_databases?.length ?? 3;
  const totalChecks = 24;

  const claimsToday = pbaData?.transactions_today ?? 0;
  const recovered = tpaData?.quarterly_recovered_usd ?? 0;

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 flex flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-3xl space-y-10">

        {/* Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-slate-200 dark:border-slate-700 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Axeris · Investor Overview
          </div>
          <h1 className="text-4xl font-bold text-slate-900 dark:text-white tracking-tight">
            AI Clinical Decision Support
          </h1>
          <p className="text-[16px] text-slate-500 dark:text-slate-400 max-w-xl mx-auto">
            The prescription review layer that stops wasteful and dangerous claims before payment · at TPA batch and PBA real-time speed.
          </p>
        </div>

        {/* Live stats */}
        {loading ? (
          <TableSkeleton rows={2} cols={4} />
        ) : (
          <div className="space-y-3">
            <StatRow items={[
              { label: "ML Models", value: mlModelCount, sub: "sklearn-family, in-memory", severity: "ok" },
              { label: "Clinical Checks", value: totalChecks, sub: "Rules + ML + Patient context", severity: "info" },
              { label: "Validation Databases", value: validationDbs, sub: "Truveta · Kythera · Public APIs", severity: "info" },
              { label: "Live Public APIs", value: liveApiCount, sub: "FDA · NLM · CMS · NCBI", severity: "info" },
            ]} />
            <StatRow items={[
              { label: "Claims Processed Today", value: claimsToday.toLocaleString(), sub: "PBA real-time stream", severity: "ok" },
              { label: "Recovered This Quarter", value: `$${(recovered / 1000).toFixed(0)}K`, sub: "TPA post-adjudication", severity: "ok" },
              { label: "Deployment Modes", value: 2, sub: "TPA (batch) · PBA (real-time)", severity: "info" },
              { label: "SLA", value: "<200ms", sub: "p95 at pharmacy POS (PBA)", severity: "ok" },
            ]} />
          </div>
        )}

        {/* Two-column feature summary */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-6 space-y-3">
            <div className="text-[11px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">TPA Mode</div>
            <div className="text-[18px] font-bold text-slate-900 dark:text-white">Post-adjudication batch review</div>
            <p className="text-[13px] text-slate-500 dark:text-slate-400 leading-relaxed">
              Intercepts the employer ACH payment sweep after PBM adjudication. Pends claims, enforces ERISA § 404(a)(1)(B), generates quarterly stewardship reports, and files X12 276/277 ASA disputes.
            </p>
            <ul className="text-[13px] text-slate-700 dark:text-slate-300 space-y-1">
              <li>· Pend queue with soft/hard holds</li>
              <li>· Fraud referral pipeline (HHS-OIG + ML)</li>
              <li>· Employer book-of-business analytics</li>
              <li>· ERISA audit-ready report generation</li>
            </ul>
          </div>

          <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-6 space-y-3">
            <div className="text-[11px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">PBA Mode</div>
            <div className="text-[18px] font-bold text-slate-900 dark:text-white">Real-time pre-dispense intervention</div>
            <p className="text-[13px] text-slate-500 dark:text-slate-400 leading-relaxed">
              Embedded in the NCPDP D.0 adjudication pipeline. Returns hard stops (reject code 511-FB) or soft edits (field 526-FQ) to the dispensing pharmacy POS under 200ms p95.
            </p>
            <ul className="text-[13px] text-slate-700 dark:text-slate-300 space-y-1">
              <li>· Live transaction stream with latency telemetry</li>
              <li>· Pharmacist callback queue</li>
              <li>· Member safety escalation (P1/P2/P3)</li>
              <li>· Formulary tier + PA + step therapy enforcement</li>
            </ul>
          </div>
        </div>

        {/* Clinical checks summary */}
        <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-6">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-4">24-Check Clinical Engine</div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-[13px]">
            {[
              { label: "Engine 1 · Rules", checks: "Checks 1-9", desc: "Hard-coded clinical rules: DDI, duplicate therapy, refill-too-soon, opioid MME, excluded prescriber, REMS, recall, age/gender, quantity limits" },
              { label: "Engine 2 · ML", checks: "Checks 10-19", desc: "XGBoost fraud detection, IsolationForest anomaly scoring, LightGBM pill-mill composite, DBSCAN network clustering, opioid stewardship PA intelligence" },
              { label: "Engine 3 · Patient Context", checks: "Checks 20-24", desc: "BioClinicalBERT NLP on EHR notes, genomics-informed dosing, allergy cross-reference, chronic disease context, false-positive suppression" },
            ].map((e) => (
              <div key={e.label} className="space-y-1.5">
                <div className="font-semibold text-slate-900 dark:text-slate-100">{e.label}</div>
                <div className="text-[11px] text-slate-400 font-mono">{e.checks}</div>
                <div className="text-slate-500 dark:text-slate-400 leading-relaxed">{e.desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-[12px] text-slate-400 pt-4 border-t border-slate-100 dark:border-slate-800">
          All data shown is synthetic demo data. Axeris v0.3.0 &mdash; AI Clinical Decision Support Platform.
        </div>
      </div>
    </div>
  );
}
