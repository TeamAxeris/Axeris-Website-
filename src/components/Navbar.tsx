"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-[1000] border-b border-black/[0.06] transition-all duration-300"
      style={{
        background: "rgba(255,255,255,0.92)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        boxShadow: scrolled ? "0 1px 8px rgba(0,0,0,0.06)" : "none",
      }}
    >
      <div className="max-w-[1280px] mx-auto px-10 h-[72px] flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 no-underline">
          <Image
            src="/logos/axeris-logo.png"
            alt="Axeris"
            width={32}
            height={32}
            className="w-8 h-8 rounded-lg"
            style={{ objectFit: "contain" }}
          />
          <span className="text-[1.4rem] font-bold text-[#0a0a0a] tracking-[-0.5px]" style={{ fontFamily: "var(--font-body)" }}>
            Axeris
          </span>
        </Link>

        {/* Desktop Nav */}
        <div className="hidden lg:flex items-center gap-9">
          {/* Solutions Dropdown */}
          <div
            className="relative"
            onMouseEnter={() => setActiveDropdown("solutions")}
            onMouseLeave={() => setActiveDropdown(null)}
          >
            <div className="flex items-center gap-1 text-[0.9rem] font-medium text-[#404040] hover:text-[#0a0a0a] cursor-pointer transition-colors">
              Solutions
              <svg
                className={`w-3 h-3 transition-transform duration-200 ${activeDropdown === "solutions" ? "rotate-180" : ""}`}
                viewBox="0 0 12 12" fill="none"
              >
                <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div
              className={`absolute top-[calc(100%+12px)] left-1/2 -translate-x-1/2 min-w-[220px] bg-white border border-[#e4e4e4] rounded-xl p-2 shadow-[0_8px_32px_rgba(0,0,0,0.12)] transition-all duration-200 ${
                activeDropdown === "solutions" ? "opacity-100 visible" : "opacity-0 invisible"
              }`}
            >
              {["For Employers", "For Insurers", "For Health Systems"].map((item) => (
                <Link key={item} href="#" className="block px-3.5 py-2.5 rounded-lg text-[0.85rem] text-[#404040] hover:bg-[#f8f8f8] hover:text-[#0a0a0a] no-underline transition-all">
                  {item}
                </Link>
              ))}
            </div>
          </div>

          <Link href="#problem" className="text-[0.9rem] font-medium text-[#404040] hover:text-[#0a0a0a] no-underline transition-colors">Problem</Link>
          <Link href="#how-it-works" className="text-[0.9rem] font-medium text-[#404040] hover:text-[#0a0a0a] no-underline transition-colors">How It Works</Link>
          <Link href="#why-axeris" className="text-[0.9rem] font-medium text-[#404040] hover:text-[#0a0a0a] no-underline transition-colors">Why Axeris</Link>
          <Link href="#team" className="text-[0.9rem] font-medium text-[#404040] hover:text-[#0a0a0a] no-underline transition-colors">Team</Link>
          <Link
            href="https://proto2-mocha.vercel.app/"
            target="_blank"
            rel="noopener noreferrer"
            className="bg-[#0a0a0a] text-white px-6 py-2.5 rounded-full text-[0.85rem] font-semibold no-underline hover:bg-[#404040] hover:-translate-y-px transition-all"
          >
            Try Live Demo
          </Link>
        </div>

        {/* Mobile Toggle */}
        <button className="lg:hidden p-2 bg-transparent border-none cursor-pointer" onClick={() => setMobileOpen(!mobileOpen)}>
          <span className={`block w-6 h-0.5 bg-[#0a0a0a] transition-all duration-300 ${mobileOpen ? "rotate-45 translate-y-[7px]" : "my-[5px]"}`} />
          <span className={`block w-6 h-0.5 bg-[#0a0a0a] transition-all duration-300 ${mobileOpen ? "opacity-0" : "my-[5px]"}`} />
          <span className={`block w-6 h-0.5 bg-[#0a0a0a] transition-all duration-300 ${mobileOpen ? "-rotate-45 -translate-y-[7px]" : "my-[5px]"}`} />
        </button>
      </div>

      {mobileOpen && (
        <div className="lg:hidden bg-white border-t border-[#e4e4e4] px-5 py-6 space-y-3">
          {[
            { label: "For Employers", href: "#" },
            { label: "For Insurers", href: "#" },
            { label: "For Health Systems", href: "#" },
            { label: "Problem", href: "#problem" },
            { label: "How It Works", href: "#how-it-works" },
            { label: "Why Axeris", href: "#why-axeris" },
            { label: "Team", href: "#team" },
          ].map((item) => (
            <Link key={item.label} href={item.href} onClick={() => setMobileOpen(false)} className="block py-2 text-[0.9rem] text-[#404040] no-underline">{item.label}</Link>
          ))}
          <Link href="https://proto2-mocha.vercel.app/" target="_blank" rel="noopener noreferrer" className="inline-block mt-3 bg-[#0a0a0a] text-white px-6 py-2.5 rounded-full text-[0.85rem] font-semibold no-underline">
            Try Live Demo
          </Link>
        </div>
      )}
    </nav>
  );
}
