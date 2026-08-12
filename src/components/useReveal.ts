"use client";

import { useEffect, useRef } from "react";

export function useReveal() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Arm the reveal system only once JS is confirmed running (see globals.css).
    document.documentElement.classList.add("has-reveal");
    const targets = Array.from(el.querySelectorAll<HTMLElement>(".reveal"));

    // Fallback: if IntersectionObserver is unavailable, show everything.
    if (typeof IntersectionObserver === "undefined") {
      targets.forEach((t) => t.classList.add("visible"));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
            observer.unobserve(entry.target);
          }
        });
      },
      // Pre-trigger: reveal as content approaches, so nothing sits blank.
      { threshold: 0, rootMargin: "0px 0px 15% 0px" }
    );

    targets.forEach((t) => observer.observe(t));

    // Safety net: never leave content hidden longer than 1.2s.
    const safety = setTimeout(() => targets.forEach((t) => t.classList.add("visible")), 1200);

    return () => {
      observer.disconnect();
      clearTimeout(safety);
    };
  }, []);

  return ref;
}
