"use client";

import { useState } from "react";
import { ArrowUpRight, ChevronDown } from "lucide-react";
import { formatReleaseDate } from "@/lib/format";
import type { ReleasePayload } from "@/lib/types";

function summaryFromBody(body?: string | null) {
  if (!body) return "Release published with installer assets and repository updates.";

  const clean = body
    .replace(/[#>*`]/g, "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 3);

  return clean.length > 0 ? clean.join(" ") : "Release published with installer assets and repository updates.";
}

export function ChangelogAccordion({ releases }: { releases: ReleasePayload[] }) {
  const [openIndex, setOpenIndex] = useState(0);

  return (
    <section className="section-shell py-24 sm:py-32">
      <div className="mx-auto max-w-4xl">
        <span className="eyebrow">Changelog</span>
        <h2 className="font-display text-4xl leading-tight text-bone">The last three Atlas releases, condensed for scanning and linked back to GitHub.</h2>
        <div className="mt-10 space-y-4">
          {releases.map((release, index) => {
            const open = index === openIndex;
            return (
              <div key={release.tag_name} className="panel overflow-hidden">
                <button
                  type="button"
                  className="focus-ring flex w-full items-center justify-between gap-6 px-5 py-5 text-left sm:px-6"
                  aria-expanded={open}
                  onClick={() => setOpenIndex(open ? -1 : index)}
                >
                  <div>
                    <p className="text-xs uppercase tracking-[0.28em] text-sand">{formatReleaseDate(release.published_at)}</p>
                    <p className="mt-2 font-display text-3xl text-bone">{release.tag_name}</p>
                  </div>
                  <ChevronDown className={`h-5 w-5 shrink-0 text-bone transition ${open ? "rotate-180" : ""}`} />
                </button>
                {open ? (
                  <div className="border-t border-white/10 px-5 py-5 sm:px-6">
                    <p className="max-w-3xl text-base leading-8 text-mist">{summaryFromBody(release.body)}</p>
                    <div className="mt-5 flex flex-wrap gap-3 text-sm text-bone">
                      <span className="rounded-full border border-white/10 px-3 py-1">
                        {release.assets.length} installer asset{release.assets.length === 1 ? "" : "s"}
                      </span>
                      <a
                        href={release.html_url}
                        className="focus-ring inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1 transition hover:border-amber-400/40 hover:bg-white/5"
                      >
                        Full release
                        <ArrowUpRight className="h-4 w-4" />
                      </a>
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
