import Link from "next/link";
import Image from "next/image";

export default function Footer() {
  return (
    <footer className="bg-[#0a0a0a] text-white pt-16 pb-8 px-10">
      <div className="max-w-[1280px] mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1.2fr] gap-12 mb-12">
          {/* Brand */}
          <div>
            <Link href="/" className="flex items-center gap-2.5 no-underline mb-4">
              <Image
                src="/logos/axeris-logo.png"
                alt="Axeris"
                width={32}
                height={32}
                className="w-8 h-8 rounded-lg"
                style={{ objectFit: "contain" }}
              />
              <span className="text-[1.4rem] font-bold text-white tracking-[-0.5px]">Axeris</span>
            </Link>
            <p className="text-[0.85rem] text-white/50 max-w-[260px] leading-[1.6] mb-5">
              AI Prescription Intelligence. Catch the waste. Protect the patient.
            </p>
            <p className="text-[0.78rem] text-white/30 leading-[1.6]">
              Evidence-first. Cost-second.
            </p>
          </div>

          {/* Solutions */}
          <div>
            <h5 className="text-[0.78rem] font-semibold uppercase tracking-[1.5px] text-white/40 mb-5">Solutions</h5>
            <ul className="list-none space-y-3">
              {["For Employers", "For Insurers", "For Health Systems", "Shadow Mode", "Advisory Mode", "Policy Mode"].map((link) => (
                <li key={link}>
                  <Link href="#" className="text-[0.88rem] text-white/70 no-underline hover:text-white transition-colors">{link}</Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div>
            <h5 className="text-[0.78rem] font-semibold uppercase tracking-[1.5px] text-white/40 mb-5">Company</h5>
            <ul className="list-none space-y-3">
              {["How It Works", "Why Axeris", "Team", "Privacy Policy", "Terms of Service"].map((link) => (
                <li key={link}>
                  <Link href="#" className="text-[0.88rem] text-white/70 no-underline hover:text-white transition-colors">{link}</Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h5 className="text-[0.78rem] font-semibold uppercase tracking-[1.5px] text-white/40 mb-5">Contact</h5>
            <ul className="list-none space-y-3">
              <li><Link href="mailto:info@axeris.ai" className="text-[0.88rem] text-white/70 no-underline hover:text-white transition-colors">info@axeris.ai</Link></li>
              <li><Link href="https://proto2-mocha.vercel.app/" target="_blank" rel="noopener noreferrer" className="text-[0.88rem] text-white/70 no-underline hover:text-white transition-colors">Try Live Demo</Link></li>
              <li><Link href="#" className="text-[0.88rem] text-white/70 no-underline hover:text-white transition-colors">Book a Call</Link></li>
            </ul>
          </div>
        </div>

        {/* Bottom */}
        <div className="border-t border-white/[0.08] pt-6 flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-[0.82rem] text-white/40">&copy; {new Date().getFullYear()} Axeris. All rights reserved.</p>
          <div className="flex gap-4">
            <Link
              href="#"
              className="w-9 h-9 rounded-lg bg-white/[0.06] flex items-center justify-center text-white/50 no-underline text-[0.85rem] hover:bg-white/[0.12] hover:text-white transition-all"
              aria-label="LinkedIn"
            >
              in
            </Link>
            <Link
              href="#"
              className="w-9 h-9 rounded-lg bg-white/[0.06] flex items-center justify-center text-white/50 no-underline text-[0.85rem] hover:bg-white/[0.12] hover:text-white transition-all"
              aria-label="Twitter"
            >
              𝕏
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
