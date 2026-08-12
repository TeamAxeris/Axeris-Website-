"use client";

import Link from "next/link";
import { useReveal } from "./useReveal";

export default function CTA() {
  const ref = useReveal();

  return (
    <section ref={ref} className="relative overflow-hidden py-[96px]" style={{ background: "var(--bg-warm)" }}>
      <div className="aurora" style={{ bottom: -180, left: "50%", transform: "translateX(-50%)", width: 720, height: 400, opacity: 0.45 }} />
      <div className="container-wide relative z-[2] text-center reveal">
        <h2 className="headline text-[1.9rem] sm:text-[3.2rem] text-[var(--ink)] max-w-[18ch] mx-auto mb-9">
          If we don&apos;t save money, <span className="grad-text">you don&apos;t pay.</span>
        </h2>
        <Link href="https://proto2-mocha.vercel.app/" target="_blank" rel="noopener noreferrer" className="btn btn-primary !px-7 !py-3.5 !text-[1rem]">
          Try Live Demo
        </Link>
      </div>
    </section>
  );
}
