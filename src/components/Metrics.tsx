"use client";

import { useReveal } from "./useReveal";

const engines = [
  { n: "01", title: "Contract & pricing", desc: "Tests spread, rebate guarantees, MAC changes, fees, and acquisition benchmarks at claim level." },
  { n: "02", title: "Plan & fiduciary", desc: "Finds ownership steering, eligibility gaps, accumulator defects, channel leakage, and plan-design failures." },
  { n: "03", title: "Clinical & patient", desc: "Keeps dosing, interactions, FDA guidance, labs, genetics, allergies, and adherence in the same case." },
];

const sources = ["PBM contract", "NADAC + MAC history", "Rebate guarantees", "Claims 835", "Ownership data", "Eligibility spans", "Plan design", "Accumulator data", "FDA labels", "EHR + labs"];

export default function Metrics() {
  const ref = useReveal();

  return (
    <section ref={ref} id="how-it-works" className="py-[72px]" style={{ borderTop: "1px solid var(--line)" }}>
      <div className="container-wide">
        <h2 className="headline reveal text-[1.9rem] sm:text-[3.3rem] text-[var(--ink)] max-w-[18ch] mb-11">
          One claim, audited three ways at once.
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-x-12 gap-y-10">
          {engines.map((e, i) => (
            <div key={e.n} className={`reveal reveal-${i + 1}`}>
              <div className="mb-5">
                <EngineGlyph i={i} />
              </div>
              <h3 className="text-[1.15rem] font-normal text-[var(--ink)] mb-2.5 tracking-[-0.01em]">{e.title}</h3>
              <p className="text-[0.96rem] text-[var(--muted)] leading-[1.5]">{e.desc}</p>
            </div>
          ))}
        </div>

        <div className="reveal mt-14">
          <p className="text-[0.82rem] text-[var(--muted)] mb-2">50+ contract, administrative, and clinical signals, including</p>
          <SignalBoard />
        </div>
      </div>
    </section>
  );
}

/* ---- signal marquee: two counter-flowing rows of rectangular tags,
   pausing when you rest your cursor on them ---- */
function MarqueeRow({ items, reverse }: { items: string[]; reverse?: boolean }) {
  return (
    <div className="marquee">
      <div className={`marquee-track ${reverse ? "reverse" : ""}`}>
        {[...items, ...items, ...items, ...items].map((s, i) => (
          <span key={i} className="tag" style={{ ["--d" as string]: `${((i * 3.7 + (reverse ? 1.9 : 0)) % 17).toFixed(1)}s` }}>{s}</span>
        ))}
      </div>
    </div>
  );
}

function SignalBoard() {
  return (
    <div className="flex flex-col gap-3 pt-2">
      <MarqueeRow items={sources.slice(0, 5)} />
      <MarqueeRow items={sources.slice(5)} reverse />
    </div>
  );
}

/* small line figures: rulebook, anomaly spike, patient */
function EngineGlyph({ i }: { i: number }) {
  const common = { fill: "none", stroke: "var(--ink-soft)", strokeWidth: 1.5, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (i === 0) return (
    <svg width="34" height="34" viewBox="0 0 34 34" aria-hidden="true">
      <g {...common}>
        <path d="M6 7 H28 M6 14 H28 M6 21 H16" />
        <path d="M20 22 L23 25 L29 18" stroke="var(--blue)" />
      </g>
    </svg>
  );
  if (i === 1) return (
    <svg width="34" height="34" viewBox="0 0 34 34" aria-hidden="true">
      <g {...common}>
        <path d="M3 20 H9 L13 14 L18 24 L21 20 H31" />
        <circle cx="18" cy="8" r="2.4" stroke="var(--blue)" />
      </g>
    </svg>
  );
  return (
    <svg width="34" height="34" viewBox="0 0 34 34" aria-hidden="true">
      <g {...common}>
        <circle cx="17" cy="11" r="5" />
        <path d="M7 28 a10 10 0 0 1 20 0" />
        <path d="M24 13 L31 13 M27.5 9.5 L27.5 16.5" stroke="var(--blue)" />
      </g>
    </svg>
  );
}
