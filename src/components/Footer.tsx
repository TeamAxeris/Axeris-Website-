import Link from "next/link";
import Image from "next/image";

const nav = [
  { label: "Problem", href: "#problem" },
  { label: "How it works", href: "#how-it-works" },
  { label: "Why Axeris", href: "#why-axeris" },
  { label: "Team", href: "#team" },
  { label: "Live Demo", href: "https://proto2-mocha.vercel.app/" },
  { label: "Contact", href: "https://mail.google.com/mail/?view=cm&fs=1&to=info@axeris.ai&su=Axeris" },
];

export default function Footer() {
  return (
    <footer className="relative overflow-hidden pt-24" style={{ background: "var(--bg)" }}>
      <div className="container-wide relative z-[2]">
        {/* top meta row */}
        <div className="flex flex-col sm:flex-row justify-between gap-4 mb-4">
          <div>
            <p className="text-[0.95rem] text-[var(--ink)]">The clinical layer between prescribing and payment</p>
            <p className="text-[0.85rem] text-[var(--muted)] mt-1">&copy; {new Date().getFullYear()} Axeris. All rights reserved.</p>
          </div>
          <Link href="https://mail.google.com/mail/?view=cm&fs=1&to=info@axeris.ai&su=Axeris" target="_blank" rel="noopener noreferrer" className="text-[0.9rem] text-[var(--ink)] no-underline border-b border-[var(--ink)] self-start pb-0.5 hover:text-[var(--blue)] hover:border-[var(--blue)] transition-colors">
            INFO@AXERIS.AI
          </Link>
        </div>
      </div>

      {/* giant wordmark rising from an aurora dome */}
      <div className="relative flex justify-center items-end mt-6" style={{ minHeight: "clamp(180px, 30vw, 440px)" }}>
        <div className="aurora" style={{ bottom: "-42%", left: "50%", transform: "translateX(-50%)", width: "min(1200px, 120vw)", height: "min(720px, 90vw)", opacity: 0.85 }} />
        <div
          className="display grad-text leading-[0.78] select-none relative z-[2] text-center px-4"
          style={{ fontSize: "clamp(5rem, 25vw, 23rem)", letterSpacing: "0.005em" }}
        >
          Axeris
        </div>
      </div>

      {/* bottom nav row */}
      <div className="container-wide relative z-[2] pt-10 pb-10 flex flex-col sm:flex-row items-center justify-between gap-6" style={{ borderTop: "1px solid var(--line)" }}>
        <Link href="/" className="flex items-center gap-2.5 no-underline">
          <Image src="/logos/axeris-logo.png" alt="Axeris" width={26} height={26} className="w-[26px] h-[26px] rounded-md" style={{ objectFit: "contain" }} />
          <span className="text-[1.05rem] font-semibold text-[var(--ink)] tracking-[-0.02em]">Axeris</span>
        </Link>
        <div className="flex items-center gap-6 flex-wrap justify-center">
          {nav.map((n) => (
            <Link key={n.label} href={n.href} target={n.href.startsWith("http") ? "_blank" : undefined} rel={n.href.startsWith("http") ? "noopener noreferrer" : undefined} className="text-[0.9rem] text-[var(--ink-soft)] hover:text-[var(--ink)] no-underline transition-colors">
              {n.label}
            </Link>
          ))}
        </div>
      </div>
    </footer>
  );
}
