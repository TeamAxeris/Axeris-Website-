"use client";

import { Building2, CircleDollarSign, Landmark, LineChart, Receipt, ShieldCheck } from "lucide-react";
import { useReveal } from "./useReveal";

const audits = [
  { icon: Receipt, label: "Spread & rebates", value: "$366k", note: "pricing and guarantee gaps identified", tone: "#2f2fe6", visual: "waterfall" },
  { icon: LineChart, label: "MAC repricing", value: "50.4%", note: "worst unexplained generic-price drift", tone: "#b56f0b", visual: "spark" },
  { icon: Landmark, label: "Conflict of interest", value: "22.5%", note: "affiliated channel steering surfaced", tone: "#7654d6", visual: "ring" },
  { icon: CircleDollarSign, label: "Direct channels", value: "$905k", note: "annualized DTC and accumulator leakage", tone: "#0f8f69", visual: "split" },
  { icon: ShieldCheck, label: "Plan design", value: "$636k", note: "routing, copay, and biosimilar defects", tone: "#dc4b45", visual: "steps" },
  { icon: Building2, label: "Eligibility & stop-loss", value: "30.8k", note: "covered lives reconciled before forecast", tone: "#257b9b", visual: "pulse" },
];

export default function ContractIntegrity() {
  const ref = useReveal();

  return (
    <section ref={ref} id="contract-integrity" className="py-[78px]" style={{ background: "#f0eee8", color: "#1d2038" }}>
      <div className="container-wide">
        <div className="grid items-end gap-10 lg:grid-cols-[0.92fr_1.08fr] lg:gap-16">
          <div className="reveal">
            <h2 className="headline max-w-[15ch] text-[2rem] sm:text-[3.35rem]" style={{ color: "#191c33" }}>
              The prescription is only half the audit.
            </h2>
            <p className="mt-5 max-w-[540px] text-[1rem] leading-[1.6]" style={{ color: "#68665f" }}>
              Axeris also reads the PBM contract, independent price benchmarks, rebate guarantees, ownership relationships, eligibility spans, and plan design—then ties every variance back to the claim.
            </p>
            <div className="mt-8 flex flex-wrap gap-2">
              {["Pre-payment", "Claim-level evidence", "ERISA-ready", "Independent benchmarks"].map((item) => (
                <span key={item} className="rounded-full border border-[#d8d4ca] bg-white/70 px-3 py-1.5 text-[0.72rem]" style={{ color: "#55544f" }}>{item}</span>
              ))}
            </div>
          </div>

          <div className="reveal reveal-2 overflow-hidden rounded-[22px] border border-[#dcd8ce] bg-white/90 shadow-[0_28px_70px_rgba(51,50,81,.12)]">
            <div className="flex items-center justify-between border-b border-[#e4e0d7] px-5 py-4">
              <div>
                <div className="text-[0.66rem] uppercase tracking-[0.16em]" style={{ color: "#85817a" }}>Claim-to-contract ledger</div>
                <div className="mt-1 text-[0.95rem] font-medium" style={{ color: "#191c33" }}>One paid claim, independently reconstructed</div>
              </div>
              <span className="rounded-full px-2.5 py-1 text-[0.65rem] font-semibold" style={{ color: "#77e0ba", background: "rgba(15,143,105,.16)" }}>Evidence linked</span>
            </div>
            <div className="grid gap-5 p-5 sm:grid-cols-[1fr_auto] sm:items-end">
              <div className="space-y-3.5">
                <LedgerRow label="Plan allowed" value="$318" width={100} color="#f8f5ee" />
                <LedgerRow label="Independent benchmark" value="$91" width={29} color="#8f94ff" />
                <LedgerRow label="Rebate credit due" value="$44" width={14} color="#77e0ba" />
              </div>
              <div className="rounded-2xl border border-[#d9dafb] bg-[#f3f3ff] px-5 py-4 sm:min-w-[160px]">
                <div className="text-[0.64rem] uppercase tracking-[0.14em]" style={{ color: "#6d6ba0" }}>Recoverable</div>
                <div className="num mt-1 text-[2rem]" style={{ color: "#2f33bf" }}>$271</div>
                <div className="mt-1 text-[0.7rem]" style={{ color: "#68665f" }}>spread + guarantee gap</div>
              </div>
            </div>
            <div className="grid grid-cols-3 border-t border-[#e4e0d7] text-center">
              {[['NADAC', 'benchmark'], ['PBM terms', 'contract'], ['Claim 835', 'paid data']].map(([top, bottom]) => (
                <div key={top} className="border-r border-[#e4e0d7] px-2 py-3 last:border-r-0">
                  <div className="text-[0.72rem]" style={{ color: "#2f3149" }}>{top}</div><div className="text-[0.6rem]" style={{ color: "#85817a" }}>{bottom}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {audits.map((audit, index) => {
            const Icon = audit.icon;
            return (
              <div key={audit.label} className={`reveal reveal-${(index % 4) + 1} rounded-2xl border border-[#ddd9d0] bg-white/75 p-5 transition-transform duration-300 hover:-translate-y-1 hover:bg-white`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: `${audit.tone}22`, color: audit.tone }}><Icon className="h-4 w-4" /></div>
                  <AuditVisual kind={audit.visual} tone={audit.tone} />
                </div>
                <div className="mt-5 text-[0.72rem] font-medium uppercase tracking-[0.08em]" style={{ color: "#68665f" }}>{audit.label}</div>
                <div className="num mt-1 text-[1.9rem]" style={{ color: "#191c33" }}>{audit.value}</div>
                <div className="mt-1 text-[0.76rem] leading-relaxed" style={{ color: "#85817a" }}>{audit.note}</div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function AuditVisual({ kind, tone }: { kind: string; tone: string }) {
  if (kind === "ring") return <div aria-hidden="true" className="h-8 w-8 rounded-full" style={{ background: `conic-gradient(${tone} 0 22.5%, #e4e1da 22.5% 100%)`, boxShadow: "inset 0 0 0 8px white" }} />;
  if (kind === "split") return <div aria-hidden="true" className="flex h-2 w-14 overflow-hidden rounded-full bg-[#e4e1da]"><span style={{ width: "68%", background: tone }} /><span className="ml-0.5" style={{ width: "18%", background: `${tone}66` }} /></div>;
  if (kind === "spark") return <svg aria-hidden="true" viewBox="0 0 60 28" className="h-8 w-16"><path d="M2 23 L12 16 L22 19 L33 7 L43 13 L58 3" fill="none" stroke={tone} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>;
  if (kind === "steps") return <div aria-hidden="true" className="flex h-8 items-end gap-1">{[10, 17, 24, 31].map((height, i) => <span key={height} className="w-2 rounded-t-sm" style={{ height, background: tone, opacity: 0.35 + i * 0.2 }} />)}</div>;
  if (kind === "pulse") return <svg aria-hidden="true" viewBox="0 0 64 28" className="h-8 w-16"><path d="M2 18 H17 L22 7 L28 24 L34 14 H46 L51 10 L62 10" fill="none" stroke={tone} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>;
  return <div aria-hidden="true" className="flex h-8 items-end gap-1">{[15, 28, 20, 10].map((height, i) => <span key={`${height}-${i}`} className="w-2 rounded-sm" style={{ height, background: tone, opacity: 0.4 + i * 0.16 }} />)}</div>;
}

function LedgerRow({ label, value, width, color }: { label: string; value: string; width: number; color: string }) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-[0.7rem]" style={{ color: "#68665f" }}><span>{label}</span><span className="num" style={{ color: "#2f3149" }}>{value}</span></div>
      <div className="h-2 overflow-hidden rounded-full bg-[#e6e3dc]"><div className="h-full rounded-full" style={{ width: `${width}%`, background: color }} /></div>
    </div>
  );
}
