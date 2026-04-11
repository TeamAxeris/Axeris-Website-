"use client";

import Image from "next/image";

export default function BuiltBy() {
  return (
    <div className="bg-white py-6 px-10 border-b border-[#e4e4e4]">
      <div className="max-w-[1280px] mx-auto flex items-center justify-center gap-8">
        <span className="text-[0.75rem] font-medium uppercase tracking-[1.5px] text-[#d1d1d1]">
          Built by founders from
        </span>
        <div className="flex items-center gap-8">
          <Image
            src="/logos/harvard-shield.png"
            alt="Harvard University"
            width={85}
            height={100}
            className="h-[38px] w-auto opacity-85 grayscale hover:opacity-100 transition-all duration-300"
            style={{ objectFit: "contain" }}
          />
          <Image
            src="/logos/uchicago.png"
            alt="University of Chicago"
            width={85}
            height={100}
            className="h-[50px] w-auto opacity-85 grayscale hover:opacity-100 transition-all duration-300"
            style={{ objectFit: "contain" }}
          />
          <Image
            src="/logos/jhu.png"
            alt="Johns Hopkins University"
            width={85}
            height={100}
            className="h-[42px] w-auto opacity-85 grayscale hover:opacity-100 transition-all duration-300"
            style={{ objectFit: "contain" }}
          />
        </div>
      </div>
    </div>
  );
}
