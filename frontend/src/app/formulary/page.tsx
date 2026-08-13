"use client";

import { useState } from "react";
import { formularyCheck, searchDrugs } from "@/lib/api";
import type { FormularyResult, Drug } from "@/types";
import Header from "@/components/layout/Header";
import {
  Search, Pill, DollarSign, Shield, AlertTriangle,
  CheckCircle, XCircle, ArrowRight, Loader2, Star, ListChecks,
} from "lucide-react";
import clsx from "clsx";

const tierColors: Record<number, { bg: string; text: string; border: string }> = {
  1: { bg: "bg-green-50 dark:bg-emerald-900/20", text: "text-green-700 dark:text-emerald-300", border: "border-green-200" },
  2: { bg: "bg-blue-50 dark:bg-blue-900/20", text: "text-blue-700 dark:text-blue-300", border: "border-blue-200" },
  3: { bg: "bg-yellow-50 dark:bg-yellow-900/20", text: "text-yellow-700 dark:text-yellow-300", border: "border-yellow-200" },
  4: { bg: "bg-orange-50 dark:bg-orange-900/20", text: "text-orange-700 dark:text-orange-300", border: "border-orange-200" },
  5: { bg: "bg-red-50 dark:bg-red-900/20", text: "text-red-700 dark:text-red-300", border: "border-red-200" },
};

