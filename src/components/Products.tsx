"use client";

import { useReveal } from "./useReveal";

/* problems as bold-lead statements, Trust-style */
const problems = [
  { lead: "Inappropriate prescribing.", rest: "Wrong drug, unsafe dose, dangerous combinations." },
  { lead: "Wasteful spending.", rest: "Costly brands where generics exist." },
  { lead: "Fraud and abuse.", rest: "Doctor shopping, collusion, invented diagnoses." },
  { lead: "Prior-auth burden.", rest: "39 requests per physician, per week." },
];

/* the same problems, shown as a live claims feed — illustrative numbers */
const feed = [
  { name: "Lisinopril 20 mg", note: "pays", amt: "$4", c: "var(--green)" },
  { name: "Crestor 20 mg", note: "generic exists", amt: "$318 → $9", c: "var(--amber)" },
  { name: "Oxycodone 30 mg", note: "third prescriber this month", amt: "held", c: "var(--red)" },
  { name: "Duloxetine 60 mg", note: "pays", amt: "$16", c: "var(--green)" },
  { name: "Humira 40 mg", note: "biosimilar is equal", amt: "$6,922 → $1,180", c: "var(--amber)" },
  { name: "Atorvastatin 40 mg", note: "pays", amt: "$12", c: "var(--green)" },
];

export default function Products() {
  const ref = useReveal();

  return (
    <section ref={ref} id="problem" className="py-[72px]" style={{ background: "var(--bg-warm)" }}>
      <div className="container-wide">
        <h2 className="headline reveal text-[1.9rem] sm:text-[3.3rem] text-[var(--ink)] max-w-[16ch] mb-11">
          What slips through costs lives. And billions.
        </h2>

        <div className="grid grid-cols-1 lg:grid-cols-[0.85fr_1.15fr] gap-x-16 gap-y-12 items-start">
          {/* the problems, plainly said */}
          <div className="flex flex-col gap-5">
            {problems.map((p, i) => (
              <p key={p.lead} className={`reveal reveal-${(i % 4) + 1} text-[1.12rem] sm:text-[1.25rem] leading-[1.45] tracking-[-0.01em]`}>
                <span className="text-[var(--ink)] font-medium">{p.lead}</span>{" "}
                <span className="text-[var(--ink-soft)]">{p.rest}</span>
              </p>
            ))}
          </div>

          {/* the same problems, caught in the feed */}
          <div className="reveal reveal-2 rounded-2xl overflow-hidden"
               style={{ background: "var(--paper)", border: "1px solid var(--line)", boxShadow: "0 18px 50px rgba(20,18,12,0.07)" }}>
            <div className="flex items-baseline justify-between px-6 pt-5 pb-4">
              <span className="text-[0.72rem] font-medium uppercase tracking-[0.16em] text-[var(--muted)]">Claims feed</span>
              <span className="text-[0.7rem] text-[var(--faint)]">illustrative</span>
            </div>
            <div>
              {feed.map((f) => (
                <div key={f.name} className="flex items-center gap-3.5 px-6 py-[13px]" style={{ borderTop: "1px solid var(--line)" }}>
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: f.c }} />
                  <span className="text-[0.94rem] text-[var(--ink)] whitespace-nowrap">{f.name}</span>
                  <span className="text-[0.85rem] text-[var(--muted)] truncate">{f.note}</span>
                  <span className="ml-auto num text-[0.92rem] text-[var(--ink-soft)] whitespace-nowrap">{f.amt}</span>
                </div>
              ))}
            </div>
            <div className="flex items-baseline justify-between px-6 py-4" style={{ borderTop: "1px solid var(--line)", background: "var(--bg)" }}>
              <span className="text-[0.9rem] text-[var(--muted)]">Caught before payment</span>
              <span className="num text-[1.35rem] text-[var(--ink)]">$6,051</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
