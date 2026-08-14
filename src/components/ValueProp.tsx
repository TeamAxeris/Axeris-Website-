"use client";

import { useEffect, useRef, useState } from "react";
import { useReveal } from "./useReveal";

const steps = [
  { title: "Terms arrive", desc: "The PBM contract, benefit design, eligibility, and claim arrive together." },
  { title: "Economics rebuilt", desc: "Allowed price, acquisition benchmark, MAC history, and rebate terms reconcile." },
  { title: "Member context", desc: "Clinical safety, eligibility, accumulator, and plan rules stay attached to the case." },
  { title: "Integrity checks", desc: "Spread, steering, channel leakage, fraud, and design defects surface instantly." },
  { title: "Evidence-backed verdict", desc: "Pay, recover, swap, dispute, or hold—with the source trail attached." },
];

/* slab positions cascading down-right — stretched diagonally so the figure
   reads wide and flat rather than tall */
const POS = [
  { x: 150, y: 120 },
  { x: 355, y: 192 },
  { x: 560, y: 264 },
  { x: 765, y: 336 },
  { x: 970, y: 408 },
];
/* labels sit right beside their slabs, alternating above/below — no leader
   lines. Positions hand-checked against every neighboring slab edge. */
const LABEL = [
  { x: 30, y: 238 },   // below slab 1
  { x: 385, y: 32 },   // above slab 2
  { x: 440, y: 382 },  // below slab 3
  { x: 795, y: 176 },  // above slab 4
  { x: 850, y: 526 },  // below slab 5
];

