"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import clsx from "clsx";
import { Shield, Sparkles, Waypoints } from "lucide-react";
import type { FeatureItem } from "@/lib/types";
import { usePrefersReducedMotion } from "@/lib/motion";

const iconMap = {
  local: Shield,
  personas: Sparkles,
  timeline: Waypoints,
  agentic: Sparkles
};

export function FeaturePanel({ feature }: { feature: FeatureItem }) {
  const sectionRef = useRef<HTMLDivElement | null>(null);
  const reducedMotion = usePrefersReducedMotion();
  const Icon = iconMap[feature.id as keyof typeof iconMap] || Sparkles;

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);
    if (reducedMotion || !sectionRef.current) return;

    const ctx = gsap.context(() => {
      const targets = sectionRef.current?.querySelectorAll("[data-reveal]");
      if (!targets?.length) return;
      gsap.fromTo(
        targets,
        { autoAlpha: 0, y: 28 },
        {
          autoAlpha: 1,
          y: 0,
          duration: 0.9,
          ease: "power2.out",
          stagger: 0.1,
          scrollTrigger: {
            trigger: sectionRef.current,
            start: "top 78%"
          }
        }
      );
    }, sectionRef);

    return () => ctx.revert();
  }, [reducedMotion]);

  return (
    <div
      ref={sectionRef}
      className={clsx(
        "story-grid items-center gap-y-8 rounded-[2.25rem] border border-white/10 bg-white/[0.02] p-6 sm:p-8 lg:p-10",
        feature.align === "right" ? "lg:[&>*:first-child]:order-2" : ""
      )}
    >
      <div className="col-span-12 lg:col-span-6">
        <span data-reveal className="eyebrow">
          <Icon className="h-3.5 w-3.5" />
          {feature.eyebrow}
        </span>
        <h2 data-reveal className="font-display text-3xl leading-tight text-bone sm:text-4xl">
          {feature.title}
        </h2>
        <p data-reveal className="mt-5 max-w-2xl text-base leading-7 text-mist sm:text-lg">
          {feature.description}
        </p>
        <ul className="mt-8 space-y-3">
          {feature.bullets.map((bullet) => (
            <li
              key={bullet}
              data-reveal
              className="flex items-start gap-3 rounded-2xl border border-white/10 bg-ink/60 px-4 py-3 text-sm leading-6 text-bone"
            >
              <span className="mt-1 inline-block h-2 w-2 rounded-full bg-amber-300" />
              <span>{bullet}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="col-span-12 lg:col-span-6">
        <div data-reveal className="panel overflow-hidden p-5">
          <div className="rounded-[1.6rem] border border-white/10 bg-[linear-gradient(160deg,#12161c_0%,#0c1014_65%,#0b0d11_100%)] p-5">
            <div className="grid grid-cols-6 gap-3">
              {Array.from({ length: 12 }, (_, index) => (
                <div
                  key={index}
                  className={clsx(
                    "rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-xs text-mist",
                    index % 5 === 0 ? "col-span-3" : "col-span-2",
                    index % 4 === 0 ? "min-h-24" : "min-h-20"
                  )}
                >
                  <div className="h-2 w-14 rounded-full bg-white/10" />
                  <div className="mt-4 space-y-2">
                    <div className="h-2 rounded-full bg-white/10" />
                    <div className="h-2 w-4/5 rounded-full bg-white/10" />
                    <div className="h-2 w-2/3 rounded-full bg-amber-300/50" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
