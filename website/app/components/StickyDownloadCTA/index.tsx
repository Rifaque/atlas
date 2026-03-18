"use client";

import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";
import type { ReleasePayload } from "@/lib/types";
import { detectClientOs, selectPreferredAsset } from "@/lib/os";

const STORAGE_KEY = "atlas-launch-cta-dismissed";

export function StickyDownloadCTA({ release }: { release: ReleasePayload }) {
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setDismissed(window.sessionStorage.getItem(STORAGE_KEY) === "true");

    const onScroll = () => setVisible(window.scrollY > window.innerHeight * 0.75);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const os = detectClientOs();
  const asset = os ? selectPreferredAsset(os, release.assets) : null;

  if (dismissed || !visible) return null;

  return (
    <div className="fixed inset-x-4 bottom-4 z-40 md:hidden">
      <div className="panel flex items-center gap-3 rounded-[1.6rem] px-4 py-3">
        <a
          href={asset?.url ?? release.html_url}
          className="focus-ring inline-flex min-w-0 flex-1 items-center justify-center gap-2 rounded-full bg-bone px-4 py-3 text-sm font-semibold text-ink"
        >
          <Download className="h-4 w-4" />
          <span className="truncate">{asset ? `Download for ${asset.os}` : "View downloads"}</span>
        </a>
        <button
          type="button"
          className="focus-ring rounded-full border border-white/10 p-3 text-bone"
          aria-label="Dismiss download bar"
          onClick={() => {
            window.sessionStorage.setItem(STORAGE_KEY, "true");
            setDismissed(true);
          }}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
