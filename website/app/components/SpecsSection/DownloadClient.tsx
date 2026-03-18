"use client";

import { useMemo } from "react";
import { ArrowUpRight, Download } from "lucide-react";
import { detectClientOs, selectPreferredAsset } from "@/lib/os";
import type { ReleasePayload } from "@/lib/types";

export function DownloadClient({ release }: { release: ReleasePayload }) {
  const currentOs = detectClientOs();
  const selected = useMemo(() => (currentOs ? selectPreferredAsset(currentOs, release.assets) : null), [currentOs, release.assets]);

  return (
    <div className="flex flex-col gap-4 sm:flex-row">
      <a
        href={selected?.url ?? release.html_url ?? "https://github.com/Rifaque/atlas/releases"}
        className="focus-ring inline-flex items-center justify-center gap-2 rounded-full bg-bone px-6 py-3 text-sm font-semibold text-ink transition hover:bg-white"
      >
        <Download className="h-4 w-4" />
        {selected ? `Download for ${selected.os}` : "Browse all downloads"}
      </a>
      <a
        href={release.html_url ?? "https://github.com/Rifaque/atlas/releases"}
        className="focus-ring inline-flex items-center justify-center gap-2 rounded-full border border-white/10 px-6 py-3 text-sm font-semibold text-bone transition hover:border-amber-400/40 hover:bg-white/5"
      >
        Release notes
        <ArrowUpRight className="h-4 w-4" />
      </a>
    </div>
  );
}