export default function FormularyPage() {
  const [query, setQuery] = useState("");
  const [drugs, setDrugs] = useState<Drug[]>([]);
  const [result, setResult] = useState<FormularyResult | null>(null);
  const [searching, setSearching] = useState(false);
  const [checking, setChecking] = useState(false);
  const [selectedDrug, setSelectedDrug] = useState<Drug | null>(null);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setSearching(true);
    setResult(null);
    setSelectedDrug(null);
    try {
      const results = await searchDrugs(query);
      setDrugs(results);
    } catch {
      setDrugs([]);
    } finally {
      setSearching(false);
    }
  };

  const handleCheck = async (drug: Drug) => {
    setSelectedDrug(drug);
    setChecking(true);
    try {
      const res = await formularyCheck(drug.id);
      setResult(res);
    } catch {
      setResult(null);
    } finally {
      setChecking(false);
    }
  };

  return (
    <>
      <Header title="Formulary & Drug Lookup" />
      <div className="mt-4 space-y-6">
        {/* Search */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 dark:bg-slate-800 dark:border-slate-700">
          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2 dark:text-slate-300">
            <Search className="w-4 h-4" /> Search Drug Database
          </h3>
          <div className="flex gap-3">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="Search by drug name (e.g. metformin, atorvastatin, oxycodone)..."
              className="flex-1 text-sm border border-gray-300 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all dark:border-slate-600"
            />
            <button
              onClick={handleSearch}
              disabled={searching}
              className="bg-blue-600 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-all flex items-center gap-2"
            >
              {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              Search
            </button>
          </div>

          {/* Drug Results */}
          {drugs.length > 0 && (
            <div className="mt-4 space-y-2">
              <div className="text-xs text-gray-500 mb-2">{drugs.length} drugs found · click to check formulary status</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {drugs.map((drug) => (
                  <button
                    key={drug.id}
                    onClick={() => handleCheck(drug)}
                    className={clsx(
                      "text-left p-3 rounded-lg border transition-all hover:shadow-md",
                      selectedDrug?.id === drug.id
                        ? "border-blue-500 bg-blue-50 ring-2 ring-blue-200 dark:bg-blue-900/20"
                        : "border-gray-200 hover:border-blue-300 bg-white dark:bg-slate-800 dark:border-slate-700"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium text-gray-900 dark:text-white">{drug.generic_name}</div>
                        {drug.brand_name && (
                          <div className="text-xs text-gray-500">{drug.brand_name}</div>
                        )}
                      </div>
                      <ArrowRight className="w-4 h-4 text-gray-400" />
                    </div>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded dark:bg-slate-700 dark:text-slate-400">{drug.drug_class}</span>
                      <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded dark:bg-slate-700 dark:text-slate-400">{drug.schedule}</span>
                      <span className="text-[10px] text-gray-500">${drug.average_cost_per_unit}/unit</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Formulary Result */}
        {checking && (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center dark:bg-slate-800 dark:border-slate-700">
            <Loader2 className="w-6 h-6 animate-spin mx-auto text-blue-500 mb-2" />
            <div className="text-sm text-gray-500">Checking formulary status...</div>
          </div>
        )}

        {result && !checking && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 animate-fade-in-up">
            {/* Tier & Coverage */}
            <div className="bg-white rounded-xl border border-gray-200 p-5 dark:bg-slate-800 dark:border-slate-700">
              <h4 className="text-xs font-semibold text-gray-500 uppercase mb-4">Formulary Status</h4>
              <div className="text-center mb-4">
                <div className={clsx(
                  "inline-flex items-center gap-2 text-lg font-bold px-4 py-2 rounded-xl border",
                  tierColors[result.tier]?.bg || "bg-gray-50 dark:bg-slate-900/40",
                  tierColors[result.tier]?.text || "text-gray-700 dark:text-slate-300",
                  tierColors[result.tier]?.border || "border-gray-200 dark:border-slate-700",
                )}>
                  <Star className="w-5 h-5" />
                  Tier {result.tier} · {result.tier_name}
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between p-2.5 bg-gray-50 rounded-lg dark:bg-slate-900/40">
                  <span className="text-xs text-gray-600 dark:text-slate-400">Estimated Copay</span>
                  <span className="text-sm font-semibold text-gray-900 dark:text-white">{result.copay_range}</span>
                </div>
                <div className="flex items-center justify-between p-2.5 bg-gray-50 rounded-lg dark:bg-slate-900/40">
                  <span className="text-xs text-gray-600 dark:text-slate-400">Quantity Limit</span>
                  <span className="text-sm font-semibold text-gray-900 dark:text-white">{result.quantity_limit} units</span>
                </div>
                <div className="flex items-center justify-between p-2.5 bg-gray-50 rounded-lg dark:bg-slate-900/40">
                  <span className="text-xs text-gray-600 dark:text-slate-400">Schedule</span>
                  <span className="text-sm font-semibold text-gray-900 dark:text-white">{result.schedule || "Non-controlled"}</span>
                </div>
                <div className="flex items-center justify-between p-2.5 bg-gray-50 rounded-lg dark:bg-slate-900/40">
                  <span className="text-xs text-gray-600 dark:text-slate-400">Generic Available</span>
                  {result.generic_available ? (
                    <CheckCircle className="w-4 h-4 text-green-600 dark:text-emerald-400" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-500" />
                  )}
                </div>
              </div>
            </div>

            {/* Requirements */}
            <div className="bg-white rounded-xl border border-gray-200 p-5 dark:bg-slate-800 dark:border-slate-700">
              <h4 className="text-xs font-semibold text-gray-500 uppercase mb-4">Coverage Requirements</h4>
              <div className="space-y-3">
                <div className={clsx(
                  "p-3 rounded-lg border",
                  result.pa_required ? "bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20" : "bg-green-50 border-green-200 dark:bg-emerald-900/20"
                )}>
                  <div className="flex items-center gap-2 mb-1">
                    {result.pa_required ? (
                      <AlertTriangle className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
                    ) : (
                      <CheckCircle className="w-4 h-4 text-green-600 dark:text-emerald-400" />
                    )}
                    <span className="text-sm font-medium">
                      Prior Authorization {result.pa_required ? "Required" : "Not Required"}
                    </span>
                  </div>
                  {result.pa_required && (
                    <p className="text-xs text-yellow-700 ml-6 dark:text-yellow-300">
                      Submit PA with clinical justification and documentation of failed alternatives.
                    </p>
                  )}
                </div>

                <div className={clsx(
                  "p-3 rounded-lg border",
                  result.step_therapy_required ? "bg-orange-50 border-orange-200 dark:bg-orange-900/20" : "bg-green-50 border-green-200 dark:bg-emerald-900/20"
                )}>
                  <div className="flex items-center gap-2 mb-1">
                    {result.step_therapy_required ? (
                      <ListChecks className="w-4 h-4 text-orange-600" />
                    ) : (
                      <CheckCircle className="w-4 h-4 text-green-600 dark:text-emerald-400" />
                    )}
                    <span className="text-sm font-medium">
                      Step Therapy {result.step_therapy_required ? "Required" : "Not Required"}
                    </span>
                  </div>
                  {result.step_therapy_required && (
                    <p className="text-xs text-orange-700 ml-6 dark:text-orange-300">
                      Must demonstrate trial and failure of preferred alternatives before coverage.
                    </p>
                  )}
                </div>

                {result.formulary_notes && (
                  <div className="p-3 bg-blue-50 rounded-lg border border-blue-200 dark:bg-blue-900/20">
                    <div className="text-xs text-blue-700 dark:text-blue-300">{result.formulary_notes}</div>
                  </div>
                )}
              </div>
            </div>

            {/* Alternatives */}
            <div className="bg-white rounded-xl border border-gray-200 p-5 dark:bg-slate-800 dark:border-slate-700">
              <h4 className="text-xs font-semibold text-gray-500 uppercase mb-4">
                Formulary Alternatives ({result.alternatives.length})
              </h4>
              {result.alternatives.length > 0 ? (
                <div className="space-y-3">
                  {result.alternatives.map((alt, i) => (
                    <div key={i} className="p-3 rounded-lg border border-gray-100 hover:shadow-md transition-all dark:border-slate-700">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">{alt.name}</div>
                      {alt.brand && <div className="text-xs text-gray-500">{alt.brand}</div>}
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded dark:text-blue-300 dark:bg-blue-900/30">
                          {alt.equivalence_type}
                        </span>
                        {alt.savings_pct > 0 && (
                          <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded flex items-center gap-0.5 dark:text-emerald-300 dark:bg-green-900/30">
                            <DollarSign className="w-3 h-3" />
                            Save {alt.savings_pct.toFixed(0)}%
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-gray-400 mt-1">
                        Evidence: {alt.evidence_level}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 text-gray-400">
                  <Pill className="w-6 h-6 mx-auto mb-2" />
                  <div className="text-xs">No formulary alternatives found</div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
