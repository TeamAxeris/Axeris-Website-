"use client";

import Image from "next/image";
import { useReveal } from "./useReveal";

const founders = [
  { name: "Adan Eftekhari", title: "Chief Executive Officer", image: "/team/adan-eftekhari-2.jpg", school: "Harvard University", field: "Biology & Economics", linkedin: "https://www.linkedin.com/in/adan-eftekhari/" },
  { name: "Kareem Malhis", title: "Chief Product Officer", image: "/team/kareem-malhis.jpg", school: "Johns Hopkins University", field: "Electrical & Computer Engineering", linkedin: "https://www.linkedin.com/in/kareem-malhis/" },
  { name: "Khartik Uppalapati", title: "Chief Technology Officer", image: "/team/khartik-uppalapati.jpg", school: "University of Chicago", field: "CS, Econ & Biological Chemistry", linkedin: "https://www.linkedin.com/in/khartik-uppalapati/" },
];

export default function Team() {
  const ref = useReveal();

  return (
    <section ref={ref} id="team" className="py-[72px]">
      <div className="container-wide">
        <h2 className="headline reveal text-[2.5rem] sm:text-[3.3rem] text-[var(--ink)] max-w-[16ch] mb-11">
          Built by people who understand both sides.
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-12 gap-y-14">
          {founders.map((m, i) => (
            <div key={m.name} className={`reveal reveal-${i + 1}`}>
              <div className="w-full aspect-[4/5] rounded-2xl overflow-hidden mb-6" style={{ background: "var(--bg-warm)" }}>
                <Image src={m.image} alt={m.name} width={420} height={525}
                       className="w-full h-full object-cover grayscale hover:grayscale-0 transition-all duration-500"
                       style={
                         i === 0 ? { objectPosition: "50% 4%", transform: "translateY(4%) scale(1.5)", transformOrigin: "50% 30%" }
                         : i === 1 ? { transform: "scale(1.3)", transformOrigin: "50% 32%" }
                         : undefined
                       } />
              </div>
              <h3 className="text-[1.22rem] font-normal text-[var(--ink)] leading-tight mb-1 tracking-[-0.01em]">{m.name}</h3>
              <p className="text-[0.92rem] text-[var(--blue)] mb-3">{m.title}</p>
              <p className="text-[0.98rem] text-[var(--ink-soft)]">{m.school}</p>
              <p className="text-[0.9rem] text-[var(--muted)] mb-4">{m.field}</p>
              <a href={m.linkedin} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-[0.88rem] link-quiet" aria-label={`${m.name} on LinkedIn`}>
                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
                LinkedIn
              </a>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
