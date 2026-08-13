"use client";

import { useEffect, useState } from "react";
import { getDataSources } from "@/lib/api";
import { useSettings } from "@/context/SettingsContext";
import type { DataSource } from "@/types";
import Header from "@/components/layout/Header";
import { CardSkeleton } from "@/components/ui/Skeleton";
import {
  CheckCircle, XCircle, Settings as SettingsIcon, Wifi, WifiOff,
  Database, RefreshCw, Server, Cpu, Shield, Globe, Clock, Activity,
  AlertTriangle, RotateCcw, Save,
} from "lucide-react";
import clsx from "clsx";

const typeIcons: Record<string, typeof Database> = {
  clinical: Activity, financial: Database, pharmacy: Shield,
  reference: Globe, regulatory: Shield, ai: Cpu,
};

const typeColors: Record<string, { bg: string; text: string; border: string }> = {
  clinical: { bg: "bg-blue-50 dark:bg-blue-900/20", text: "text-blue-700 dark:text-blue-300", border: "border-blue-200 dark:border-blue-800" },
  financial: { bg: "bg-green-50 dark:bg-emerald-900/20", text: "text-green-700 dark:text-green-300", border: "border-green-200 dark:border-green-800" },
  pharmacy: { bg: "bg-purple-50 dark:bg-purple-900/20", text: "text-purple-700 dark:text-purple-300", border: "border-purple-200 dark:border-purple-800" },
  reference: { bg: "bg-orange-50 dark:bg-orange-900/20", text: "text-orange-700 dark:text-orange-300", border: "border-orange-200 dark:border-orange-800" },
  regulatory: { bg: "bg-red-50 dark:bg-red-900/20", text: "text-red-700 dark:text-red-300", border: "border-red-200 dark:border-red-800" },
  ai: { bg: "bg-indigo-50 dark:bg-indigo-900/20", text: "text-indigo-700 dark:text-indigo-300", border: "border-indigo-200 dark:border-indigo-800" },
};

