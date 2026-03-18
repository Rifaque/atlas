import type { FeatureItem, ScreenshotItem } from "@/lib/types";

export const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://atlas.rifaque.dev";

export const heroCopy = {
  title: "Atlas queries your codebase without sending it away.",
  subtitle: "Local-first workspace intelligence for developers who need speed, architectural context, and privacy by default."
};

export const featureItems: FeatureItem[] = [
  {
    id: "local",
    eyebrow: "Private by design",
    title: "Index locally. Reason with structure. Keep the source of truth on your machine.",
    description:
      "Atlas combines a Rust-native indexing pipeline with local LLM workflows so repositories stay searchable, explainable, and private.",
    bullets: ["Hybrid semantic + keyword retrieval", "Tree-Sitter powered GraphRAG context", "Local LanceDB storage with transparent citations"],
    align: "left"
  },
  {
    id: "personas",
    eyebrow: "Built for real workflows",
    title: "Move from raw chat to focused modes for architecture, review, writing, and security.",
    description:
      "Atlas ships with specialized personas that change the system prompt, the lens, and the tone so answers stay useful instead of generic.",
    bullets: ["Architect for system trade-offs", "Security Auditor for secret and risk scans", "Writer for clean handoff docs"],
    align: "right"
  },
  {
    id: "timeline",
    eyebrow: "Time-aware context",
    title: "Ask what changed yesterday, trace architectural drift, and review the repo with temporal context.",
    description:
      "Timeline intelligence and Git awareness turn Atlas into more than a file searcher. It can summarize motion through the codebase, not just snapshots.",
    bullets: ["Recent-change summarization", "Git branch and diff context", "Pinned files for exact prompt control"],
    align: "left"
  },
  {
    id: "agentic",
    eyebrow: "Agentic without chaos",
    title: "Bounded tooling keeps the product powerful enough to verify work while staying grounded.",
    description:
      "Atlas can search, inspect, propose diffs, and execute scoped commands, giving teams a local-first assistant that feels like a disciplined teammate.",
    bullets: ["Local shell and file tools", "Proposed diffs with citations", "Optional cloud fallback with secret shielding"],
    align: "right"
  }
];

export const screenshots: ScreenshotItem[] = [
  {
    id: "workspace",
    title: "Workspace launcher",
    caption: "Index a repository, choose models, and boot into a workspace designed for fast onboarding and clean operational control.",
    image: "/img/atlas-thumbnail.png",
    alt: "Atlas desktop launcher preview"
  },
  {
    id: "analysis",
    title: "Analysis surface",
    caption: "A cinematic architecture-and-timeline composition shows how Atlas frames large codebases with context-rich panels and deliberate hierarchy.",
    image: "/img/placeholder-analysis.svg",
    alt: "Stylized Atlas architecture analysis mockup"
  },
  {
    id: "review",
    title: "Review flow",
    caption: "Diff review, citations, and prompt controls are framed like a product launch still instead of a generic dashboard screenshot.",
    image: "/img/placeholder-review.svg",
    alt: "Stylized Atlas code review mockup"
  }
];
