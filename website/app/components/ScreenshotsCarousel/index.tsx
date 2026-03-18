"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import FocusTrap from "focus-trap-react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { screenshots } from "@/lib/content";

export function ScreenshotsCarousel() {
  const railRef = useRef<HTMLDivElement | null>(null);
  const closeFocusRef = useRef<HTMLButtonElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [modalIndex, setModalIndex] = useState<number | null>(null);

  const scrollToIndex = (index: number) => {
    const rail = railRef.current;
    const card = rail?.children.item(index) as HTMLElement | null;
    if (!rail || !card) return;
    card.scrollIntoView({ behavior: "smooth", inline: "start", block: "nearest" });
    setActiveIndex(index);
  };

  useEffect(() => {
    if (modalIndex === null) return;
    closeFocusRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setModalIndex(null);
        triggerRef.current?.focus();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [modalIndex]);

  return (
    <section id="screenshots" aria-labelledby="screenshots-title" className="section-shell py-24 sm:py-32">
      <div className="mb-10 flex flex-wrap items-end justify-between gap-6">
        <div className="max-w-2xl">
          <span className="eyebrow">Screenshots</span>
          <h2 id="screenshots-title" className="font-display text-4xl leading-tight text-bone">
            The product preview now lives here: a tighter gallery with sharper framing, stronger captions, and clearer signals from the real desktop app.
          </h2>
          <p className="mt-5 text-lg leading-8 text-mist">
            Instead of inserting a separate simulated demo block, Atlas moves straight from capability into product surfaces. That keeps the pacing cleaner and makes each still work harder.
          </p>
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            className="focus-ring rounded-full border border-white/10 p-3 text-bone transition hover:border-amber-400/40 hover:bg-white/5"
            onClick={() => scrollToIndex(Math.max(activeIndex - 1, 0))}
            aria-label="Previous screenshot"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="focus-ring rounded-full border border-white/10 p-3 text-bone transition hover:border-amber-400/40 hover:bg-white/5"
            onClick={() => scrollToIndex(Math.min(activeIndex + 1, screenshots.length - 1))}
            aria-label="Next screenshot"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div ref={railRef} className="flex snap-x snap-mandatory gap-6 overflow-x-auto pb-4" role="region" aria-label="Atlas screenshots">
        {screenshots.map((shot, index) => (
          <article key={shot.id} className="panel min-w-[85%] snap-start overflow-hidden sm:min-w-[45%] lg:min-w-[32%]">
            <button
              type="button"
              className="focus-ring block w-full text-left"
              onClick={(event) => {
                triggerRef.current = event.currentTarget;
                setModalIndex(index);
              }}
            >
              <div className="relative aspect-[4/3] overflow-hidden">
                <Image src={shot.image} alt={shot.alt} fill className="object-cover" sizes="(max-width: 768px) 85vw, 32vw" />
              </div>
              <div className="border-t border-white/10 p-5">
                <h3 className="font-display text-2xl text-bone">{shot.title}</h3>
                <p className="mt-3 text-sm leading-7 text-mist">{shot.caption}</p>
                <p className="mt-4 text-[11px] uppercase tracking-[0.22em] text-sand">
                  Click to inspect full frame
                </p>
              </div>
            </button>
          </article>
        ))}
      </div>

      {modalIndex !== null ? (
        <FocusTrap active>
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-4 py-8 backdrop-blur-md"
            role="dialog"
            aria-modal="true"
            aria-labelledby="screenshot-modal-title"
            onClick={() => setModalIndex(null)}
          >
            <div className="panel relative max-h-full w-full max-w-5xl overflow-hidden" onClick={(event) => event.stopPropagation()}>
              <button
                ref={closeFocusRef}
                type="button"
                className="focus-ring absolute right-5 top-5 z-10 rounded-full border border-white/10 bg-ink/80 p-3 text-bone"
                onClick={() => {
                  setModalIndex(null);
                  triggerRef.current?.focus();
                }}
                aria-label="Close screenshot viewer"
              >
                <X className="h-4 w-4" />
              </button>
              <div className="relative aspect-[16/10] w-full">
                <Image src={screenshots[modalIndex].image} alt={screenshots[modalIndex].alt} fill className="object-cover" sizes="90vw" />
              </div>
              <div className="border-t border-white/10 p-6 sm:p-8">
                <h3 id="screenshot-modal-title" className="font-display text-3xl text-bone">
                  {screenshots[modalIndex].title}
                </h3>
                <p className="mt-4 max-w-3xl text-base leading-8 text-mist">{screenshots[modalIndex].caption}</p>
              </div>
            </div>
          </div>
        </FocusTrap>
      ) : null}
    </section>
  );
}
