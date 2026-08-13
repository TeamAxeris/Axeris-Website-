"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Dna, Pill, AlertTriangle, CheckCircle2, BookOpen } from "lucide-react";
import { demoFetch } from "@/lib/demoFetch";

const SEED_PATIENTS = ["PAT-057", "PAT-058", "PAT-059", "PAT-060", "PAT-061"];

interface PGxRow {
  patient_id: string;
  patient_name: string;
  results: { gene: string; phenotype: string; diplotype?: string; test_date?: string; cpic_level: string; source: string }[];
}

interface REMSRow {
  patient_id: string;
  patient_name: string;
  enrollments: { rems_program: string; enrollment_date?: string; is_active: boolean; last_monitoring_date?: string; notes?: string }[];
}

export default function PgxRemsPage() {
  const [pgxData, setPgxData] = useState<PGxRow[]>([]);
  const [remsData, setRemsData] = useState<REMSRow[]>([]);

  useEffect(() => {
    Promise.all(SEED_PATIENTS.map(async (pid) => {
      const [pat, pgx, rems] = await Promise.all([
        demoFetch(`/api/v1/patients/${pid}`).catch(() => null),
        demoFetch(`/api/v1/v8/pgx/patient/${pid}`).catch(() => []),
        demoFetch(`/api/v1/v8/rems/patient/${pid}`).catch(() => []),
      ]);
      const name = pat ? `${pat.first_name} ${pat.last_name}` : pid;
      return { pid, name, pgx, rems };
    })).then(rows => {
      setPgxData(rows.filter(r => r.pgx.length > 0).map(r => ({ patient_id: r.pid, patient_name: r.name, results: r.pgx })));
      setRemsData(rows.filter(r => r.rems.length > 0).map(r => ({ patient_id: r.pid, patient_name: r.name, enrollments: r.rems })));
    });
  }, []);

  return (
    <div>
      <div className="space-y-8">
        {/* Header */}
        <div>
          <div className="flex items-center gap-3">
            <Dna className="w-7 h-7 text-purple-600 dark:text-purple-400" />
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Pharmacogenomics & REMS</h1>
            <span className="text-xs bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-full font-semibold">v8 Checks 15 & 16</span>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            CPIC Level A pharmacogenomic guidelines and FDA REMS ETASU compliance verification.
          </p>
        </div>

        {/* PGx Section */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Dna className="w-5 h-5 text-purple-600 dark:text-purple-400" /> Check 15: Pharmacogenomic Test Results
            </h2>
            <span className="text-xs px-2 py-0.5 rounded bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300">CPIC Level A</span>
          </div>
          <p className="text-xs text-gray-500 mb-3">
            Active rules: CYP2D6/codeine · CYP2C19/clopidogrel · CYP2C9/warfarin · SLCO1B1/simvastatin · HLA-B*57:01/abacavir · TPMT/thiopurines · DPYD/fluoropyrimidines.
          </p>
          <div className="space-y-3">
            {pgxData.length === 0 ? (
              <div className="p-6 text-center text-gray-500 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">No PGx results loaded.</div>
            ) : pgxData.map((row) => (
              <div key={row.patient_id} className="bg-white dark:bg-gray-800 rounded-lg border border-purple-200 dark:border-purple-800 p-4">
                <div className="flex items-center justify-between mb-3">
                  <Link href={`/patients/${row.patient_id}`} className="text-base font-semibold text-purple-700 dark:text-purple-300 hover:underline">
                    {row.patient_name} ({row.patient_id})
                  </Link>
                  <span className="text-xs text-gray-500">{row.results.length} gene result{row.results.length !== 1 && "s"}</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {row.results.map((r, i) => (
                    <div key={i} className="bg-purple-50 dark:bg-purple-900/20 rounded-md p-3">
                      <div className="flex items-center justify-between">
                        <div className="font-mono font-bold text-purple-900 dark:text-purple-200">{r.gene}</div>
                        <span className="text-xs bg-purple-200 dark:bg-purple-800 text-purple-900 dark:text-purple-200 px-2 py-0.5 rounded">CPIC {r.cpic_level}</span>
                      </div>
                      <div className="text-sm text-gray-800 dark:text-gray-200 mt-1">
                        <span className="font-semibold capitalize">{r.phenotype.replace(/_/g, " ")}</span>
                      </div>
                      {r.diplotype && <div className="text-xs text-gray-500 mt-1">Diplotype: <code className="font-mono">{r.diplotype}</code></div>}
                      <div className="text-xs text-gray-500 mt-0.5">Tested: {r.test_date || "n/a"} · Source: {r.source}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* REMS Section */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Pill className="w-5 h-5 text-rose-600" /> Check 16: REMS Compliance Verification
            </h2>
            <span className="text-xs px-2 py-0.5 rounded bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300">FDA REMS Database</span>
          </div>
          <p className="text-xs text-gray-500 mb-3">
            REMS programs with ETASU: iPLEDGE (isotretinoin), Clozapine REMS (ANC monitoring), TIRF REMS, Sodium Oxybate REMS.
          </p>
          <div className="space-y-3">
            {remsData.length === 0 ? (
              <div className="p-6 text-center text-gray-500 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                No active REMS enrollments. Patients prescribed isotretinoin/clozapine without enrollment will trigger Check 16 critical flag (RULE-REMS-001).
              </div>
            ) : remsData.map((row) => (
              <div key={row.patient_id} className="bg-white dark:bg-gray-800 rounded-lg border border-rose-200 dark:border-rose-800 p-4">
                <div className="flex items-center justify-between mb-3">
                  <Link href={`/patients/${row.patient_id}`} className="text-base font-semibold text-rose-700 dark:text-rose-300 hover:underline">
                    {row.patient_name} ({row.patient_id})
                  </Link>
                </div>
                {row.enrollments.map((e, i) => (
                  <div key={i} className="bg-rose-50 dark:bg-rose-900/20 rounded-md p-3 mt-2">
                    <div className="flex items-center justify-between">
                      <div className="font-bold text-rose-900 dark:text-rose-200">{e.rems_program}</div>
                      {e.is_active
                        ? <span className="text-xs bg-emerald-200 dark:bg-emerald-800 text-emerald-900 dark:text-emerald-200 px-2 py-0.5 rounded flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Active</span>
                        : <span className="text-xs bg-red-200 dark:bg-red-800 text-red-900 dark:text-red-200 px-2 py-0.5 rounded flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Inactive</span>}
                    </div>
                    <div className="text-sm text-gray-700 dark:text-gray-300 mt-1">
                      Enrolled: {e.enrollment_date || "n/a"} · Last monitoring: {e.last_monitoring_date || "Never"}
                    </div>
                    {e.notes && <div className="text-xs text-gray-500 mt-1 italic">{e.notes}</div>}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </section>

        {/* Reference */}
        <section className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <BookOpen className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <h3 className="font-semibold text-gray-900 dark:text-white">Evidence Sources</h3>
          </div>
          <ul className="text-xs text-gray-700 dark:text-gray-300 space-y-1">
            <li>· CPIC Guidelines (cpicpgx.org) · free, machine-readable, versioned</li>
            <li>· FDA PGx Biomarker Table · fda.gov/drugs</li>
            <li>· PharmGKB · pharmgkb.org (free with registration)</li>
            <li>· FDA REMS Database via DailyMed · dailymed.nlm.nih.gov</li>
            <li>· Data availability in JHM OMOP estimated at 8-15% of patients (per Hopkins data characterization)</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
