"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useMode } from "@/context/ModeContext";
import { AxerisLogo } from "@/components/ui/AxerisLogo";

export default function RootRedirect() {
  const { modeConfig } = useMode();
  const router = useRouter();

  useEffect(() => {
    router.replace(modeConfig.homeRoute);
  }, [modeConfig.homeRoute, router]);

  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 py-24">
      <div className="animate-pulse">
        <AxerisLogo size={40} />
      </div>
      <p className="text-xs tracking-[0.14em] uppercase text-gray-400">{modeConfig.label} console</p>
    </div>
  );
}