export default function SettingsPage() {
  const [dataSources, setDataSources] = useState<DataSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"integrations" | "rules" | "alerts" | "mode">("mode");
  const [operatingMode, setOperatingMode] = useState<"TPA" | "PBA">("TPA");
  const [saved, setSaved] = useState(false);
  const { settings, updateSetting, resetSettings } = useSettings();

  useEffect(() => {
    getDataSources()
      .then((res) => setDataSources(res.sources))
      .finally(() => setLoading(false));
  }, []);

  const showSaved = () => { setSaved(true); setTimeout(() => setSaved(false), 2000); };

  const connectedCount = dataSources.filter((d) => d.status === "connected" || d.status === "demo_mode").length;
  const totalRecords = dataSources.reduce((sum, d) => sum + (d.records_synced || 0), 0);

  return (
    <>
      <Header title="Settings & Integrations" />
      <div className="mt-4 space-y-6">
        {saved && (
          <div className="fixed top-4 right-4 z-50 bg-green-600 text-white text-sm px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 animate-fade-in">
            <Save className="w-4 h-4" /> Settings saved
          </div>
        )}

        <div className="flex gap-1 bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-1 w-fit">
          {[
            { id: "mode" as const, label: "Operating Mode (TPA/PBA)" },
            { id: "integrations" as const, label: "Data Sources & Integrations" },
            { id: "rules" as const, label: "Rule Thresholds" },
            { id: "alerts" as const, label: "Alert Preferences" },
          ].map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={clsx("px-4 py-2 rounded-md text-sm font-medium transition-colors",
                activeTab === tab.id ? "bg-slate-900 text-white" : "text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700/40")}>
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "mode" && (
          <div className="space-y-4">
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-5">
              <div className="flex items-start gap-3">
                <Cpu className="w-6 h-6 text-blue-600 mt-0.5 flex-shrink-0 dark:text-blue-400" />
                <div>
                  <h2 className="text-lg font-bold text-gray-900 dark:text-white">Axeris Operating Mode</h2>
                  <p className="text-sm text-gray-600 dark:text-slate-400 mt-1">
                    Axeris operates in two modes depending on where it plugs in. The selection determines hold semantics, latency targets, and the available value levers.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* TPA Mode */}
              <button
                onClick={() => { setOperatingMode("TPA"); showSaved(); }}
                className={clsx(
                  "text-left bg-white dark:bg-slate-800 rounded-xl border-2 p-5 transition-all",
                  operatingMode === "TPA"
                    ? "border-blue-600 shadow-lg shadow-blue-600/10"
                    : "border-gray-200 dark:border-slate-700 hover:border-blue-300"
                )}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className={clsx("px-2 py-0.5 rounded-md text-xs font-bold",
                    operatingMode === "TPA" ? "bg-blue-600 text-white" : "bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-300")}>
                    TPA Mode
                  </span>
                  <span className="text-xs text-gray-500">Primary mode</span>
                </div>
                <h3 className="font-bold text-gray-900 dark:text-white">Post-Adjudication Pre-Payment Review</h3>
                <p className="text-sm text-gray-600 dark:text-slate-400 mt-2">
                  PBM adjudicates and pharmacy dispenses in real time. Axeris intercepts the batch claim before
                  the employer&apos;s general fund is swept to the PBM.
                </p>
                <ul className="text-xs text-gray-700 dark:text-slate-300 mt-3 space-y-1">
                  <li>· Latency target: batch (24-48h SLA)</li>
                  <li>· Value: financial recovery, prescriber pattern enforcement</li>
                  <li>· Hold semantics: soft (REVIEW, 24h auto-release) + hard (FLAG)</li>
                  <li>· Mechanism: ASA pend rules; TPA pend infrastructure</li>
                </ul>
              </button>

              {/* PBA Mode */}
              <button
                onClick={() => { setOperatingMode("PBA"); showSaved(); }}
                className={clsx(
                  "text-left bg-white dark:bg-slate-800 rounded-xl border-2 p-5 transition-all",
                  operatingMode === "PBA"
                    ? "border-purple-600 shadow-lg shadow-purple-600/10"
                    : "border-gray-200 dark:border-slate-700 hover:border-purple-300"
                )}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className={clsx("px-2 py-0.5 rounded-md text-xs font-bold",
                    operatingMode === "PBA" ? "bg-purple-600 text-white" : "bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-300")}>
                    PBA Mode
                  </span>
                  <span className="text-xs text-gray-500">Real-time</span>
                </div>
                <h3 className="font-bold text-gray-900 dark:text-white">Real-Time Pre-Dispense Adjudication</h3>
                <p className="text-sm text-gray-600 dark:text-slate-400 mt-2">
                  Axeris embedded inside a transparent PBM&apos;s adjudication stack. Fires within the
                  sub-200ms NCPDP D.0 window so flags can prevent dispensing.
                </p>
                <ul className="text-xs text-gray-700 dark:text-slate-300 mt-3 space-y-1">
                  <li>· Latency target: &lt;200ms (Engines 1+2)</li>
                  <li>· Value: real-time clinical safety intervention</li>
                  <li>· Hard stops on Checks 1, 4, 6, 15</li>
                  <li>· Requires PBA partnership (Capital Rx, SmithRx, Navitus, etc.)</li>
                </ul>
              </button>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-5">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-3">Disposition Mapping</h3>
              <div className="space-y-2 text-sm">
                <div className="flex items-start gap-3">
                  <span className="px-2 py-0.5 rounded font-bold text-emerald-700 bg-emerald-100 min-w-[80px] text-center dark:text-emerald-300 dark:bg-emerald-900/30">APPROVE</span>
                  <span className="text-gray-600 dark:text-slate-400">Auto-payment authorization. No reviewer action required.</span>
                </div>
                <div className="flex items-start gap-3">
                  <span className="px-2 py-0.5 rounded font-bold text-amber-700 bg-amber-100 min-w-[80px] text-center dark:text-amber-300 dark:bg-amber-900/30">REVIEW</span>
                  <span className="text-gray-600 dark:text-slate-400">Soft hold with SLA auto-release (24h default). Examples: brand-when-generic, moderate DDI, step therapy.</span>
                </div>
                <div className="flex items-start gap-3">
                  <span className="px-2 py-0.5 rounded font-bold text-red-700 bg-red-100 min-w-[80px] text-center dark:text-red-300 dark:bg-red-900/30">FLAG</span>
                  <span className="text-gray-600 dark:text-slate-400">Hard hold; explicit pharmacist resolution required. Examples: contraindicated DDI, opioid + benzo, fraud indicators.</span>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
              <div className="text-xs text-amber-800 dark:text-amber-200">
                <strong>Note:</strong> ERISA § 404(a)(1)(B) audit trail is generated for every claim regardless of mode.
                Every flag includes engine, evidence source, severity, and weight · producible in response to DOL inquiry or participant appeal.
              </div>
            </div>
          </div>
        )}

        {activeTab === "integrations" && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              {[
                { icon: Server, label: "Total Sources", value: dataSources.length, color: "text-gray-500" },
                { icon: Wifi, label: "Connected", value: connectedCount, color: "text-green-500" },
                { icon: WifiOff, label: "Disconnected", value: dataSources.length - connectedCount, color: "text-red-500" },
                { icon: Database, label: "Records Synced", value: totalRecords.toLocaleString(), color: "text-blue-500" },
              ].map((s, i) => (
                <div key={i} className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <s.icon className={clsx("w-4 h-4", s.color)} />
                    <span className="text-xs text-gray-500">{s.label}</span>
                  </div>
                  <div className={clsx("text-2xl font-bold", s.color === "text-green-500" ? "text-green-600 dark:text-emerald-400" : s.color === "text-red-500" ? "text-red-600 dark:text-red-400" : s.color === "text-blue-500" ? "text-blue-600 dark:text-blue-400" : "text-gray-900 dark:text-white")}>{s.value}</div>
                </div>
              ))}
            </div>

            {loading ? (
              <div className="space-y-3">{[1, 2, 3].map((i) => <CardSkeleton key={i} />)}</div>
            ) : (
              <div className="space-y-3">
                {dataSources.map((source) => {
                  const TypeIcon = typeIcons[source.type] || Server;
                  const colors = typeColors[source.type] || typeColors.clinical;
                  const isConnected = source.status === "connected" || source.status === "demo_mode";
                  return (
                    <div key={source.id} className={clsx("bg-white dark:bg-slate-800 rounded-xl border p-5 transition-all hover:shadow-md", isConnected ? "border-gray-200 dark:border-slate-700" : "border-red-200 dark:border-red-800 bg-red-50/30 dark:bg-red-900/20")}>
                      <div className="flex items-start gap-4">
                        <div className={clsx("w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0", colors.bg)}>
                          <TypeIcon className={clsx("w-5 h-5", colors.text)} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-1">
                            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{source.name}</h3>
                            {isConnected ? (
                              <span className="flex items-center gap-1 text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium dark:text-emerald-300 dark:bg-green-900/30">
                                {source.status === "demo_mode" ? <><AlertTriangle className="w-3 h-3" /> Demo Mode</> : <><CheckCircle className="w-3 h-3" /> Connected</>}
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-[10px] bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium dark:text-red-300 dark:bg-red-900/30"><XCircle className="w-3 h-3" /> Not Connected</span>
                            )}
                            <span className={clsx("text-[10px] px-2 py-0.5 rounded-full font-medium border", colors.bg, colors.text, colors.border)}>{source.type}</span>
                          </div>
                          <p className="text-xs text-gray-500 mb-2">{source.description}</p>
                          <div className="flex items-center gap-4 text-[11px] text-gray-400">
                            <span className="flex items-center gap-1"><Shield className="w-3 h-3" /> {source.protocol}</span>
                            {source.last_sync && <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> Last sync: {new Date(source.last_sync).toLocaleString()}</span>}
                            {source.records_synced !== undefined && source.records_synced !== null && <span className="flex items-center gap-1"><Database className="w-3 h-3" /> {source.records_synced.toLocaleString()} records</span>}
                          </div>
                          {source.endpoint && <div className="mt-1.5 text-[10px] font-mono text-gray-400 truncate">{source.endpoint}</div>}
                        </div>
                        <div className="flex-shrink-0">
                          <button className={clsx("text-xs px-3 py-1.5 rounded-lg font-medium transition-colors", isConnected ? "bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-600" : "bg-blue-600 text-white hover:bg-blue-700")}>
                            {isConnected ? <span className="flex items-center gap-1"><RefreshCw className="w-3 h-3" /> Sync</span> : "Connect"}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === "rules" && (
          <div className="max-w-3xl space-y-6">
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300 flex items-center gap-2"><SettingsIcon className="w-4 h-4" /> Rule Thresholds</h3>
                <button onClick={() => { resetSettings(); showSaved(); }} className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-slate-200 flex items-center gap-1"><RotateCcw className="w-3 h-3" /> Reset</button>
              </div>
              <div className="space-y-5">
                <div>
                  <label className="text-sm text-gray-600 dark:text-slate-400 block mb-1">RED Flag Threshold</label>
                  <input type="range" min="0.5" max="0.9" step="0.05" value={settings.redThreshold}
                    onChange={(e) => { updateSetting("redThreshold", parseFloat(e.target.value)); showSaved(); }} className="w-full accent-red-500" />
                  <div className="text-xs text-gray-500 mt-1">Current: <strong>{settings.redThreshold.toFixed(2)}</strong></div>
                </div>
                <div>
                  <label className="text-sm text-gray-600 dark:text-slate-400 block mb-1">YELLOW Flag Threshold</label>
                  <input type="range" min="0.1" max="0.5" step="0.05" value={settings.yellowThreshold}
                    onChange={(e) => { updateSetting("yellowThreshold", parseFloat(e.target.value)); showSaved(); }} className="w-full accent-yellow-500" />
                  <div className="text-xs text-gray-500 mt-1">Current: <strong>{settings.yellowThreshold.toFixed(2)}</strong></div>
                </div>
                <div>
                  <label className="text-sm text-gray-600 dark:text-slate-400 block mb-1">Polypharmacy Threshold</label>
                  <input type="range" min="3" max="10" step="1" value={settings.polypharmacyThreshold}
                    onChange={(e) => { updateSetting("polypharmacyThreshold", parseInt(e.target.value)); showSaved(); }} className="w-full accent-blue-500" />
                  <div className="text-xs text-gray-500 mt-1">Current: <strong>{settings.polypharmacyThreshold}</strong> medications</div>
                </div>
                <div>
                  <label className="text-sm text-gray-600 dark:text-slate-400 block mb-1">Doctor Shopping Threshold</label>
                  <input type="range" min="2" max="6" step="1" value={settings.doctorShoppingThreshold}
                    onChange={(e) => { updateSetting("doctorShoppingThreshold", parseInt(e.target.value)); showSaved(); }} className="w-full accent-purple-500" />
                  <div className="text-xs text-gray-500 mt-1">Current: <strong>{settings.doctorShoppingThreshold}</strong> providers</div>
                </div>
              </div>
            </div>

            {/* AI Engine Configuration intentionally hidden · model
                selection, confidence threshold, and copilot toggles are
                managed in the backend ML config and shouldn't be exposed
                to reviewers as a tuning surface. */}
          </div>
        )}

        {activeTab === "alerts" && (
          <div className="max-w-3xl space-y-6">
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-6">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-4">Notification Channels</h3>
              <div className="space-y-3">
                {([
                  ["emailRedFlags", "Email notifications for RED flags"],
                  ["emailYellowFlags", "Email notifications for YELLOW flags"],
                  ["realtimeDashboard", "Real-time dashboard alerts"],
                  ["prescriberNotifications", "Prescriber notifications"],
                  ["paStatusNotifications", "PA status change notifications"],
                  ["fraudSiuAlerts", "Fraud/abuse SIU alerts"],
                ] as const).map(([key, label]) => (
                  <label key={key} className="flex items-center justify-between cursor-pointer">
                    <span className="text-sm text-gray-600 dark:text-slate-400">{label}</span>
                    <input type="checkbox" checked={settings[key] as boolean} onChange={(e) => { updateSetting(key, e.target.checked); showSaved(); }} className="w-4 h-4 accent-blue-600" />
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl p-4 max-w-3xl">
          <p className="text-xs text-yellow-800 dark:text-yellow-200">
            This is a prototype using simulated data and connections. All patient information, prescriptions, data source
            endpoints, and clinical data are fictional. Not for clinical use. AI responses require pharmacist/physician verification.
          </p>
        </div>
      </div>
    </>
  );
}
