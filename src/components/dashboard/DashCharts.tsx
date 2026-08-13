"use client";

/* Axeris dashboard figures — Recharts, themed to the brand.
 * Color rules (per dataviz method): single-hue blue for magnitude; reserved
 * status green/amber/red for flags, always with legend + labels; recessive
 * grid; thin marks; hover tooltips on every plot. */

import {
  Area, AreaChart, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell,
} from "recharts";

export const BLUE = "#2f2fe6";
const STATUS = { green: "#14a05a", yellow: "#c98a12", red: "#dc4b45" };
const AXIS = "#a8a196";   // warm muted — legible on cream and ink alike
const GRID = "rgba(124,118,108,0.16)";

/* ---- shared tooltip card ---- */
function TipCard({ rows }: { rows: { label: string; value: string; color?: string }[] }) {
  return (
    <div style={{
      background: "var(--color-surface)", border: "1px solid var(--color-border)",
      borderRadius: 10, padding: "8px 11px", boxShadow: "0 10px 30px -12px rgba(20,18,12,0.28)",
      fontSize: 12,
    }}>
      {rows.map((r) => (
        <div key={r.label} style={{ display: "flex", alignItems: "center", gap: 8, whiteSpace: "nowrap" }}>
          {r.color && <span style={{ width: 8, height: 8, borderRadius: 2, background: r.color, display: "inline-block" }} />}
          <span style={{ color: "var(--color-fg-subtle)" }}>{r.label}</span>
          <span style={{ marginLeft: "auto", fontWeight: 600, color: "var(--color-fg)", fontVariantNumeric: "tabular-nums" }}>{r.value}</span>
        </div>
      ))}
    </div>
  );
}

/* ---- tiny sparkline for KPI cards (single hue) ---- */
export function Sparkline({ data, color = BLUE }: { data: number[]; color?: string }) {
  const d = data.map((v, i) => ({ i, v }));
  const id = `spk-${color.replace("#", "")}`;
  return (
    <ResponsiveContainer width="100%" height={38}>
      <AreaChart data={d} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.25} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area type="monotone" dataKey="v" stroke={color} strokeWidth={2} fill={`url(#${id})`} dot={false} isAnimationActive={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/* ---- big trend area (single hue, gradient fill, hover crosshair) ---- */
export function TrendArea({ data }: { data: { period: string; total: number }[] }) {
  const fmt = (p: string) => {
    const m = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const parts = p.split("-");
    return m[(parseInt(parts[1], 10) || 1) - 1] + " " + parts[0].slice(2);
  };
  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={data} margin={{ top: 10, right: 8, bottom: 0, left: -10 }}>
        <defs>
          <linearGradient id="trendfill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={BLUE} stopOpacity={0.16} />
            <stop offset="100%" stopColor={BLUE} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="period" tickFormatter={fmt} tick={{ fill: AXIS, fontSize: 11 }} axisLine={false} tickLine={false} minTickGap={24} />
        <YAxis tick={{ fill: AXIS, fontSize: 11 }} axisLine={false} tickLine={false} width={40} />
        <Tooltip
          cursor={{ stroke: "rgba(47,47,230,0.4)", strokeWidth: 1 }}
          content={({ active, payload, label }) =>
            active && payload && payload[0]
              ? <TipCard rows={[{ label: fmt(String(label)), value: `${payload[0].value} reviewed`, color: BLUE }]} />
              : null}
        />
        <Area type="monotone" dataKey="total" stroke={BLUE} strokeWidth={2.5} fill="url(#trendfill)" dot={false}
              activeDot={{ r: 5, strokeWidth: 2, stroke: "var(--color-surface)" }} isAnimationActive={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/* ---- flag distribution donut (reserved status colors + legend) ---- */
export function FlagDonut({ green, yellow, red }: { green: number; yellow: number; red: number }) {
  const total = green + yellow + red || 1;
  const data = [
    { name: "Approved", key: "green", value: green, color: STATUS.green },
    { name: "Equivalent", key: "yellow", value: yellow, color: STATUS.yellow },
    { name: "Flagged", key: "red", value: red, color: STATUS.red },
  ];
  return (
    <div className="grid grid-cols-[128px_minmax(0,1fr)] items-center gap-4 w-full min-w-0">
      <div className="relative" style={{ width: 128, height: 128 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" innerRadius={43} outerRadius={60} paddingAngle={2} stroke="var(--color-surface)" strokeWidth={2} isAnimationActive={false}>
              {data.map((d) => <Cell key={d.key} fill={d.color} />)}
            </Pie>
            <Tooltip content={({ active, payload }) =>
              active && payload && payload[0]
                ? <TipCard rows={[{ label: (payload[0].payload as any).name, value: `${payload[0].value} · ${Math.round((Number(payload[0].value) / total) * 100)}%`, color: (payload[0].payload as any).color }]} />
                : null} />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <div className="text-[1.35rem] leading-none tracking-[-0.02em] text-slate-900 dark:text-white tabular-nums">{total.toLocaleString()}</div>
          <div className="text-[10px] text-slate-500 mt-1">claims</div>
        </div>
      </div>
      <div className="min-w-0 space-y-3">
        {data.map((d) => (
          <div key={d.key} className="grid grid-cols-[10px_minmax(0,1fr)_auto] items-center gap-x-2">
            <span className="w-2.5 h-2.5 rounded-sm" style={{ background: d.color }} />
            <span className="text-[12px] truncate text-slate-700 dark:text-slate-300">{d.name}</span>
            <span className="text-[12px] font-semibold text-slate-900 dark:text-white tabular-nums">{Math.round((d.value / total) * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---- leak drivers: sequential single-hue bars + amounts ---- */
export function LeakBars({ rows }: { rows: { label: string; value: number; display: string }[] }) {
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <div className="space-y-4">
      {rows.map((r, i) => (
        <div key={r.label}>
          <div className="flex items-baseline justify-between mb-1.5">
            <span className="text-[13px] text-slate-700 dark:text-slate-300">{r.label}</span>
            <span className="text-[13px] font-medium text-slate-900 dark:text-white tabular-nums">{r.display}</span>
          </div>
          <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(124,118,108,0.14)" }}>
            <div className="h-full rounded-full" style={{
              width: `${Math.max(6, (r.value / max) * 100)}%`,
              background: BLUE, opacity: 1 - i * 0.12,
            }} />
          </div>
        </div>
      ))}
    </div>
  );
}
