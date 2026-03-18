"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Download, Github, ShieldCheck, Sparkles } from "lucide-react";
import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { heroCopy } from "@/lib/content";
import { usePrefersReducedMotion } from "@/lib/motion";

export function Hero() {
  const sectionRef = useRef<HTMLElement | null>(null);
  const mediaRef = useRef<HTMLDivElement | null>(null);
  const reducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);
    if (reducedMotion || !sectionRef.current || !mediaRef.current) return;

    const ctx = gsap.context(() => {
      gsap.to(mediaRef.current, {
        yPercent: -12,
        ease: "none",
        scrollTrigger: {
          trigger: sectionRef.current,
          scrub: 0.9,
          start: "top top",
          end: "bottom top"
        }
      });
    }, sectionRef);

    return () => ctx.revert();
  }, [reducedMotion]);

  return (
    <section id="top" ref={sectionRef} className="relative overflow-hidden pt-10 sm:pt-16">
      <div className="section-shell grid min-h-[calc(100vh-4rem)] items-center gap-10 pb-16 pt-10 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16 lg:pb-24">
        <div className="relative z-10 max-w-3xl">
          <span className="eyebrow">
            <Sparkles className="h-3.5 w-3.5" />
            Local-first workspace intelligence
          </span>
          <h1 className="headline max-w-4xl text-balance text-[clamp(3.5rem,8vw,6.6rem)]">
            {heroCopy.title}
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-mist sm:text-xl">{heroCopy.subtitle}</p>
          <div className="mt-8 flex flex-col gap-4 sm:flex-row">
            <Link
              href="#downloads"
              className="focus-ring inline-flex items-center justify-center gap-2 rounded-full bg-bone px-6 py-3 text-sm font-semibold text-ink transition hover:bg-white"
            >
              <Download className="h-4 w-4" />
              Download Atlas
            </Link>
            <Link
              href="https://github.com/Rifaque/atlas"
              className="focus-ring inline-flex items-center justify-center gap-2 rounded-full border border-white/10 px-6 py-3 text-sm font-semibold text-bone transition hover:border-amber-400/40 hover:bg-white/5"
            >
              <Github className="h-4 w-4" />
              View on GitHub
            </Link>
          </div>
          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
              <ShieldCheck className="h-5 w-5 text-amber-300" />
              <p className="mt-3 text-sm font-medium text-bone">Privacy-first RAG</p>
              <p className="mt-2 text-sm leading-6 text-mist">Local storage, local models, and optional cloud routing behind secret shielding.</p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
              <ArrowRight className="h-5 w-5 text-amber-300" />
              <p className="mt-3 text-sm font-medium text-bone">Temporal context</p>
              <p className="mt-2 text-sm leading-6 text-mist">Follow changes over time with timeline intelligence and Git-aware summaries.</p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
              <Sparkles className="h-5 w-5 text-amber-300" />
              <p className="mt-3 text-sm font-medium text-bone">Agentic workflows</p>
              <p className="mt-2 text-sm leading-6 text-mist">Search, review, inspect, and propose edits inside a bounded local surface.</p>
            </div>
          </div>
        </div>

        <div ref={mediaRef} className="relative">
          <div className="panel relative overflow-hidden p-3">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(216,161,76,0.18),transparent_35%),linear-gradient(180deg,rgba(255,255,255,0.06),transparent)]" />
            <div className="relative overflow-hidden rounded-[1.6rem] border border-white/10 bg-[#0d1014]">
              <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.28em] text-sand">Launch preview</p>
                  <p className="mt-1 font-display text-2xl text-bone">Atlas Desktop</p>
                </div>
                <div className="flex gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-rose-400/80" />
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-300/80" />
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/80" />
                </div>
              </div>
              <div className="relative min-h-[420px] bg-[linear-gradient(180deg,rgba(255,255,255,0.04),transparent),linear-gradient(135deg,#0e1216_0%,#0b0e12_100%)]">
                <div className="grid gap-6 p-5 lg:grid-cols-[0.38fr_0.62fr]">
                  <div className="rounded-[1.4rem] border border-white/10 bg-white/[0.03] p-4">
                    <p className="text-xs uppercase tracking-[0.28em] text-sand">Workspace</p>
                    <div className="mt-4 space-y-3">
                      {["Architecture", "Timeline", "Search", "Analytics"].map((item) => (
                        <div key={item} className="rounded-2xl border border-white/10 bg-graphite px-4 py-3 text-sm text-bone">
                          {item}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div className="rounded-[1.4rem] border border-white/10 bg-white/[0.03] p-4">
                      <div className="flex items-center justify-between">
                        <p className="text-xs uppercase tracking-[0.28em] text-sand">Assistant</p>
                        <span className="rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1 text-[11px] text-amber-200">
                          Architect persona
                        </span>
                      </div>
                      <p className="mt-4 max-w-lg text-sm leading-7 text-mist">
                        Atlas mapped this repo into hybrid retrieval, GraphRAG entities, and a timeline layer. Start with the Tauri commands and workspace layout if you need a high-confidence onboarding path.
                      </p>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-[1.1fr_0.9fr]">
                      <div className="rounded-[1.4rem] border border-white/10 bg-white/[0.03] p-4">
                        <p className="text-xs uppercase tracking-[0.28em] text-sand">Architecture graph</p>
                        <div className="mt-4 h-40 rounded-[1.2rem] border border-white/10 bg-[radial-gradient(circle_at_20%_20%,rgba(216,161,76,0.18),transparent_30%),radial-gradient(circle_at_80%_30%,rgba(148,163,184,0.2),transparent_26%),#0c1014]">
                          <Image
                            src="/img/atlas-thumbnail.png"
                            alt="Atlas product preview"
                            width={1200}
                            height={675}
                            className="h-full w-full object-cover opacity-55 mix-blend-screen"
                            priority
                          />
                        </div>
                      </div>
                      <div className="rounded-[1.4rem] border border-white/10 bg-white/[0.03] p-4">
                        <p className="text-xs uppercase tracking-[0.28em] text-sand">Signals</p>
                        <div className="mt-4 space-y-3">
                          {[
                            "5,000+ files indexed",
                            "Hybrid search + citations",
                            "Secret Shield before cloud calls"
                          ].map((item) => (
                            <div key={item} className="rounded-2xl bg-white/[0.03] px-4 py-3 text-sm text-bone">
                              {item}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
