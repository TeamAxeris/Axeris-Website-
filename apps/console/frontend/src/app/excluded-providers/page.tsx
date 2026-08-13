"use client";

import { useEffect, useState } from "react";
import { ShieldAlert, Search, Database, AlertOctagon } from "lucide-react";

interface Excluded {
  id: number;
  npi?: string;
  last_name?: string;
  first_name?: string;
  business_name?: string;
  exclusion_source: string;
  exclusion_type: string;
  exclusion_date?: string;
  reinstatement_date?: string;
  reason_code?: string;
  reason_description?: string;
  state?: string;
}

export default function ExcludedProvidersPage() {
  const [list, setList] = useState<Excluded[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterSource, setFilterSource] = useState("");
  const [search, setSearch] = useState("");
  const [npiCheck, setNpiCheck] = useState("");
  const [npiResult, setNpiResult] = useState<any>(null);

  useEffect(() => {
    setLoading(true);
    const url = filterSource
      ? `/api/v1/v8/excluded-providers?source=${filterSource}`
      : "/api/v1/v8/excluded-providers";
    fetch(url)
      .then(r => r.json())
      .then(d => setList(Array.isArray(d) ? d : []))
      .catch(() => setList([]))
      .finally(() => setLoading(false));
  }, [filterSource]);

  const filtered = list.filter(e => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (e.npi || "").includes(q) ||
      (e.last_name || "").toLowerCase().includes(q) ||
      (e.first_name || "").toLowerCase().includes(q) ||
      (e.reason_description || "").toLowerCase().includes(q)
    );
  });

  const checkNpi = async () => {
    if (!npiCheck) return;
    try {
      const res = await fetch(`/api/v1/v8/excluded-providers/check/${encodeURIComponent(npiCheck)}`).then(r => r.json());
      setNpiResult(res);
    } catch {
      setNpiResult({ error: "Lookup failed · backend unreachable." });
    }
  };

  return (
    <div>
      <div className="space-y-6">
        <div>
          <div className="flex items-center gap-3">
            <ShieldAlert className="w-7 h-7 text-rose-600" />
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Excluded Provider Screening</h1>
            <span className="text-xs bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-full font-semibold">v8 Foundational</span>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Real-time NPI cross-reference against HHS-OIG LEIE (monthly) and SAM.gov (daily). Hard-stop screening on every claim.
          </p>
        </div>

        {/* NPI lookup */}
        <div className="bg-gradient-to-r from-rose-50 to-red-50 dark:from-rose-900/20 dark:to-red-900/20 border border-rose-200 dark:border-rose-800 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Search className="w-4 h-4 text-rose-600" />
            <h3 className="font-semibold text-gray-900 dark:text-white">Real-time NPI Exclusion Check</h3>
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={npiCheck}
              onChange={(e) => setNpiCheck(e.target.value)}
              placeholder="Enter 10-digit NPI to check (try: 1234567890)"
              className="flex-1 px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
            />
            <button onClick={checkNpi}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-md text-sm font-semibold">
              Check NPI
            </button>
          </div>
          {npiResult && (
            <div className={`mt-3 p-3 rounded-md text-sm ${
              npiResult.is_excluded
                ? "bg-red-100 dark:bg-red-900/40 text-red-900 dark:text-red-200 border border-red-300 dark:border-red-700"
                : "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-900 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-700"
            }`}>
              {npiResult.is_excluded ? (
                <>
                  <div className="font-bold flex items-center gap-2"><AlertOctagon className="w-4 h-4" /> EXCLUDED · Block payment</div>
                  <div className="mt-1">NPI: <strong>{npiResult.npi}</strong></div>
                  <div>Source: {npiResult.source} · Excluded: {npiResult.exclusion_date}</div>
                  <div>Reason: {npiResult.reason}</div>
                </>
              ) : (
                <div className="font-semibold">NPI {npiResult.npi} is NOT on federal exclusion lists. Payment may proceed.</div>
              )}
            </div>
          )}
        </div>

        {/* Filters */}
        <div className="flex gap-3 items-center">
          <Database className="w-4 h-4 text-gray-400" />
          <select
            value={filterSource}
            onChange={(e) => setFilterSource(e.target.value)}
            className="px-3 py-1.5 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white"
          >
            <option value="">All Sources</option>
            <option value="LEIE">HHS-OIG LEIE</option>
            <option value="SAM_GOV">SAM.gov</option>
          </select>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by NPI, name, reason…"
            className="flex-1 px-3 py-1.5 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white"
          />
          <span className="text-sm text-gray-500">{filtered.length} entries</span>
        </div>

        {/* Table */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-gray-500">Loading exclusion list…</div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-gray-500">No matching exclusion entries.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-900 text-xs uppercase font-semibold text-gray-500 dark:text-gray-400">
                <tr>
                  <th className="px-4 py-3 text-left">NPI</th>
                  <th className="px-4 py-3 text-left">Name</th>
                  <th className="px-4 py-3 text-left">Source</th>
                  <th className="px-4 py-3 text-left">Type</th>
                  <th className="px-4 py-3 text-left">Excluded</th>
                  <th className="px-4 py-3 text-left">Reinstate</th>
                  <th className="px-4 py-3 text-left">Reason</th>
                  <th className="px-4 py-3 text-left">State</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {filtered.map((e) => (
                  <tr key={e.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                    <td className="px-4 py-3 font-mono text-xs text-gray-700 dark:text-gray-300">{e.npi || "·"}</td>
                    <td className="px-4 py-3 text-gray-900 dark:text-white font-medium">
                      {e.last_name}, {e.first_name}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded font-semibold ${
                        e.exclusion_source === "LEIE"
                          ? "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200"
                          : "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200"
                      }`}>{e.exclusion_source}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600 dark:text-gray-400 capitalize">{e.exclusion_type}</td>
                    <td className="px-4 py-3 text-xs text-gray-600 dark:text-gray-400">{e.exclusion_date || "·"}</td>
                    <td className="px-4 py-3 text-xs text-gray-600 dark:text-gray-400">{e.reinstatement_date || "Permanent"}</td>
                    <td className="px-4 py-3 text-xs text-gray-700 dark:text-gray-300">{e.reason_description}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{e.state || "·"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
