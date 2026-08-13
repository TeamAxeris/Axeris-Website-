"use client";

import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ComposedChart,
  Line, Pie, PieChart, ReferenceLine, ResponsiveContainer, Scatter,
  ScatterChart, Tooltip, XAxis, YAxis,
} from "recharts";
import { ArrowDownRight, ArrowRight, CheckCircle2, Clock3, Radio, ShieldCheck, Sparkles, Zap } from "lucide-react";

const money = (n: number) => n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}m` : n >= 1_000 ? `$${Math.round(n / 1_000)}k` : `$${Math.round(n)}`;
const colors = ["#4f46e5", "#14b8a6", "#f59e0b", "#f43f5e", "#8b5cf6"];

function Frame({ eyebrow, title, note, children, className = "" }: { eyebrow: string; title: string; note?: string; children: React.ReactNode; className?: string }) {
  return <section className={`overflow-hidden rounded-[24px] border border-slate-200/80 bg-white shadow-[0_18px_55px_-38px_rgba(15,23,42,.55)] dark:border-slate-700 dark:bg-slate-900 ${className}`}>
    <div className="flex items-start justify-between gap-4 px-5 pt-5">
      <div><p className="text-[10px] font-bold uppercase tracking-[.2em] text-indigo-500">{eyebrow}</p><h2 className="mt-1 text-[17px] font-semibold tracking-tight text-slate-950 dark:text-white">{title}</h2></div>
      {note && <p className="max-w-[260px] text-right text-[11px] leading-4 text-slate-500 dark:text-slate-400">{note}</p>}
    </div>
    <div className="p-5 pt-4">{children}</div>
  </section>;
}

const Tip = ({ active, payload, label }: any) => active && payload?.length ? <div className="rounded-xl border border-slate-200 bg-white/95 px-3 py-2 text-[11px] shadow-xl backdrop-blur dark:border-slate-700 dark:bg-slate-900/95"><div className="mb-1 font-semibold text-slate-900 dark:text-white">{label}</div>{payload.map((p: any) => <div key={p.dataKey} style={{ color: p.color }}>{p.name}: {typeof p.value === "number" ? p.value.toLocaleString() : p.value}</div>)}</div> : null;

export function PbaRealtimePulse({ items, avg, p95 }: { items: any[]; avg: number; p95: number }) {
  const source = [...items].reverse().slice(-24);
  const chart = source.map((x, i) => ({ t: i + 1, latency: x.latency_ms, target: 200 }));
  const outcomes = [
    { name: "Paid", value: items.filter(x => x.transaction_status === "PAID").length, color: "#10b981" },
    { name: "Soft edit", value: items.filter(x => x.transaction_status === "SOFT_EDIT").length, color: "#f59e0b" },
    { name: "Stopped", value: items.filter(x => x.transaction_status === "REJECT").length, color: "#f43f5e" },
  ];
  return <div className="grid gap-4 lg:grid-cols-[1.65fr_1fr]">
    <Frame eyebrow="Live performance" title="Adjudication pulse" note="Every transaction stays visible against the 200ms response target.">
      <div className="mb-3 flex gap-6"><div><span className="text-2xl font-semibold tabular-nums">{avg}<small className="text-xs text-slate-400">ms avg</small></span></div><div><span className="text-2xl font-semibold tabular-nums">{p95}<small className="text-xs text-slate-400">ms p95</small></span></div></div>
      <div className="h-48"><ResponsiveContainer width="100%" height="100%"><AreaChart data={chart}><defs><linearGradient id="pulseFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#4f46e5" stopOpacity=".38"/><stop offset="1" stopColor="#4f46e5" stopOpacity="0"/></linearGradient></defs><CartesianGrid vertical={false} stroke="#e2e8f0" strokeDasharray="3 4"/><XAxis dataKey="t" hide/><YAxis width={34} tick={{fontSize:10}} domain={[0, "dataMax + 35"]}/><Tooltip content={<Tip/>}/><ReferenceLine y={200} stroke="#f43f5e" strokeDasharray="5 5"/><Area type="monotone" dataKey="latency" name="Latency ms" stroke="#4f46e5" strokeWidth={2.5} fill="url(#pulseFill)"/></AreaChart></ResponsiveContainer></div>
    </Frame>
    <Frame eyebrow="Decision mix" title="What the network returned">
      <div className="relative mx-auto h-40 max-w-[240px]"><ResponsiveContainer><PieChart><Pie data={outcomes} dataKey="value" innerRadius={48} outerRadius={69} paddingAngle={4}>{outcomes.map(x => <Cell key={x.name} fill={x.color}/>)}</Pie><Tooltip content={<Tip/>}/></PieChart></ResponsiveContainer><div className="pointer-events-none absolute inset-0 grid place-content-center text-center"><b className="text-2xl">{items.length}</b><span className="text-[10px] uppercase tracking-wider text-slate-400">claims</span></div></div>
      <div className="mt-2 grid grid-cols-3 gap-2">{outcomes.map(x => <div key={x.name} className="rounded-xl bg-slate-50 p-2 text-center dark:bg-slate-800"><div className="text-lg font-semibold" style={{color:x.color}}>{x.value}</div><div className="text-[10px] text-slate-500">{x.name}</div></div>)}</div>
    </Frame>
  </div>;
}

export function PbaRejectPareto({ data }: { data: any[] }) {
  let running = 0; const total = data.reduce((s, x) => s + x.count, 0);
  const chart = data.map(x => ({ ...x, label: `${x.code} · ${x.description.split(" ").slice(0,2).join(" ")}`, cumulative: Math.round((running += x.count) / total * 100) }));
  return <Frame eyebrow="Pareto view" title="A few codes drive nearly every stop" note="Bars show volume; the line shows cumulative share of all rejects."><div className="h-64"><ResponsiveContainer><ComposedChart data={chart} margin={{left:-10,right:10}}><CartesianGrid vertical={false} stroke="#e2e8f0" strokeDasharray="3 4"/><XAxis dataKey="code" tick={{fontSize:11}}/><YAxis yAxisId="count" tick={{fontSize:10}}/><YAxis yAxisId="pct" orientation="right" domain={[0,100]} tickFormatter={v=>`${v}%`} tick={{fontSize:10}}/><Tooltip content={<Tip/>}/><Bar yAxisId="count" dataKey="count" name="Stops" fill="#fb7185" radius={[8,8,2,2]}/><Line yAxisId="pct" type="monotone" dataKey="cumulative" name="Cumulative %" stroke="#4f46e5" strokeWidth={3} dot={{r:3,fill:"#4f46e5"}}/></ComposedChart></ResponsiveContainer></div></Frame>;
}

export function PbaCallbackLanes({ items }: { items: any[] }) {
  const defs = [{key:"queued",label:"Queued",tone:"bg-rose-500"},{key:"waiting_prescriber",label:"With prescriber",tone:"bg-amber-500"},{key:"in_progress",label:"In progress",tone:"bg-indigo-500"},{key:"resolved",label:"Resolved",tone:"bg-emerald-500"}];
  return <Frame eyebrow="Queue movement" title="Outreach lanes" note="A visual handoff from safety edit to recorded resolution."><div className="grid gap-3 md:grid-cols-4">{defs.map((d,i)=>{const matches=items.filter(x=>x.callback_status===d.key);return <div key={d.key} className="relative rounded-2xl bg-slate-50 p-4 dark:bg-slate-800">{i<defs.length-1&&<ArrowRight className="absolute -right-4 top-7 z-10 hidden h-4 w-4 text-slate-300 md:block"/>}<div className={`mb-4 h-1.5 w-9 rounded-full ${d.tone}`}/><div className="text-3xl font-semibold tabular-nums">{matches.length}</div><div className="text-xs font-semibold text-slate-700 dark:text-slate-200">{d.label}</div><div className="mt-4 space-y-1.5">{matches.slice(0,3).map(x=><div key={x.rx_id} className="truncate rounded-lg bg-white px-2 py-1.5 text-[10px] text-slate-500 shadow-sm dark:bg-slate-900">{x.drug_name}</div>)}</div></div>})}</div></Frame>;
}

export function PbaSavingsPortfolio({ data }: { data: any }) {
  const types = data.by_type.map((x:any,i:number)=>({...x,label:x.type.replace(/_/g," "),color:colors[i]}));
  return <div className="grid gap-4 lg:grid-cols-[1fr_1.3fr]">
    <Frame eyebrow="Savings mix" title="Where the opportunity sits"><div className="relative h-52"><ResponsiveContainer><PieChart><Pie data={types} dataKey="annualized_savings_usd" nameKey="label" innerRadius={58} outerRadius={88} paddingAngle={3}>{types.map((x:any)=><Cell key={x.type} fill={x.color}/>)}</Pie><Tooltip formatter={(v:any)=>money(Number(v))}/></PieChart></ResponsiveContainer><div className="absolute inset-0 grid place-content-center text-center"><b className="text-2xl">{money(data.identified_annualized_usd)}</b><span className="text-[10px] uppercase text-slate-400">annualized</span></div></div></Frame>
    <Frame eyebrow="Conversion runway" title="Move value from identified to realized" note="Each card is sized by annual opportunity, not raw claim count."><div className="space-y-3">{types.map((x:any)=><div key={x.type} className="rounded-2xl border border-slate-100 p-4 dark:border-slate-800"><div className="mb-2 flex items-center justify-between"><span className="text-xs font-semibold capitalize">{x.label}</span><b>{money(x.annualized_savings_usd)}</b></div><div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div className="h-full rounded-full" style={{width:`${Math.max(5,x.annualized_savings_usd/data.identified_annualized_usd*100)}%`,background:x.color}}/></div><div className="mt-2 text-[10px] text-slate-500">{x.count} opportunities ready for review</div></div>)}</div></Frame>
  </div>;
}

export function PbaSplitFillShield({ summary }: { summary: any }) {
  const avoidedPct = Math.round(summary.expected_waste_avoided_usd / summary.waste_at_risk_usd * 100);
  return <Frame eyebrow="Waste protection" title="A smaller first fill protects the plan" note="Split-fill exposure shown as a simple before-and-after risk path."><div className="grid items-center gap-6 md:grid-cols-[1fr_auto_1fr]"><div className="rounded-3xl bg-rose-50 p-6 dark:bg-rose-950/20"><div className="text-[10px] font-bold uppercase tracking-widest text-rose-500">Full-fill risk</div><div className="mt-2 text-3xl font-semibold text-rose-700">{money(summary.waste_at_risk_usd)}</div><div className="mt-5 h-4 overflow-hidden rounded-full bg-rose-100"><div className="h-full w-full bg-gradient-to-r from-rose-400 to-rose-600"/></div></div><ArrowDownRight className="mx-auto h-7 w-7 rotate-[-45deg] text-slate-300"/><div className="rounded-3xl bg-emerald-50 p-6 dark:bg-emerald-950/20"><div className="text-[10px] font-bold uppercase tracking-widest text-emerald-600">Protected value</div><div className="mt-2 text-3xl font-semibold text-emerald-700">{money(summary.expected_waste_avoided_usd)}</div><div className="mt-5 h-4 overflow-hidden rounded-full bg-emerald-100"><div className="h-full bg-gradient-to-r from-emerald-400 to-teal-500" style={{width:`${avoidedPct}%`}}/></div><div className="mt-2 text-xs text-emerald-700">{avoidedPct}% of waste exposure removed</div></div></div></Frame>;
}

export function PbaSiteOfCareDumbbell({ items }: { items:any[] }) {
  const top=[...items].sort((a,b)=>b.annualized_savings_usd-a.annualized_savings_usd).slice(0,6); const max=Math.max(...top.map(x=>x.per_infusion_hopd_usd));
  return <Frame eyebrow="Cost relocation" title="Same therapy, lower-cost setting" note="HOPD price at right; proposed site at left. The span is avoidable cost."><div className="space-y-4">{top.map(x=>{const left=x.per_infusion_home_usd/max*100,right=x.per_infusion_hopd_usd/max*100;return <div key={x.rx_id} className="grid grid-cols-[150px_1fr_76px] items-center gap-3"><div className="truncate text-xs font-medium">{x.drug_name}</div><div className="relative h-5"><div className="absolute top-2 h-1 rounded-full bg-indigo-200" style={{left:`${left}%`,width:`${right-left}%`}}/><span className="absolute top-0 h-5 w-5 -translate-x-1/2 rounded-full border-4 border-white bg-teal-500 shadow" style={{left:`${left}%`}}/><span className="absolute top-0 h-5 w-5 -translate-x-1/2 rounded-full border-4 border-white bg-indigo-600 shadow" style={{left:`${right}%`}}/></div><div className="text-right text-xs font-semibold text-emerald-700">{money(x.annualized_savings_usd)}/yr</div></div>})}<div className="flex justify-center gap-5 pt-2 text-[10px] text-slate-500"><span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-teal-500"/>Proposed site</span><span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-indigo-600"/>Hospital outpatient</span></div></div></Frame>;
}

export function PbaMailOrderFunnel({ summary, items }: { summary:any; items:any[] }) {
  const steps=[{label:"Eligible fills",value:summary.eligible_fills,color:"from-indigo-500 to-indigo-600",w:"100%"},{label:"Members reached",value:summary.members_affected,color:"from-violet-500 to-purple-600",w:"78%"},{label:"Converted",value:summary.converted,color:"from-teal-400 to-emerald-500",w:"52%"}];
  const categories=Object.entries(items.reduce((a:any,x:any)=>{const k=x.therapeutic_category||"Other";a[k]=(a[k]||0)+x.annual_savings_usd;return a},{})).map(([name,value])=>({name:String(name).replace(/_/g," "),value:Number(value)})).sort((a:any,b:any)=>b.value-a.value).slice(0,6);
  return <div className="grid gap-4 lg:grid-cols-[.85fr_1.4fr]"><Frame eyebrow="Conversion path" title="90-day mail funnel"><div className="space-y-3">{steps.map(x=><div key={x.label} className={`mx-auto rounded-2xl bg-gradient-to-r ${x.color} px-4 py-3 text-white shadow-lg shadow-indigo-900/10`} style={{width:x.w}}><div className="flex items-center justify-between"><span className="text-xs">{x.label}</span><b className="text-xl">{x.value}</b></div></div>)}</div></Frame><Frame eyebrow="Value profile" title="Savings concentration by therapy"><div className="h-48"><ResponsiveContainer><BarChart data={categories} layout="vertical"><XAxis type="number" hide/><YAxis dataKey="name" type="category" width={118} tick={{fontSize:10}} tickLine={false} axisLine={false}/><Tooltip formatter={(v:any)=>money(Number(v))}/><Bar dataKey="value" radius={[0,9,9,0]} fill="#8b5cf6"/></BarChart></ResponsiveContainer></div><div className="text-right text-sm font-semibold text-emerald-700">{money(summary.annual_savings_usd)} annual opportunity</div></Frame></div>;
}

export function PbaNetworkQuadrant({ items }: { items:any[] }) {
  const chart=items.map(x=>({x:x.avg_dispense_time_min,y:x.mac_compliance_pct,z:Math.max(40,x.transactions_30d/30),name:x.name}));
  return <Frame eyebrow="Network map" title="Compliance vs. dispensing speed" note="Each pharmacy is positioned by operational performance; hover for identity."><div className="h-64"><ResponsiveContainer><ScatterChart margin={{left:4,right:18,bottom:4}}><CartesianGrid strokeDasharray="3 4"/><XAxis type="number" dataKey="x" name="Dispense min" unit="m" tick={{fontSize:10}}/><YAxis type="number" dataKey="y" name="MAC compliance" unit="%" domain={["dataMin - 2",100]} tick={{fontSize:10}}/><ReferenceLine x={20} stroke="#f59e0b" strokeDasharray="4 4"/><ReferenceLine y={95} stroke="#10b981" strokeDasharray="4 4"/><Tooltip cursor={{strokeDasharray:"3 3"}} content={<Tip/>}/><Scatter data={chart} fill="#4f46e5"/></ScatterChart></ResponsiveContainer></div><div className="mt-2 flex justify-between text-[10px] text-slate-400"><span>← faster dispensing</span><span>higher MAC compliance ↑</span></div></Frame>;
}

export function PbaFormularyOrbit({ data }: { data:any }) {
  const tiers=[1,2,3,4,5].map((tier,i)=>({tier:`Tier ${tier}`,count:data.tier_summary.find((x:any)=>x.tier===tier)?.count||0,color:colors[i]}));
  return <div className="grid gap-4 lg:grid-cols-[1fr_1.3fr]"><Frame eyebrow="Tier architecture" title="Formulary mix"><div className="relative h-52"><ResponsiveContainer><PieChart><Pie data={tiers} dataKey="count" nameKey="tier" innerRadius={42} outerRadius={92} paddingAngle={2}>{tiers.map(x=><Cell key={x.tier} fill={x.color}/>)}</Pie><Tooltip/></PieChart></ResponsiveContainer><div className="absolute inset-0 grid place-content-center text-center"><b className="text-2xl">{data.total_drugs}</b><span className="text-[10px] text-slate-400">drugs</span></div></div></Frame><Frame eyebrow="Utilization controls" title="Coverage guardrails"><div className="grid grid-cols-2 gap-3"><div className="rounded-3xl bg-amber-50 p-5 dark:bg-amber-950/20"><Clock3 className="h-5 w-5 text-amber-600"/><div className="mt-4 text-3xl font-semibold">{data.pa_required_count}</div><div className="text-xs text-slate-500">Prior authorization</div></div><div className="rounded-3xl bg-indigo-50 p-5 dark:bg-indigo-950/20"><ShieldCheck className="h-5 w-5 text-indigo-600"/><div className="mt-4 text-3xl font-semibold">{data.step_therapy_count}</div><div className="text-xs text-slate-500">Step therapy</div></div><div className="col-span-2 rounded-2xl border border-slate-100 p-4 dark:border-slate-800"><div className="flex h-3 overflow-hidden rounded-full">{tiers.map(x=><span key={x.tier} style={{width:`${x.count/data.total_drugs*100}%`,background:x.color}}/>)}</div><div className="mt-3 flex flex-wrap gap-3">{tiers.filter(x=>x.count).map(x=><span key={x.tier} className="text-[10px] text-slate-500"><i className="mr-1 inline-block h-2 w-2 rounded-full" style={{background:x.color}}/>{x.tier} · {x.count}</span>)}</div></div></div></Frame></div>;
}

export function PbaSafetyTriage({ data }: { data:any }) {
  const tiers=[{label:"P1 · immediate",value:data.p1_critical,tone:"from-rose-600 to-rose-500",w:"100%"},{label:"P2 · high",value:data.p2_high,tone:"from-amber-500 to-orange-400",w:"76%"},{label:"P3 · monitor",value:data.p3_standard,tone:"from-indigo-500 to-violet-500",w:"54%"}];
  return <div className="grid gap-4 lg:grid-cols-[.9fr_1.4fr]"><Frame eyebrow="Triage shape" title="Member safety priority"><div className="space-y-2">{tiers.map(x=><div key={x.label} className={`mx-auto rounded-xl bg-gradient-to-r ${x.tone} px-4 py-3 text-white`} style={{width:x.w}}><div className="flex items-center justify-between"><span className="text-xs font-semibold">{x.label}</span><b className="text-xl">{x.value}</b></div></div>)}</div></Frame><Frame eyebrow="Attention map" title="Critical flags per member" note="Larger circles carry more active clinical flags."><div className="flex min-h-44 flex-wrap content-center items-center justify-center gap-2">{data.items.slice(0,28).map((x:any)=><div key={x.patient_id} title={`${x.patient_initials}: ${x.critical_flag_count} flags`} className={`grid place-content-center rounded-full font-mono text-[10px] font-bold text-white shadow-lg ${x.alert_priority==="P1"?"bg-rose-500":x.alert_priority==="P2"?"bg-amber-500":"bg-indigo-500"}`} style={{width:Math.min(62,28+x.critical_flag_count*4),height:Math.min(62,28+x.critical_flag_count*4)}}>{x.patient_initials}</div>)}</div></Frame></div>;
}

export function PbaDashboardHero({ data }: { data:any }) {
  const pulse=Array.from({length:24},(_,i)=>({t:i,claims:Math.max(12,Math.round(data.transactions_per_second*8+Math.sin(i*.7)*16+(i%5)*3)),latency:Math.round(data.avg_latency_ms+Math.cos(i*.8)*22)}));
  return <section className="overflow-hidden rounded-[26px] border border-slate-200/80 bg-white p-6 shadow-[0_18px_55px_-38px_rgba(15,23,42,.55)] dark:border-slate-700 dark:bg-slate-900">
    <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
      <div><h2 className="text-xl font-semibold tracking-tight text-slate-950 dark:text-white">Claims moving through Axeris now</h2><p className="mt-1 text-xs text-slate-500">Live adjudication volume with response performance in context.</p></div>
      <div className="flex flex-wrap gap-6 text-right">
        <div><div className="text-xl font-semibold tabular-nums text-slate-950 dark:text-white">{data.transactions_today.toLocaleString()}</div><div className="text-[10px] text-slate-500">transactions today</div></div>
        <div><div className="text-xl font-semibold tabular-nums text-emerald-700 dark:text-emerald-300">{data.sla_compliance_pct}%</div><div className="text-[10px] text-slate-500">within SLA</div></div>
        <div><div className="text-xl font-semibold tabular-nums text-rose-700 dark:text-rose-300">{data.rejects_last_hour}</div><div className="text-[10px] text-slate-500">stopped this hour</div></div>
      </div>
    </div>
    <div className="mt-5 h-64"><ResponsiveContainer><AreaChart data={pulse}><defs><linearGradient id="heroA" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#6366f1" stopOpacity=".46"/><stop offset="1" stopColor="#6366f1" stopOpacity="0"/></linearGradient></defs><CartesianGrid vertical={false} stroke="#e2e8f0" strokeDasharray="3 4"/><XAxis hide/><YAxis hide/><Tooltip content={<Tip/>}/><Area type="monotone" dataKey="claims" name="Claims" stroke="#4f46e5" strokeWidth={3} fill="url(#heroA)"/></AreaChart></ResponsiveContainer></div>
  </section>;
}

export function PbaAdjudicationRail({ latency, callbacks, stops }: { latency:number; callbacks:number; stops:number }) {
  const stages = [
    { n:"01", label:"Pharmacy", detail:"Claim received", icon:Radio },
    { n:"02", label:"Benefit context", detail:"Member + formulary", icon:Sparkles },
  ];
  const outcomes = [
    { label:"Dispense", detail:"Cleared instantly", tone:"border-emerald-400/30 bg-emerald-400/10 text-emerald-300", dot:"bg-emerald-400" },
    { label:"Review", detail:`${callbacks} callbacks`, tone:"border-amber-400/30 bg-amber-400/10 text-amber-300", dot:"bg-amber-400" },
    { label:"Stop", detail:`${stops} this hour`, tone:"border-rose-400/30 bg-rose-400/10 text-rose-300", dot:"bg-rose-400" },
  ];
  return <section className="relative overflow-hidden rounded-[30px] border border-indigo-300/20 bg-[#10111b] px-5 py-6 text-white shadow-[0_28px_80px_-42px_rgba(49,46,129,.85)] md:px-7 md:py-7">
    <div className="pointer-events-none absolute -left-20 top-10 h-64 w-64 rounded-full bg-indigo-600/20 blur-3xl"/>
    <div className="pointer-events-none absolute -right-12 -top-20 h-64 w-64 rounded-full bg-cyan-500/10 blur-3xl"/>
    <div className="relative flex flex-col justify-between gap-3 border-b border-white/10 pb-5 md:flex-row md:items-end">
      <div><p className="text-[10px] font-bold uppercase tracking-[.24em] text-indigo-300">The decision window</p><h2 className="mt-1 text-2xl font-semibold tracking-tight">A claim, checked before dispense.</h2><p className="mt-1 text-xs text-slate-400">One continuous pass from pharmacy to a clear, auditable outcome.</p></div>
      <div className="flex items-center gap-2 self-start rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1.5 text-[11px] font-semibold text-emerald-300"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400"/>{latency}ms average response</div>
    </div>

    <div className="relative mt-6 grid gap-3 lg:grid-cols-[.8fr_28px_.8fr_28px_1.35fr_28px_1fr] lg:items-stretch">
      {stages.map((stage,i)=>{const Icon=stage.icon;return <div key={stage.n} className="contents"><div className="rounded-2xl border border-white/10 bg-white/[.055] p-4 backdrop-blur"><div className="flex items-center justify-between"><span className="text-[10px] font-bold tracking-[.18em] text-slate-500">{stage.n}</span><Icon className="h-4 w-4 text-slate-400"/></div><div className="mt-7 text-sm font-semibold">{stage.label}</div><div className="mt-0.5 text-[11px] text-slate-400">{stage.detail}</div></div><div className="hidden place-content-center lg:grid"><ArrowRight className="h-4 w-4 text-indigo-400"/></div></div>})}

      <div className="relative overflow-hidden rounded-[22px] border border-indigo-300/35 bg-gradient-to-br from-indigo-600 via-violet-600 to-blue-600 p-[1px] shadow-[0_20px_55px_-24px_rgba(99,102,241,.9)]">
        <div className="h-full rounded-[21px] bg-[#17182b]/80 p-5 backdrop-blur-xl">
          <div className="flex items-center justify-between"><span className="rounded-full bg-white/10 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[.18em] text-indigo-200">Axeris decision core</span><Zap className="h-4 w-4 fill-cyan-300 text-cyan-300"/></div>
          <div className="mt-5 flex items-end justify-between gap-3"><div><div className="text-3xl font-semibold tabular-nums">24</div><div className="text-[11px] text-indigo-200">checks in one pass</div></div><div className="text-right"><div className="text-xl font-semibold tabular-nums">{latency}<span className="text-xs text-indigo-200">ms</span></div><div className="text-[10px] text-indigo-200">average</div></div></div>
          <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-gradient-to-r from-cyan-300 via-white to-indigo-200" style={{width:`${Math.min(100,Math.max(20,latency/2))}%`}}/></div>
        </div>
      </div>

      <div className="hidden place-content-center lg:grid"><ArrowRight className="h-4 w-4 text-indigo-400"/></div>
      <div className="grid gap-2">{outcomes.map(out=><div key={out.label} className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${out.tone}`}><span className={`h-2 w-2 rounded-full ${out.dot}`}/><div className="flex-1"><div className="text-xs font-semibold">{out.label}</div><div className="text-[10px] text-slate-400">{out.detail}</div></div></div>)}</div>
    </div>

    <div className="relative mt-5 flex flex-wrap gap-x-6 gap-y-2 border-t border-white/10 pt-4 text-[10px] text-slate-400"><span>Inline with the pharmacy transaction</span><span>Clinical + benefit context together</span><span>Every decision recorded</span></div>
  </section>;
}
