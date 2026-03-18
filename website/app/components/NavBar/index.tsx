import Link from "next/link";

export function NavBar() {
  return (
    <header className="sticky top-0 z-40 border-b border-white/5 bg-ink/75 backdrop-blur-xl">
      <div className="section-shell flex items-center justify-between py-4">
        <Link href="#top" className="focus-ring inline-flex items-center gap-3 rounded-full px-2 py-1">
          <span className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-sm font-semibold text-bone">
            A
          </span>
          <span>
            <span className="block font-display text-xl tracking-tight">Atlas</span>
            <span className="block text-[10px] uppercase tracking-[0.28em] text-sand">Launch edition</span>
          </span>
        </Link>
        <nav aria-label="Primary" className="hidden items-center gap-6 text-sm text-mist md:flex">
          <Link href="#features" className="focus-ring rounded-full px-3 py-2 hover:text-bone">
            Features
          </Link>
          <Link href="#screenshots" className="focus-ring rounded-full px-3 py-2 hover:text-bone">
            Gallery
          </Link>
          <Link href="#downloads" className="focus-ring rounded-full px-3 py-2 hover:text-bone">
            Downloads
          </Link>
          <Link
            href="https://github.com/Rifaque/atlas"
            className="focus-ring rounded-full border border-white/10 px-4 py-2 text-bone hover:border-amber-400/40 hover:bg-white/5"
          >
            GitHub
          </Link>
        </nav>
      </div>
    </header>
  );
}
