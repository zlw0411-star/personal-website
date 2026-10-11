"use client";

import { useEffect, useRef } from "react";

export default function Reveal({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element || !("IntersectionObserver" in window)) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let observer: IntersectionObserver | null = null;
    try {
      observer = new IntersectionObserver((records) => {
        for (const record of records) {
          if (record.isIntersecting) {
            record.target.classList.add("rr-reveal-visible");
            observer?.unobserve(record.target);
          }
        }
      }, { threshold: 0, rootMargin: "0px 0px -16px 0px" });

      if (element.getBoundingClientRect().top > window.innerHeight) {
        element.classList.add("rr-reveal-pending");
      } else {
        element.classList.add("rr-reveal-visible");
      }
      observer.observe(element);
    } catch {
      element.classList.remove("rr-reveal-pending", "rr-reveal-visible");
      observer?.disconnect();
      return;
    }

    return () => {
      observer?.disconnect();
      element.classList.remove("rr-reveal-pending", "rr-reveal-visible");
    };
  }, []);

  return <div ref={ref} className={`rr-reveal ${className}`.trim()}>{children}</div>;
}
