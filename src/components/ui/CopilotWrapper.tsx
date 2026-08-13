"use client";

import dynamic from "next/dynamic";

const CopilotPanel = dynamic(() => import("./CopilotPanel"), { ssr: false });

export default function CopilotWrapper() {
  return <CopilotPanel />;
}