export default function ValueProp() {
  const ref = useReveal();
  const [active, setActive] = useState(2);
  const [hovering, setHovering] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (hovering) return;
    timer.current = setInterval(() => setActive((a) => (a + 1) % steps.length), 2400);
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [hovering]);

  return (
    <section ref={ref} className="py-[72px]">
      <div className="container-wide">
        <h2 className="headline reveal text-[1.9rem] sm:text-[3.3rem] text-[var(--ink)] max-w-[20ch] mb-3">
          One quiet layer between every contract, claim, and payment.
        </h2>
        <p className="reveal reveal-1 text-[1.05rem] text-[var(--muted)] max-w-[480px] leading-[1.5]">
          Every claim walks these five steps before a dollar moves.
        </p>

        {/* phones get a clean stacked list — the SVG's labels are unreadable that small */}
        <div className="sm:hidden mt-9 flex flex-col gap-6">
          {steps.map((s, i) => (
            <div key={s.title} className={`reveal reveal-${(i % 4) + 1} flex items-start gap-4`}>
              <span className="w-2 h-2 mt-2.5 shrink-0 rotate-45"
                    style={{ background: i === active ? "var(--blue)" : "var(--faint)", transition: "background 0.3s ease" }} />
              <div>
                <h3 className="text-[1.1rem] font-normal text-[var(--ink)] tracking-[-0.01em]">{s.title}</h3>
                <p className="text-[0.92rem] text-[var(--muted)] leading-[1.5] mt-0.5">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="reveal reveal-2 mt-4 select-none hidden sm:block" onMouseLeave={() => setHovering(false)}>
          <svg viewBox="0 0 1200 630" className="w-full mx-auto block" role="img"
               style={{ maxHeight: "70vh", height: "auto" }}
               aria-label="Five isometric steps: contract terms, claim economics, member context, integrity checks, evidence-backed verdict">
            {POS.map((p, i) => {
              const l = LABEL[i];
              const isActive = i === active;
              return (
                <g key={i}>
                  {/* slab: thickness layer then top face, iso-projected rounded square = cut-corner rectangle */}
                  <g transform={`translate(${p.x} ${p.y + 14}) scale(1 0.578) rotate(-45)`}>
                    <rect x="-92" y="-92" width="184" height="184" rx="22"
                          fill={isActive ? "rgba(47,47,230,0.08)" : "rgba(20,18,12,0.05)"}
                          stroke={isActive ? "var(--blue)" : "rgba(20,18,12,0.35)"} strokeWidth={isActive ? 3 : 1.6} />
                  </g>
                  <g transform={`translate(${p.x} ${p.y}) scale(1 0.578) rotate(-45)`}
                     onMouseEnter={() => { setHovering(true); setActive(i); }}
                     style={{ cursor: "pointer" }}>
                    <rect x="-92" y="-92" width="184" height="184" rx="22"
                          fill="var(--bg)"
                          stroke={isActive ? "var(--blue)" : "rgba(20,18,12,0.55)"} strokeWidth={isActive ? 3 : 1.6}
                          style={{ transition: "stroke 0.3s ease" }} />
                    <rect x="-62" y="-62" width="124" height="124" rx="12"
                          fill="none" stroke={isActive ? "rgba(47,47,230,0.5)" : "rgba(20,18,12,0.25)"}
                          strokeWidth="1.2" strokeDasharray="5 5" style={{ transition: "stroke 0.3s ease" }} />
                    <g transform="rotate(45) scale(1 1.73)"
                       stroke={isActive ? "var(--blue)" : "rgba(20,18,12,0.5)"}
                       strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round"
                       style={{ transition: "stroke 0.3s ease, color 0.3s ease", color: isActive ? "var(--blue)" : "rgba(20,18,12,0.55)" }}>
                      <SlabGlyph i={i} />
                    </g>
                  </g>
                  {/* label + description */}
                  <g style={{ opacity: isActive ? 1 : 0.45, transition: "opacity 0.3s ease" }}>
                    <text x={l.x} y={l.y} fontFamily="var(--font-body)" fontSize="19" fontWeight="500" fill="var(--ink)">
                      {steps[i].title}
                    </text>
                    <foreignObject x={l.x - 4} y={l.y + 8} width="228" height="66">
                      <p style={{ fontFamily: "var(--font-body)", fontSize: 13.5, lineHeight: 1.45, color: "var(--muted)", padding: 4 }}>
                        {steps[i].desc}
                      </p>
                    </foreignObject>
                  </g>
                </g>
              );
            })}
          </svg>
        </div>

        <div className="flex flex-wrap gap-x-14 gap-y-5 mt-9 sm:mt-2">
          <div className="reveal">
            <span className="num text-[2.2rem] text-[var(--ink)]">50+</span>
            <span className="text-[0.9rem] text-[var(--muted)] ml-3">contract, administrative, and clinical signals</span>
          </div>
          <div className="reveal reveal-1">
            <span className="num text-[2.2rem] text-[var(--ink)]">99.4%</span>
            <span className="text-[0.9rem] text-[var(--muted)] ml-3">precision, tuned against false flags</span>
          </div>
        </div>
      </div>
    </section>
  );
}

/* slab marks, Polarity-minimal: one clean idea per slab, nothing fussy */
const VE = { vectorEffect: "non-scaling-stroke" as const };
function SlabGlyph({ i }: { i: number }) {
  switch (i) {
    case 0: /* the script itself */
      return (
        <text y="8" textAnchor="middle" fontFamily="var(--font-body)" fontSize="23" fontWeight="500"
              letterSpacing="-0.5" fill="currentColor" stroke="none">Rx</text>
      );
    case 1: /* the rulebook: three quiet lines */
      return <path {...VE} d="M-11 -8 H11 M-11 0 H11 M-11 8 H1" />;
    case 2: /* the Axeris layer */
      return (
        <text y="8" textAnchor="middle" fontFamily="var(--font-body)" fontSize="23" fontWeight="500"
              letterSpacing="-0.5" fill="currentColor" stroke="none">Ax</text>
      );
    case 3: /* the anomaly trace: one clean pulse */
      return <path {...VE} d="M-14 0 H-7 L-3 -9 L3 9 L7 0 H14" />;
    default: /* the verdict: one bold check */
      return <path {...VE} d="M-9 1 L-2 8 L10 -7" strokeWidth="3" />;
  }
}
