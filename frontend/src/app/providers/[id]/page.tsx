"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { getProvider } from "@/lib/api";
import type { ProviderDetail, FlagColor } from "@/types";
import Header from "@/components/layout/Header";
import FlagBadge from "@/components/prescriptions/FlagBadge";
import { ArrowLeft, Stethoscope, Building2, Phone, Mail, MapPin, BadgeCheck, ShieldAlert, FileText, Users } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import clsx from "clsx";

export default function ProviderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [provider, setProvider] = useState<ProviderDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (params.id) {
      getProvider(params.id as string)
        .then(setProvider)
        .finally(() => setLoading(false));
    }
  }, [params.id]);

  if (loading || !provider) {
    return (
      <>
        <Header title="Provider Detail" />
        <div className="flex items-center justify-center h-64 text-gray-400">
          {loading ? "Loading..." : "Provider not found"}
        </div>
      </>
    );
  }

  const peerData = provider.peer_comparison ? [
    { name: "Total Rx", provider: provider.peer_comparison.provider_total_rx, peers: provider.peer_comparison.peer_avg_total_rx },
    { name: "Controlled", provider: provider.peer_comparison.provider_controlled, peers: provider.peer_comparison.peer_avg_controlled },
  ] : [];

  return (
    <>
      <Header title="Provider Detail" />
      <div className="mt-4">
        <button onClick={() => router.back()} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Profile & Clinic Info */}
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-gray-200 p-5 dark:bg-slate-800 dark:border-slate-700">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center dark:bg-indigo-900/30">
                  <Stethoscope className="w-6 h-6 text-indigo-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 dark:text-white">Dr. {provider.first_name} {provider.last_name}</h3>
                  <p className="text-sm text-gray-500">{provider.specialty}</p>
                </div>
                {provider.board_certified !== undefined && (
                  provider.board_certified ? (
                    <span className="flex items-center gap-1 text-xs bg-green-50 text-green-700 px-2 py-1 rounded-full border border-green-200 dark:bg-emerald-900/20 dark:text-emerald-300">
                      <BadgeCheck className="w-3.5 h-3.5" /> Certified
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs bg-red-50 text-red-700 px-2 py-1 rounded-full border border-red-200 dark:bg-red-900/20 dark:text-red-300">
                      <ShieldAlert className="w-3.5 h-3.5" /> Not Certified
                    </span>
                  )
                )}
              </div>

              {/* Clinic Details */}
              {provider.clinic_name && (
                <div className="bg-gray-50 rounded-lg p-3 mb-4 dark:bg-slate-900/40">
                  <div className="flex items-center gap-2 mb-2">
                    <Building2 className="w-4 h-4 text-gray-500" />
                    <span className="text-sm font-medium text-gray-800 dark:text-slate-200">{provider.clinic_name}</span>
                  </div>
                  {provider.clinic_address && (
                    <div className="flex items-start gap-2 text-xs text-gray-600 mb-2 dark:text-slate-400">
                      <MapPin className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-gray-400" />
                      <span>
                        {provider.clinic_address}
                        {provider.clinic_city && `, ${provider.clinic_city}`}
                        {provider.clinic_state && `, ${provider.clinic_state}`}
                        {provider.clinic_zip && ` ${provider.clinic_zip}`}
                      </span>
                    </div>
                  )}
                  <div className="space-y-1.5">
                    {provider.clinic_phone && (
                      <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-slate-400">
                        <Phone className="w-3.5 h-3.5 text-gray-400" />
                        <span>{provider.clinic_phone}</span>
                      </div>
                    )}
                    {provider.clinic_fax && (
                      <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-slate-400">
                        <FileText className="w-3.5 h-3.5 text-gray-400" />
                        <span>{provider.clinic_fax}</span>
                        <span className="text-gray-400">Fax</span>
                      </div>
                    )}
                    {provider.provider_email && (
                      <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-slate-400">
                        <Mail className="w-3.5 h-3.5 text-gray-400" />
                        <span>{provider.provider_email}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Identifiers */}
              <div className="grid grid-cols-2 gap-3 text-sm mb-4">
                <div>
                  <span className="text-xs text-gray-400">NPI</span>
                  <div className="font-mono text-gray-700 dark:text-slate-300">{provider.npi}</div>
                </div>
                {provider.dea_number && (
                  <div>
                    <span className="text-xs text-gray-400">DEA #</span>
                    <div className="font-mono text-gray-700 dark:text-slate-300">{provider.dea_number}</div>
                  </div>
                )}
                {provider.license_state && (
                  <div>
                    <span className="text-xs text-gray-400">License State</span>
                    <div className="text-gray-700 dark:text-slate-300">{provider.license_state}</div>
                  </div>
                )}
                {provider.group_practice && (
                  <div>
                    <span className="text-xs text-gray-400">Group Practice</span>
                    <div className="text-gray-700 dark:text-slate-300">{provider.group_practice}</div>
                  </div>
                )}
              </div>

              {/* Prescribing Stats */}
              <div className="space-y-2 text-sm border-t border-gray-100 pt-3 dark:border-slate-700">
                <div className="flex justify-between"><span className="text-gray-500">Total Rx</span><span className="font-medium">{provider.total_prescriptions}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Flagged</span><span className="font-medium text-red-600 dark:text-red-400">{provider.flagged_prescription_count}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Controlled Vol.</span><span className="font-medium">{provider.controlled_substance_volume}</span></div>
              </div>

              {/* Risk Gauge */}
              <div className="mt-4 p-3 rounded-lg bg-gray-50 dark:bg-slate-900/40">
                <div className="text-xs text-gray-500 mb-1">Risk Score</div>
                <div className="text-2xl font-bold" style={{ color: provider.risk_score > 0.5 ? '#ef4444' : provider.risk_score > 0.2 ? '#eab308' : '#22c55e' }}>
                  {(provider.risk_score * 100).toFixed(0)}%
                </div>
                <div className="h-2 bg-gray-200 rounded-full mt-2">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${provider.risk_score * 100}%`,
                      backgroundColor: provider.risk_score > 0.5 ? '#ef4444' : provider.risk_score > 0.2 ? '#eab308' : '#22c55e'
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Peer Comparison */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 dark:bg-slate-800 dark:border-slate-700">
            <h3 className="text-sm font-semibold text-gray-700 mb-4 dark:text-slate-300">Peer Comparison ({provider.specialty})</h3>
            <div className="h-52">
              {peerData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={peerData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="provider" fill="#6366f1" name="This Provider" />
                    <Bar dataKey="peers" fill="#d1d5db" name="Peer Average" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-gray-400 text-sm">No peer data</div>
              )}
            </div>
          </div>

          {/* Flag History */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 dark:bg-slate-800 dark:border-slate-700">
            <h3 className="text-sm font-semibold text-gray-700 mb-4 dark:text-slate-300">Flag History</h3>
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {provider.flag_history.map((fh, i) => (
                <Link key={i} href={`/prescriptions/${fh.prescription_id}`}
                  className="block p-2 rounded-lg hover:bg-gray-50 border border-gray-100 dark:border-slate-700 dark:hover:bg-slate-700/40">
                  <div className="flex items-center gap-2">
                    {fh.flag_color && <FlagBadge color={fh.flag_color as FlagColor} size="sm" />}
                    <span className="text-xs text-gray-500">{fh.date || ""}</span>
                  </div>
                  <div className="text-sm text-gray-700 mt-1 dark:text-slate-300">{fh.drug_name}</div>
                  <div className="text-xs text-gray-500 truncate">{fh.flag_summary}</div>
                </Link>
              ))}
              {provider.flag_history.length === 0 && (
                <p className="text-sm text-gray-400">No flag history</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
