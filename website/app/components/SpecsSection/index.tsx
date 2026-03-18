import { DownloadClient } from "@/app/components/SpecsSection/DownloadClient";
import { compactSha, formatBytes, formatReleaseDate } from "@/lib/format";
import { selectPreferredAsset } from "@/lib/os";
import type { OperatingSystem, ReleasePayload } from "@/lib/types";

const osLabels: Record<OperatingSystem, string> = {
  windows: "Windows",
  mac: "macOS",
  linux: "Linux"
};

export function SpecsSection({ release }: { release: ReleasePayload }) {
  const availableSystems = (["windows", "mac", "linux"] as OperatingSystem[]).filter((os) =>
    release.assets.some((asset) => asset.os === os)
  );

  return (
    <section id="downloads" className="section-shell py-24 sm:py-32">
      <div className="story-grid gap-y-8">
        <div className="col-span-12 lg:col-span-4">
          <span className="eyebrow">Downloads and specs</span>
          <h2 className="font-display text-4xl leading-tight text-bone">Versioned builds, normalized release metadata, and direct links that map cleanly to each platform.</h2>
          <p className="mt-5 text-lg leading-8 text-mist">
            Atlas pulls its release data from GitHub on the server, caches it for five minutes, and turns installer assets into a stable interface for the marketing site.
          </p>
          <div className="mt-8 rounded-[1.7rem] border border-white/10 bg-white/[0.03] p-5">
            <p className="text-xs uppercase tracking-[0.28em] text-sand">Current release</p>
            <p className="mt-3 font-display text-4xl text-bone">{release.tag_name}</p>
            <p className="mt-2 text-sm text-mist">Published {formatReleaseDate(release.published_at)}</p>
          </div>
          <div className="mt-6">
            <DownloadClient release={release} />
          </div>
        </div>

        <div className="col-span-12 lg:col-span-8">
          <div className="panel overflow-hidden">
            <div className="grid gap-0 border-b border-white/10 lg:grid-cols-3">
              {availableSystems.map((os) => {
                const asset = selectPreferredAsset(os, release.assets);
                return asset ? (
                  <div key={os} className="border-b border-white/10 p-5 last:border-b-0 lg:border-b-0 lg:border-r last:lg:border-r-0">
                    <p className="text-xs uppercase tracking-[0.28em] text-sand">{osLabels[os]}</p>
                    <p className="mt-3 break-all text-2xl font-semibold text-bone">{asset.name}</p>
                    <dl className="mt-5 space-y-3 text-sm text-mist">
                      <div className="flex justify-between gap-3">
                        <dt>Size</dt>
                        <dd>{formatBytes(asset.size)}</dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt>Version</dt>
                        <dd>{release.tag_name}</dd>
                      </div>
                      {asset.sha256 ? (
                        <div className="flex justify-between gap-3">
                          <dt>SHA256</dt>
                          <dd className="font-mono text-xs text-bone">{compactSha(asset.sha256)}</dd>
                        </div>
                      ) : null}
                    </dl>
                    <a
                      href={asset.url}
                      className="focus-ring mt-6 inline-flex rounded-full border border-white/10 px-4 py-2 text-sm font-medium text-bone transition hover:border-amber-400/40 hover:bg-white/5"
                    >
                      Download
                    </a>
                  </div>
                ) : null;
              })}
            </div>
            <div className="grid gap-6 p-5 sm:grid-cols-2 lg:grid-cols-3 lg:p-7">
              {[
                ["Engine", "Tauri 2 + Rust"],
                ["Retrieval", "Hybrid semantic + BM25"],
                ["Parsing", "Tree-Sitter + GraphRAG"],
                ["Storage", "LanceDB + Apache Arrow"],
                ["Providers", "Ollama first, OpenRouter optional"],
                ["Safety", "Secret Shield before cloud routing"]
              ].map(([label, value]) => (
                <div key={label} className="rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-sand">{label}</p>
                  <p className="mt-3 text-base leading-7 text-bone">{value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
