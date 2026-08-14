"use client";

import { useEffect, useRef, useState } from "react";
import { useReveal } from "./useReveal";

/* audience cards: plain, readable facts — label on the left, answer on the right */
const audiences = [
  {
    who: "Self-funded employers",
    line: "65% of insured Americans get coverage through one.",
    facts: [["Who pays for waste", "They do, directly"], ["Independent check today", "None"]],
    mode: "Start in Shadow",
  },
  {
    who: "Health insurers",
    line: "Thin margins, hard audits, every denial contested.",
    facts: [["What regulators ask", "Evidence for every denial"], ["What Axeris adds", "The evidence, attached"]],
    mode: "Run Advisory",
  },
  {
    who: "Health systems",
    line: "Prescribing varies widely between their own clinicians.",
    facts: [["Who carries liability", "The system itself"], ["What Axeris adds", "A second read on every script"]],
    mode: "Enforce Policy",
  },
];

export default function Integrations() {
  const ref = useReveal();

  return (
    <section ref={ref} id="who" className="py-[72px]" style={{ background: "var(--bg-warm)" }}>
      <div className="container-wide">
        <div className="grid grid-cols-1 lg:grid-cols-[0.9fr_1.1fr] gap-8 lg:gap-16">
          <div className="reveal">
            <h2 className="headline text-[1.9rem] sm:text-[3.3rem] text-[var(--ink)] max-w-[14ch] mb-5">
              Built for payers who want an independent read of every contract and claim.
            </h2>
            <p className="text-[1.02rem] text-[var(--muted)] max-w-[400px] leading-[1.5]">
              Axeris turns contract terms into executable checks, attaches the evidence to each case, and takes a share only of savings we verify.
            </p>
          </div>

          <div className="flex flex-col gap-4">
            {audiences.map((a, i) => (
              <div key={a.who} className={`reveal reveal-${i + 1} rounded-2xl px-6 py-5`}
                   style={{ background: "var(--paper)", border: "1px solid var(--line)", boxShadow: "0 12px 34px rgba(20,18,12,0.05)" }}>
                <div className="flex items-center justify-between gap-4 mb-1.5">
                  <h3 className="text-[1.05rem] font-medium text-[var(--ink)] tracking-[-0.01em]">{a.who}</h3>
                  <span className="text-[0.74rem] text-[var(--blue)] whitespace-nowrap px-2.5 py-1 rounded-md"
                        style={{ background: "rgba(47,47,230,0.07)", border: "1px solid rgba(47,47,230,0.18)" }}>
                    {a.mode}
                  </span>
                </div>
                <p className="text-[0.9rem] text-[var(--muted)] leading-[1.5] mb-4">{a.line}</p>
                <div className="flex flex-col">
                  {a.facts.map(([label, value]) => (
                    <div key={label} className="flex items-baseline justify-between gap-6 py-2" style={{ borderTop: "1px solid var(--line)" }}>
                      <span className="text-[0.84rem] text-[var(--muted)]">{label}</span>
                      <span className="text-[0.88rem] text-[var(--ink)] font-medium text-right">{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* interactive lattice: savings climb as coverage expands */}
        <div className="mt-10">
          <p className="text-[0.85rem] text-[var(--muted)] mb-2">Verified savings climb as coverage expands</p>
          <Lattice />
        </div>
      </div>
    </section>
  );
}

/* ---- diamond lattice: the savings line breathes on its own, follows the
   cursor when you explore, and lands exactly on the blue target diamond ---- */
const LW = 1200, LH = 420, ROWS = { top: 50, mid: 210, bot: 370 };

const START: [number, number] = [60, ROWS.bot];
const TARGET: [number, number] = [1140, ROWS.mid];

/* the line rides the lattice itself: up a diagonal to a first crest, down into
   a valley, then a bigger climb to the top row, and a glide onto the target —
   piecewise-linear so it hugs the net, with a fine tremor over the top */
const KEY: [number, number][] = [
  [60, 370], [260, 210], [360, 130], [460, 210], [560, 290],
  [660, 210], [760, 130], [860, 50], [960, 130], [1060, 172], [1140, 210],
];
function baseY(x: number) {
  for (let k = 1; k < KEY.length; k++) {
    if (x <= KEY[k][0]) {
      const [x0, y0] = KEY[k - 1], [x1, y1] = KEY[k];
      return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
    }
  }
  return KEY[KEY.length - 1][1];
}
function jag(t: number) {
  const x = START[0] + t * (TARGET[0] - START[0]);
  const amp = Math.pow(Math.sin(Math.PI * Math.min(1, t)), 0.6);
  const y = baseY(x) + (Math.sin(t * 140) * 2.4 + Math.sin(t * 61) * 3.4 + Math.sin(t * 23) * 2) * amp;
  return [x, y] as const;
}
const JAG_N = 260;

function Lattice() {
  const [p, setP] = useState(0.04);
  const hovering = useRef(false);
  const grown = useRef(0.04); // idle progress only ever moves forward
  const started = useRef(false);
  const svgRef = useRef<SVGSVGElement>(null);

  /* the line climbs slowly from the start once the figure is in view — forward only */
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setP(1); return; }

    const io = new IntersectionObserver(
      (entries) => { if (entries.some((e) => e.isIntersecting)) { started.current = true; io.disconnect(); } },
      { threshold: 0.25 }
    );
    io.observe(el);

    let raf = 0, last = performance.now();
    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      if (started.current && grown.current < 1) {
        grown.current = Math.min(1, grown.current + dt / 11);
        if (!hovering.current) setP(grown.current);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => { io.disconnect(); cancelAnimationFrame(raf); };
  }, []);

  const onMove = (e: React.MouseEvent) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    hovering.current = true;
    setP(Math.min(1, Math.max(0.04, (e.clientX - rect.left) / rect.width)));
  };
  const onLeave = () => { hovering.current = false; setP(grown.current); };

  const pts: string[] = [];
  for (let i = 0; i <= JAG_N * p; i++) {
    const [x, y] = jag(i / JAG_N);
    pts.push(`${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`);
  }
  const [hx, hy] = p > 0.985 ? TARGET : jag(Math.min(1, p));

  /* woven net: two families of diagonals spanning the full canvas */
  const diagonals: string[] = [];
  for (let xi = -400; xi <= 1200; xi += 200) {
    diagonals.push(`M${xi} ${ROWS.bot} L${xi + 400} ${ROWS.top}`);
    diagonals.push(`M${xi} ${ROWS.top} L${xi + 400} ${ROWS.bot}`);
  }
  /* nodes at every crossing: main rows staggered against quarter rows */
  const nodes: [number, number][] = [];
  for (const y of [50, 210, 370]) for (let x = 260; x <= 1060; x += 200) nodes.push([x, y]);
  for (const y of [130, 290]) for (let x = 160; x <= 1160; x += 200) nodes.push([x, y]);

  return (
    <svg ref={svgRef} viewBox={`0 0 ${LW} ${LH}`} className="w-full h-auto cursor-crosshair"
         onMouseMove={onMove} onMouseLeave={onLeave} role="img"
         aria-label="A woven lattice of diamonds; a jagged line climbs through it to the blue target">
      <defs>
        {/* stipple grain for the shaded cells */}
        <pattern id="latGrain" width="4" height="4" patternUnits="userSpaceOnUse">
          <rect width="4" height="4" fill="#d8d4ca" />
          <circle cx="1" cy="1.2" r="0.55" fill="#aaa49a" />
          <circle cx="3" cy="2.8" r="0.5" fill="#b8b2a8" />
        </pattern>
      </defs>

      {/* dashed outer rows, solid mid row */}
      <line x1="0" y1={ROWS.top} x2={LW} y2={ROWS.top} stroke="rgba(20,18,12,0.14)" strokeWidth="1" strokeDasharray="4 6" />
      <line x1="0" y1={ROWS.bot} x2={LW} y2={ROWS.bot} stroke="rgba(20,18,12,0.14)" strokeWidth="1" strokeDasharray="4 6" />
      <line x1="0" y1={ROWS.mid} x2={LW} y2={ROWS.mid} stroke="rgba(20,18,12,0.22)" strokeWidth="1" />

      {/* the net */}
      {diagonals.map((d, i) => (
        <path key={i} d={d} fill="none" stroke="rgba(20,18,12,0.2)" strokeWidth="1" />
      ))}

      {/* grain-shaded cells: the valley the line skirts, and the mountain it crests */}
      <polygon points={`460,${ROWS.top} 660,${ROWS.mid} 460,${ROWS.bot} 260,${ROWS.mid}`} fill="url(#latGrain)" opacity="0.5" />
      <polygon points={`860,${ROWS.top} 1060,${ROWS.mid} 860,${ROWS.bot} 660,${ROWS.mid}`} fill="url(#latGrain)" opacity="0.5" />

      {/* crossing nodes */}
      {nodes.map(([nx, ny], k) => (
        <rect key={k} x={nx - 4.5} y={ny - 4.5} width="9" height="9" fill="rgba(20,18,12,0.55)"
              transform={`rotate(45 ${nx} ${ny})`} />
      ))}

      {/* left origin markers: double diamonds */}
      {[ROWS.top, ROWS.mid, ROWS.bot].map((y) => (
        <g key={y}>
          <rect x={60 - 14} y={y - 14} width="28" height="28" fill="var(--bg-warm)" stroke="rgba(20,18,12,0.55)" strokeWidth="1.5" transform={`rotate(45 60 ${y})`} />
          <rect x={60 - 6} y={y - 6} width="12" height="12" fill="none" stroke="rgba(20,18,12,0.55)" strokeWidth="1.5" transform={`rotate(45 60 ${y})`} />
        </g>
      ))}
      {/* right target: blue double diamond */}
      <g>
        <rect x={1140 - 16} y={ROWS.mid - 16} width="32" height="32" fill="var(--bg-warm)" stroke="var(--blue)" strokeWidth="2" transform={`rotate(45 1140 ${ROWS.mid})`} />
        <rect x={1140 - 7} y={ROWS.mid - 7} width="14" height="14" fill="none" stroke="var(--blue)" strokeWidth="2" transform={`rotate(45 1140 ${ROWS.mid})`} />
      </g>

      {/* the line: flat brand blue, crisp, no glow — tremor does the talking */}
      <path d={pts.join(" ")} fill="none" stroke="var(--blue)" strokeWidth="3.2" strokeLinejoin="miter" strokeLinecap="round" />
      <circle cx={hx} cy={hy} r="4" fill="var(--blue)" />
    </svg>
  );
}
