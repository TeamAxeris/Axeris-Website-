"use client";

import Image from "next/image";
import { useReveal } from "./useReveal";

/* the PBM way, struck through and corrected in-line — the redline is the figure */
const redlines = [
  { old: "Paid on rebates and spread.", now: "Paid only on verified savings." },
  { old: "Denies automatically.", now: "Flags to a human, with evidence." },
  { old: "Reviewed months after payment.", now: "Caught before the claim is paid." },
  { old: "Swapped by price.", now: "Swapped only for true equivalents." },
];

const BAND_BG = "#eae4d6";

export default function Trust() {
  const ref = useReveal();

  return (
    <section ref={ref} id="why-axeris" className="relative overflow-hidden py-[88px]" style={{ background: BAND_BG }}>
      <div className="aurora" style={{ top: -220, right: "-6%", width: 620, height: 520, opacity: 0.35 }} />
      <div className="container-wide relative z-[2]">
        <h2 className="headline reveal text-[1.9rem] sm:text-[3.3rem] text-[var(--ink)] max-w-[16ch] mb-12">
          We don&apos;t push cheap drugs. We stop unsafe ones.
        </h2>

        <div className="flex flex-col gap-6 max-w-[880px] mb-16">
          {redlines.map((r, i) => (
            <p key={r.old} className={`reveal reveal-${(i % 4) + 1} text-[1.3rem] sm:text-[1.65rem] leading-[1.45] tracking-[-0.015em]`}>
              <span className="text-[var(--faint)] line-through"
                    style={{ textDecorationColor: "rgba(220,75,69,0.6)", textDecorationThickness: "1.5px" }}>
                {r.old}
              </span>{" "}
              <span className="text-[var(--ink)] font-medium">{r.now}</span>
            </p>
          ))}
        </div>

        {/* quote, with the person attached */}
        <div className="reveal flex items-start gap-5 max-w-[820px]">
          <Image
            src="/team/adan-eftekhari-2.jpg"
            alt="Adan Eftekhari"
            width={64}
            height={64}
            className="w-14 h-14 sm:w-16 sm:h-16 rounded-full object-cover shrink-0"
            style={{ objectPosition: "50% 18%", border: "1px solid rgba(20,18,12,0.14)" }}
          />
          <div>
            <p className="text-[1.35rem] sm:text-[1.7rem] leading-[1.4] tracking-[-0.015em] text-[var(--ink)]">
              &ldquo;Every flag ships with the evidence attached. That is the difference
              between a denial tool and a decision you can defend.&rdquo;
            </p>
            <p className="text-[0.9rem] mt-4 text-[var(--muted)]">Adan Eftekhari, Chief Executive Officer</p>
          </div>
        </div>
      </div>
    </section>
  );
}
