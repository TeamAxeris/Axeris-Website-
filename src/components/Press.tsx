"use client";

import { useReveal } from "./useReveal";

const stats = [
  { value: "$528B", label: "spent on prescription drugs in the U.S. each year" },
  { value: "$100B", label: "of that is wasted on avoidable, low-value scripts" },
  { value: "6B+", label: "prescriptions written every single year" },
  { value: "39", label: "prior authorizations per physician, per week" },
];

export default function Press() {
  const ref = useReveal();

  return (
    <section ref={ref} className="pt-8 pb-[72px]">
      <div className="container-wide">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-10">
          {stats.map((s, i) => (
            <div key={s.value} className={`reveal reveal-${i + 1} min-w-0`}>
              <div className="num text-[2.5rem] sm:text-[3.6rem] text-[var(--ink)] mb-3">{s.value}</div>
              <p className="text-[0.9rem] text-[var(--muted)] leading-[1.45] max-w-[200px]">{s.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
