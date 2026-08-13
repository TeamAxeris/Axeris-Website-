"use client";

import { useEffect, useState } from "react";
import { getSavings, getTrends, getFraud } from "@/lib/api";
import type { SavingsData, TrendData, FraudMetrics } from "@/types";
import Header from "@/components/layout/Header";
import Link from "next/link";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from "recharts";

export default function AnalyticsPage() {
  const [savings, setSavings] = useState<SavingsData[]>([]);
  const [trends, setTrends] = useState<TrendData[]>([]);
  const [fraud, setFraud] = useState<FraudMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getSavings(), getTrends(), getFraud()])
      .then(([s, t, f]) => {
        setSavings(s);
        setTrends(t);
        setFraud(f);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <>
        <Header title="Analytics" />
        <div className="flex items-center justify-center h-64 text-gray-400">Loading analytics...</div>
      </>
    );
  }

  return (
    <>
      <Header title="Analytics" />
      <div className="mt-4 space-y-6">
        {/* Cost Savings */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 dark:bg-slate-800 dark:border-slate-700">
          <h3 className="text-sm font-semibold text-gray-700 mb-4 dark:text-slate-300">Cost Savings Over Time</h3>
          <div className="h-72">
            {savings.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={savings}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="period" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `$${v}`} />
                  <Tooltip formatter={(v: number) => [`$${v.toFixed(2)}`, ""]} />
                  <Legend />
                  <Line type="monotone" dataKey="potential_savings" stroke="#3b82f6" name="Potential Savings" strokeWidth={2} />
                  <Line type="monotone" dataKey="realized_savings" stroke="#22c55e" name="Realized Savings" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-400">No savings data</div>
            )}
          </div>
        </div>

        {/* Flag Trends */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 dark:bg-slate-800 dark:border-slate-700">
          <h3 className="text-sm font-semibold text-gray-700 mb-4 dark:text-slate-300">Flag Trends</h3>
          <div className="h-72">
            {trends.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trends}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="period" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="green_count" stackId="a" fill="#22c55e" name="Appropriate" />
                  <Bar dataKey="yellow_count" stackId="a" fill="#eab308" name="Review" />
                  <Bar dataKey="red_count" stackId="a" fill="#ef4444" name="High Risk" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-400">No trend data</div>
            )}
          </div>
        </div>

        {fraud && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Flagged Prescribers */}
            <div className="bg-white rounded-xl border border-gray-200 p-5 dark:bg-slate-800 dark:border-slate-700">
              <h3 className="text-sm font-semibold text-gray-700 mb-4 dark:text-slate-300">Flagged Prescribers</h3>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-slate-700">
                    <th className="text-left text-xs font-medium text-gray-500 pb-2">Provider</th>
                    <th className="text-left text-xs font-medium text-gray-500 pb-2">Specialty</th>
                    <th className="text-right text-xs font-medium text-gray-500 pb-2">Controlled</th>
                    <th className="text-right text-xs font-medium text-gray-500 pb-2">Risk</th>
                  </tr>
                </thead>
                <tbody>
                  {fraud.flagged_prescribers.map((fp) => (
                    <tr key={fp.provider_id} className="border-b border-gray-50">
                      <td className="py-2">
                        <Link href={`/console/providers/${fp.provider_id}`} className="text-sm text-blue-600 hover:underline dark:text-blue-400">
                          {fp.provider_name}
                        </Link>
                      </td>
                      <td className="py-2 text-xs text-gray-500">{fp.specialty}</td>
                      <td className="py-2 text-sm text-right">{fp.controlled_volume}</td>
                      <td className="py-2 text-right">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded ${fp.risk_score > 0.5 ? "bg-red-100 text-red-700 dark:text-red-300 dark:bg-red-900/30" : "bg-yellow-100 text-yellow-700 dark:text-yellow-300 dark:bg-yellow-900/30"}`}>
                          {(fp.risk_score * 100).toFixed(0)}%
                        </span>
                      </td>
                    </tr>
                  ))}
                  {fraud.flagged_prescribers.length === 0 && (
                    <tr><td colSpan={4} className="py-4 text-center text-gray-400 text-sm">No flagged prescribers</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Doctor Shopping */}
            <div className="bg-white rounded-xl border border-gray-200 p-5 dark:bg-slate-800 dark:border-slate-700">
              <h3 className="text-sm font-semibold text-gray-700 mb-4 dark:text-slate-300">Doctor Shopping Detection</h3>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-slate-700">
                    <th className="text-left text-xs font-medium text-gray-500 pb-2">Patient</th>
                    <th className="text-right text-xs font-medium text-gray-500 pb-2">Providers</th>
                    <th className="text-right text-xs font-medium text-gray-500 pb-2">Controlled Rx</th>
                  </tr>
                </thead>
                <tbody>
                  {fraud.doctor_shopping_patients.map((ds) => (
                    <tr key={ds.patient_id} className="border-b border-gray-50">
                      <td className="py-2">
                        <Link href={`/console/patients/${ds.patient_id}`} className="text-sm text-blue-600 hover:underline dark:text-blue-400">
                          {ds.patient_name}
                        </Link>
                      </td>
                      <td className="py-2 text-sm text-right font-medium text-red-600 dark:text-red-400">{ds.provider_count}</td>
                      <td className="py-2 text-sm text-right">{ds.controlled_rx_count}</td>
                    </tr>
                  ))}
                  {fraud.doctor_shopping_patients.length === 0 && (
                    <tr><td colSpan={3} className="py-4 text-center text-gray-400 text-sm">No doctor shopping detected</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
