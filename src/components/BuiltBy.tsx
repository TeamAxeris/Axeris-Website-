"use client";

import Image from "next/image";

const logos = [
  { src: "/logos/harvard-shield.png", alt: "Harvard University", h: 30 },
  { src: "/logos/uchicago.png", alt: "University of Chicago", h: 38 },
  { src: "/logos/jhu.png", alt: "Johns Hopkins University", h: 32 },
];

export default function BuiltBy() {
  return (
    <div className="container-wide flex flex-wrap items-center gap-x-9 gap-y-4 pb-6">
      <span className="text-[0.8rem] text-[var(--muted)]">Built by founders from</span>
      <div className="flex items-center gap-9">
        {logos.map((l) => (
          <Image
            key={l.src}
            src={l.src}
            alt={l.alt}
            width={80}
            height={90}
            className="w-auto opacity-45 hover:opacity-70 transition-opacity duration-300"
            style={{ height: l.h, objectFit: "contain", filter: "grayscale(1)" }}
          />
        ))}
      </div>
    </div>
  );
}
