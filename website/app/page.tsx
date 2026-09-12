import Link from "next/link";
import { githubUrl, installerSha256, releaseUrl } from "@/lib/content";

const workflow = [
  ["Open", "Choose one local codebase or document set through the native folder picker."],
  ["Index", "Build a local index with Ollama embeddings and see factual progress."],
  ["Ask / Find", "Ask for a grounded explanation or find ranked source passages directly."],
  ["Inspect evidence", "Open paths and ranges, preview sources, pin context, and follow up."]
];

export function AtlasHome() {
  return (
    <>
      <header className="site-header">
        <nav className="shell nav" aria-label="Primary navigation">
          <Link className="wordmark" href="#top" aria-label="Atlas home"><span aria-hidden="true">A</span> Atlas</Link>
          <div className="nav-links"><Link href="#workflow">Workflow</Link><Link href="#evidence">Evidence</Link><Link href="#privacy">Privacy</Link><a href={githubUrl}>GitHub</a></div>
          <a className="nav-download" href={releaseUrl}>Download for Windows</a>
        </nav>
      </header>

      <main id="top">
        <section className="shell hero" aria-labelledby="hero-title">
          <div className="hero-copy">
            <p className="kicker">Atlas 1.0 · Windows x64</p>
            <h1 id="hero-title">Understand your workspace. From your workspace.</h1>
            <p className="lede">Atlas indexes a local codebase or document set, lets you Ask or Find, and shows the evidence behind every grounded response.</p>
            <div className="hero-actions"><a className="button button-primary" href={releaseUrl}>Download Atlas 1.0.0</a><a className="button button-secondary" href={githubUrl}>View on GitHub</a></div>
            <p className="release-note">Unsigned NSIS installer · SmartScreen may show an Unknown Publisher warning.</p>
          </div>

          <div className="workbench" aria-label="Illustrative Atlas evidence workflow">
            <div className="workbench-bar"><span>atlas / workspace</span><span>Local · Ollama</span></div>
            <div className="workbench-body">
              <div className="workbench-nav" aria-label="Atlas workspace sections"><strong>Atlas</strong><span>Ask</span><span>Find</span><span>History</span><span>Context</span></div>
              <div className="answer-pane"><p className="pane-label">Ask</p><h2>Where is workspace authorization implemented?</h2><p>Atlas resolves the selected workspace, keeps requested files inside its authorized root, and returns the source material used for the response.</p><div className="evidence-chip">Evidence considered <b>2</b></div></div>
              <div className="source-pane"><p className="pane-label">Evidence</p><strong>workspace.rs</strong><span>lines 18–64</span><code>canonical workspace root<br />authorized file path<br />inside-root check</code></div>
            </div>
            <p className="diagram-caption">Illustrative product map — not a screenshot.</p>
          </div>
        </section>

        <section id="workflow" className="workflow-section" aria-labelledby="workflow-title">
          <div className="shell"><p className="kicker">A focused desktop loop</p><h2 id="workflow-title">Open → Index → Ask / Find → Inspect Evidence</h2>
            <ol className="workflow-list">{workflow.map(([title, description], index) => <li key={title}><span>{index + 1}</span><div><h3>{title}</h3><p>{description}</p></div></li>)}</ol>
          </div>
        </section>

        <section className="shell split-section" aria-labelledby="ask-find-title">
          <div><p className="kicker">Ask</p><h2 id="ask-find-title">Ask for an answer that stays close to the source.</h2><p>Atlas assembles bounded workspace evidence for grounded responses, preserves workspace-scoped history, and supports useful follow-ups without presenting general model knowledge as workspace fact.</p><ul><li>Local Ollama generation</li><li>Optional explicit OpenRouter generation</li><li>Conservative no-evidence handling</li></ul></div>
          <div><p className="kicker">Find</p><h2>Go straight to the material.</h2><p>Find is built for direct source discovery: ranked results, relative paths, line ranges, and snippets you can inspect or pin for the next question.</p><ul><li>Exact symbol and path-aware lookup</li><li>Semantic and lexical retrieval</li><li>Inspectable, pin-ready source results</li></ul></div>
        </section>

        <section id="evidence" className="evidence-section" aria-labelledby="evidence-title">
          <div className="shell evidence-grid"><div><p className="kicker">Evidence first</p><h2 id="evidence-title">An answer is more useful when you can open the source beside it.</h2><p>Atlas keeps paths, ranges, and source previews close to Ask and Find. Pin a source when it should remain visible in the bounded context for your next question.</p></div>
            <dl className="evidence-ledger"><div><dt>Path</dt><dd>apps/desktop/src-tauri/src/workspace.rs</dd></div><div><dt>Range</dt><dd>18–64</dd></div><div><dt>Context</dt><dd>Pinned by you</dd></div><div><dt>Meaning</dt><dd>Supplied evidence, not sentence-level attribution</dd></div></dl>
          </div>
        </section>

        <section className="shell retrieval-section" aria-labelledby="retrieval-title"><p className="kicker">Retrieval, plainly stated</p><h2 id="retrieval-title">Semantic + BM25 → RRF → relevance filtering → bounded evidence</h2><p>Atlas combines semantic candidates with identifier-aware lexical results, fuses them with reciprocal-rank fusion, filters weak matches, then selects a bounded, diverse evidence set. Queries without enough workspace support can be rejected.</p></section>

        <section id="privacy" className="shell privacy-section" aria-labelledby="privacy-title">
          <div className="section-heading"><p className="kicker">Privacy is a destination</p><h2 id="privacy-title">Choose local processing, or explicitly choose a cloud request.</h2></div>
          <div className="privacy-grid"><article><h3>Local mode · Ollama</h3><p>With local Ollama, indexing, embeddings, generation, and workspace evidence remain on your machine.</p><ul><li>Local workspace indexing</li><li>Local embeddings</li><li>Local generation</li></ul></article><article><h3>Optional cloud mode · OpenRouter</h3><p>When you explicitly enable OpenRouter, relevant request content may leave the machine. Atlas constructs and inspects the bounded outbound payload first.</p><ul><li>Query and retrieved evidence</li><li>Pinned context and relevant history</li><li>Enabled Git/system context</li></ul></article></div>
          <p className="security-boundary"><strong>Security boundary:</strong> workspace access is backend-authorized; requested paths are canonicalized and constrained to the authorized root. Credentials are Rust-owned. Atlas 1.0 has no arbitrary shell execution.</p>
        </section>

        <section className="shell release-section" aria-labelledby="release-title"><div><p className="kicker">Windows release</p><h2 id="release-title">Atlas 1.0 ships for Windows x64.</h2><p>Use the NSIS installer with Ollama, an embedding model such as <code>nomic-embed-text:latest</code>, and a compatible local generation model.</p></div><dl><div><dt>Installer</dt><dd>NSIS · Windows x64</dd></div><div><dt>Signing</dt><dd>Unsigned · SmartScreen warning may appear</dd></div><div><dt>Updater</dt><dd>Disabled</dd></div></dl></section>

        <section className="shell limitations" aria-labelledby="limitations-title"><p className="kicker">Current limitations</p><h2 id="limitations-title">Clear boundaries make a better tool.</h2><ul><li>Linux is configured but unverified for 1.0.</li><li>macOS is unsupported for 1.0.</li><li>PDF and generic-file chunking is basic.</li><li>Relevance calibration is heuristic.</li><li>Context budgeting is approximate rather than tokenizer-exact.</li><li>Evidence is not guaranteed claim-level attribution.</li></ul></section>

        <section className="shell final-cta" aria-labelledby="download-title"><p className="kicker">Atlas 1.0</p><h2 id="download-title">A local workspace, a grounded answer, and the source beside it.</h2><p>Download from GitHub Releases, verify the checksum, then open a workspace and begin with evidence.</p><div className="hero-actions"><a className="button button-primary" href={releaseUrl}>Download Atlas 1.0.0</a><a className="button button-secondary" href={githubUrl}>GitHub</a></div><p className="checksum"><span>SHA-256</span> {installerSha256}</p></section>
      </main>

      <footer className="site-footer"><div className="shell"><span>Atlas 1.0 · local-first workspace intelligence</span><a href={githubUrl}>github.com/Rifaque/atlas</a></div></footer>
    </>
  );
}

export default function HomePage() { return <AtlasHome />; }
