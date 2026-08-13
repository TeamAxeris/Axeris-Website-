"use client";

import { ReactNode } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";

const GRID = "rgba(124,118,108,0.15)";
const AXIS = "#817a70";

export function InsightPanel({
  title,
  description,
  children,
  className = "",
  action,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
  action?: ReactNode;
}) {
  return (
    <section className={`bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 ${className}`}>
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h2 className="text-[15px] font-semibold text-slate-900 dark:text-white">{title}</h2>
          {description && <p className="text-[11.5px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function SignalCard({
  label,
  value,
  detail,
  tone = "#2f2fe6",
  icon,
}: {
  label: string;
  value: string | number;
  detail?: string;
  tone?: string;
  icon?: ReactNode;
}) {
  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 min-w-0">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] text-slate-500 dark:text-slate-400">{label}</span>
        {icon && <span style={{ color: tone }}>{icon}</span>}
      </div>
      <div className="text-[1.75rem] leading-none tracking-[-0.04em] tabular-nums text-slate-900 dark:text-white mt-3">{value}</div>
      {detail && <p className="text-[10.5px] text-slate-500 dark:text-slate-400 mt-2 leading-snug">{detail}</p>}
      <div className="h-0.5 rounded-full mt-3" style={{ background: tone, opacity: 0.7 }} />
    </div>
  );
}

export function RankedBars({
  data,
  valueFormatter = (value) => value.toLocaleString(),
  color = "#2f2fe6",
  height = 250,
}: {
  data: Array<{ label: string; value: number; color?: string; note?: string }>;
  valueFormatter?: (value: number) => string;
  color?: string;
  height?: number;
}) {
  const rows = data.slice().sort((a, b) => b.value - a.value);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={rows} layout="vertical" margin={{ top: 2, right: 22, bottom: 0, left: 0 }} barCategoryGap={8}>
        <CartesianGrid stroke={GRID} horizontal={false} />
        <XAxis type="number" hide />
        <YAxis type="category" dataKey="label" width={118} axisLine={false} tickLine={false} tick={{ fill: AXIS, fontSize: 11 }} />
        <Tooltip
          cursor={{ fill: "rgba(47,47,230,0.04)" }}
          content={({ active, payload }) => {
            const row = payload?.[0]?.payload as any;
            return active && row ? (
              <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-xl text-[11px]">
                <div className="font-semibold text-slate-900">{row.label}</div>
                <div className="text-slate-600 mt-0.5">{valueFormatter(row.value)}</div>
                {row.note && <div className="text-slate-400 mt-0.5">{row.note}</div>}
              </div>
            ) : null;
          }}
        />
        <Bar dataKey="value" radius={[0, 7, 7, 0]} isAnimationActive={false}>
          {rows.map((row) => <Cell key={row.label} fill={row.color || color} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function PriorityMap({
  data,
  height = 270,
}: {
  data: Array<{ name: string; risk: number; cost: number; size?: number; detail?: string }>;
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ScatterChart margin={{ top: 12, right: 18, bottom: 14, left: 2 }}>
        <CartesianGrid stroke={GRID} />
        <XAxis type="number" dataKey="risk" domain={[0, 1]} tick={{ fill: AXIS, fontSize: 10 }} axisLine={false} tickLine={false} name="Risk" />
        <YAxis type="number" dataKey="cost" tick={{ fill: AXIS, fontSize: 10 }} axisLine={false} tickLine={false} width={48} tickFormatter={(v) => `$${Math.round(v / 1000)}k`} name="Cost" />
        <ZAxis type="number" dataKey="size" range={[45, 220]} />
        <Tooltip
          cursor={{ strokeDasharray: "3 3" }}
          content={({ active, payload }) => {
            const row = payload?.[0]?.payload as any;
            return active && row ? (
              <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-xl text-[11px] max-w-[210px]">
                <div className="font-semibold text-slate-900">{row.name}</div>
                <div className="text-slate-600 mt-1">Signal index {Math.round(row.risk * 100)} · ${Math.round(row.cost).toLocaleString()}</div>
                {row.detail && <div className="text-slate-400 mt-0.5 truncate">{row.detail}</div>}
              </div>
            ) : null;
          }}
        />
        <Scatter data={data} fill="#2f2fe6" fillOpacity={0.72} isAnimationActive={false} />
      </ScatterChart>
    </ResponsiveContainer>
  );
}

export function StackedOutcome({ segments }: { segments: Array<{ label: string; value: number; color: string }> }) {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0) || 1;
  return (
    <div>
      <div className="h-3 rounded-full overflow-hidden flex bg-slate-100 dark:bg-slate-700">
        {segments.map((segment) => (
          <span key={segment.label} style={{ width: `${(segment.value / total) * 100}%`, background: segment.color }} />
        ))}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-4">
        {segments.map((segment) => (
          <div key={segment.label} className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-sm" style={{ background: segment.color }} />
            <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{segment.label}</span>
            <span className="ml-auto text-[11px] font-semibold tabular-nums text-slate-900 dark:text-white">{segment.value.toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
