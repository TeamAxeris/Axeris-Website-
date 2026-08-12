"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";

const links = [
  { label: "Problem", href: "#problem" },
  { label: "How it works", href: "#how-it-works" },
  { label: "Why Axeris", href: "#why-axeris" },
  { label: "Team", href: "#team" },
];

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-[1000] transition-all duration-300"
      style={{
        background: scrolled ? "rgba(246,244,239,0.8)" : "transparent",
        backdropFilter: scrolled ? "blur(16px)" : "none",
        WebkitBackdropFilter: scrolled ? "blur(16px)" : "none",
        borderBottom: scrolled ? "1px solid var(--line)" : "1px solid transparent",
      }}
    >
      <div className="container-wide h-[76px] flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5 no-underline">
          <Image src="/logos/axeris-logo.png" alt="Axeris" width={30} height={30} className="w-[30px] h-[30px] rounded-lg" style={{ objectFit: "contain" }} />
          <span className="text-[1.3rem] font-semibold tracking-[-0.02em] text-[var(--ink)]">Axeris</span>
        </Link>

        <div className="hidden lg:flex items-center gap-9">
          {links.map((l) => (
            <Link key={l.label} href={l.href} className="text-[0.92rem] text-[var(--ink-soft)] hover:text-[var(--ink)] no-underline transition-colors">
              {l.label}
            </Link>
          ))}
          <Link href="https://proto2-mocha.vercel.app/" target="_blank" rel="noopener noreferrer" className="btn btn-primary !py-2.5 !px-5 !text-[0.88rem]">
            Try Live Demo
          </Link>
        </div>

        <button className="lg:hidden p-2 bg-transparent border-none cursor-pointer" onClick={() => setMobileOpen(!mobileOpen)} aria-label="Menu">
          <span className={`block w-6 h-0.5 bg-[var(--ink)] transition-all duration-300 ${mobileOpen ? "rotate-45 translate-y-[7px]" : "my-[5px]"}`} />
          <span className={`block w-6 h-0.5 bg-[var(--ink)] transition-all duration-300 ${mobileOpen ? "opacity-0" : "my-[5px]"}`} />
          <span className={`block w-6 h-0.5 bg-[var(--ink)] transition-all duration-300 ${mobileOpen ? "-rotate-45 -translate-y-[7px]" : "my-[5px]"}`} />
        </button>
      </div>

      {mobileOpen && (
        <div className="lg:hidden px-6 py-6 space-y-4" style={{ background: "var(--paper)", borderTop: "1px solid var(--line)" }}>
          {links.map((l) => (
            <Link key={l.label} href={l.href} onClick={() => setMobileOpen(false)} className="block text-[1rem] text-[var(--ink-soft)] no-underline">{l.label}</Link>
          ))}
          <Link href="https://proto2-mocha.vercel.app/" target="_blank" rel="noopener noreferrer" className="btn btn-primary mt-2">Try Live Demo</Link>
        </div>
      )}
    </nav>
  );
}
