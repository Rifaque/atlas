# Atlas: Road to v1.0.0 (Rolling Todo)

> [!IMPORTANT]
> **CRUCIAL FILE**: This is the single source of truth for the Atlas project roadmap and task status. Do not delete or move.

## 🎯 Phase 10: The Pre "1.0" Polish (0.10.0) [x]
- [x] **Documentation Consolidation** — Unify PRD, Design, Architecture, and Roadmap.
- [x] **Public Documentation** — Create a polished README and quickstart guide.
- [x] **License & Legal** — Finalize MIT license and add NOTICE files.
- [x] **Performance Benchmarks** — Document startup time and indexing speed.


## 🏁 Phase 11: v1.0.0 - The Official Release (1.0.0)
- [ ] **Golden Master Build** — Final signed and notarized binaries for Windows and Linux.
- [ ] **Complete UX Polish** — Final pass on all animations and visual consistency.
- [ ] **Public Launch** — Landing page launch and community outreach.

## 🧠 Phase 12: Knowledge Synthesis & Fine-tuning (v1.1.0)
- [ ] **Local LoRA Fine-tuning** — Ability to fine-tune small models (e.g., Phi-3, Llama-3-8B) on the specific codebase patterns locally via Ollama/PyTorch.
- [ ] **Semantic Versioning Diff Analysis** — Chat-driven analysis of what changed between two git tags or commits globally.
- [ ] **Advanced RAG Re-ranking** — Integration of local Cross-Encoders (like BGE-Reranker) for near-perfect retrieval precision.

## 🧩 Phase 13: Local Ecosystem & Plugins (v1.2.0)
- [ ] **Atlas "Skills" API** — Allow users to write custom JS/Rust scripts to extend Atlas's tool-calling capabilities.
- [ ] **Community Plugin Marketplace** — A local-first gallery of community-built personas and workflow scripts.
- [ ] **Headless CLI Mode** — Run Atlas's indexing and reasoning engine from the terminal for CI/CD pipeline integration.

## 🖥️ Phase 14: Deep IDE Integration (v1.3.0)   
- [ ] **Official VS Code Extension** — A first-party extension that brings Atlas's local reasoning and RAG capabilities directly into the VS Code sidebar/editor experience.
- [ ] **IDE-Native Handoff** — Advanced deep-linking between the Atlas Desktop app and IDEs for seamless context sharing.

## 🛡️ Phase 15: Autonomous Verification & Safety (v1.4.0)
- [ ] **Self-Correcting Agent Loop** — Atlas applies proposed diffs to a hidden temp branch and runs local builds/tests. If they fail, it analyzes the error and self-corrects the code *before* presenting it to the user.
- [ ] **Architectural Drift Detection** — A background agent that compares the current code state against `architecture.md` and alerts if new code violates established design patterns.

## 📊 Phase 16: RAG Observability & Traceability (v1.5.0)
- [ ] **Vector Search Decision Trace** — A visual dashboard showing the "Reasoning Path": raw query -> HyDE expansion -> Top-K chunks -> BM25 vs Cosine scoring breakdown -> Final Context Selection.
- [ ] **Knowledge Coverage Analytics** — Heatmaps showing which parts of the codebase Atlas is "confident" in vs. areas with stale or missing documentation.

## 🏆 Phase 17: Professional Governance (v1.6.0)
- [ ] **Semantic PR Auditor** — A persona that acts as a "Senior Code Reviewer," checking for performance anti-patterns and design system violations specific to the Atlas architecture.
- [ ] **Compliance & License Guard** — Automated scanning of third-party dependencies to ensure strict MIT compliance and dependency freshness.

---
