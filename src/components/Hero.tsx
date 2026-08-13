"use client";

import { useEffect, useRef, useState } from "react";

/* deterministic jagged ascending line */
const N = 90;
function build() {
  let s = 11;
  const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  const pts: [number, number][] = [];
  for (let i = 0; i < N; i++) {
    const t = i / (N - 1);
    pts.push([t * 640, 400 - t * 360 + (rnd() - 0.5) * 26 + Math.sin(i * 1.7) * 6]);
  }
  return pts;
}
const LINE = build().map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");

export default function Hero() {
  const [play, setPlay] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);
  useEffect(() => { const t = setTimeout(() => setPlay(true), 250); return () => clearTimeout(t); }, []);

  return (
    <section ref={sectionRef} className="relative overflow-hidden flex flex-col justify-end min-h-[480px] sm:min-h-[min(88vh,760px)]">
      <FieldCanvas hostRef={sectionRef} />
      <div className="aurora" style={{ top: -260, right: "0%", width: 700, height: 560, opacity: 0.4, animation: "drift 24s ease-in-out infinite" }} />

      {/* jagged line rising out of the bottom-right — desktop only; on phones it crosses the buttons */}
      <div className="hidden sm:block absolute bottom-0 right-0 w-[52%] pointer-events-none" aria-hidden="true">
        <svg viewBox="0 0 660 420" className="w-full h-auto">
          <path className={`draw ${play ? "play" : ""}`} pathLength={1} d={LINE}
                fill="none" stroke="var(--blue)" strokeWidth="2.5" vectorEffect="non-scaling-stroke"
                strokeLinecap="round" strokeLinejoin="round" style={{ animationDuration: "3s" }} />
        </svg>
      </div>

      <div className="container-wide w-full relative z-[2] pb-[52px] sm:pb-[68px] pt-[120px] sm:pt-[140px] pointer-events-none">
        <h1 className="headline text-[1.9rem] sm:text-[3.3rem] lg:text-[3.8rem] text-[var(--ink)] mb-8"
            style={{ animation: "fadeInUp 0.8s ease both" }}>
          Unsafe, wasteful prescriptions,<br className="hidden sm:inline" /> stopped before they&apos;re paid.
        </h1>
        <div className="flex items-center gap-3 flex-wrap pointer-events-auto" style={{ animation: "fadeInUp 0.8s ease 0.12s both" }}>
          <a href="/console/tpa/dashboard?demo=1" className="btn btn-primary">
            Try Live Demo
          </a>
          <a href="https://mail.google.com/mail/?view=cm&fs=1&to=contact@axeris-health.com&su=Axeris" target="_blank" rel="noopener noreferrer" className="btn btn-ghost">Contact us</a>
        </div>
      </div>
    </section>
  );
}

/* ---- Stamped squares: everywhere the cursor travels, new square outlines
   appear in place — they hold still where they were made, then fade. Nothing
   follows the cursor; it leaves squares behind like a wake. ---- */
type Stamp = { x: number; y: number; s: number; rot: number; born: number };

function FieldCanvas({ hostRef }: { hostRef: React.RefObject<HTMLElement> }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current, host = hostRef.current;
    if (!canvas || !host) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const IN = 0.14, HOLD = 1.2, OUT = 1.0; // seconds: appear, hold still, fade
    let w = 0, h = 0, dpr = 1, raf = 0;
    let lastX = -1, lastY = -1, distAcc = 0;
    const stamps: Stamp[] = [];

    const resize = () => {
      const rect = host.getBoundingClientRect();
      dpr = Math.min(2, window.devicePixelRatio || 1);
      w = rect.width; h = rect.height;
      canvas.width = w * dpr; canvas.height = h * dpr;
      canvas.style.width = `${w}px`; canvas.style.height = `${h}px`;
    };
    resize();

    const onMove = (e: MouseEvent) => {
      const rect = host.getBoundingClientRect();
      const mx = e.clientX - rect.left, my = e.clientY - rect.top;
      if (lastX >= 0) {
        distAcc += Math.hypot(mx - lastX, my - lastY);
        while (distAcc > 34) {
          distAcc -= 34;
          stamps.push({
            x: mx + (Math.random() - 0.5) * 30,
            y: my + (Math.random() - 0.5) * 30,
            s: 8 + Math.random() * 26,
            rot: (Math.random() - 0.5) * 0.14,
            born: performance.now(),
          });
          if (stamps.length > 40) stamps.shift();
        }
      }
      lastX = mx; lastY = my;
    };
    const onLeave = () => { lastX = -1; lastY = -1; distAcc = 0; };

    const draw = (now: number) => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      ctx.lineWidth = 1;
      for (let i = stamps.length - 1; i >= 0; i--) {
        const st = stamps[i];
        const age = (now - st.born) / 1000;
        let a: number;
        if (age < IN) a = age / IN;
        else if (age < IN + HOLD) a = 1;
        else a = 1 - (age - IN - HOLD) / OUT;
        if (a <= 0) { stamps.splice(i, 1); continue; }
        ctx.save();
        ctx.translate(st.x, st.y);
        ctx.rotate(st.rot);
        ctx.strokeStyle = `rgba(20, 18, 12, ${0.15 * a})`;
        ctx.strokeRect(-st.s, -st.s, st.s * 2, st.s * 2);
        ctx.restore();
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    host.addEventListener("mousemove", onMove);
    host.addEventListener("mouseleave", onLeave);
    window.addEventListener("resize", resize);
    return () => {
      cancelAnimationFrame(raf);
      host.removeEventListener("mousemove", onMove);
      host.removeEventListener("mouseleave", onLeave);
      window.removeEventListener("resize", resize);
    };
  }, [hostRef]);

  return <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none" aria-hidden="true" />;
}
