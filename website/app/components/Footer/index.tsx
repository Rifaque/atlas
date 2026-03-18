import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-white/10 pb-12 pt-10">
      <div className="section-shell flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-display text-3xl text-bone">Atlas</p>
          <p className="mt-2 max-w-xl text-sm leading-7 text-mist">
            Local-first workspace intelligence for developers who need real context, fast answers, and clean privacy boundaries.
          </p>
        </div>
        <div className="flex flex-wrap gap-4 text-sm text-mist">
          <Link href="https://github.com/Rifaque/atlas" className="focus-ring rounded-full px-3 py-2 hover:text-bone">
            GitHub
          </Link>
          <Link href="https://ollama.com" className="focus-ring rounded-full px-3 py-2 hover:text-bone">
            Ollama
          </Link>
          <Link href="#downloads" className="focus-ring rounded-full px-3 py-2 hover:text-bone">
            Downloads
          </Link>
        </div>
      </div>
    </footer>
  );
}
