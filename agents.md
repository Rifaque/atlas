> [!IMPORTANT]
> **CRUCIAL FILE**: This is a core documentation asset for Atlas. **Do not delete or move** this file, as it documents the agentic reasoning and safety protocols of the system.

# 🤖 Atlas Agents & Personas

Atlas is designed not just as a chat interface, but as an **Agentic AI Assistant**. This means it can reason through complex problems, use tools to interact with your workspace, and adopt specialized roles (Personas) to better suit your current task.

## 🧠 Reasoning & Architecture
Atlas uses a "Chain of Thought" reasoning process for complex queries. When you ask a difficult question, Atlas:
1.  **Deconstructs** the goal into sub-tasks.
2.  **Identifies** required context (files, git history, knowledge graph).
3.  **Executes** tools if necessary (viewing files, running tests).
4.  **Synthesizes** a final response or proposed code change.

## 🛠️ Tool Calling Engine
Atlas's agents have a safe, bounded toolkit to interact with your local environment:
- **File System**: Read files, list directories, and apply precise code diffs.
- **Tree-Sitter**: Semantic code parsing to understand functions and classes vs. raw text.
- **Shell**: Execute safe terminal commands (e.g., `npm test`, `cargo build`) to verify changes.
- **Git**: Contextual awareness of branches, commits, and uncommitted changes.

## 🎭 Specialized Personas
You can switch Atlas's persona to change its behavior and knowledge focus:

### 🏛️ The Architect
Focuses on system design, design patterns, and high-level project structure. Best for:
- Planning new features.
- Refactoring large modules.
- Identifying architectural bottlenecks.

### ✍️ The Writer
Optimized for documentation, READMEs, and explaining complex logic in simple terms. Best for:
- Writing feature docs.
- Onboarding guides.
- Technical blogging.

### 🛡️ The Security Auditor
Scans code for vulnerabilities, PII (Personally Identifiable Information), and secrets.
- **Secret Shield**: Automatically intercepts outgoing cloud messages if sensitive data like API keys are detected.

## 🔒 Safety & Privacy
- **Local First**: Atlas prioritizes local models (via Ollama) for all agentic reasoning when possible.
- **Human-in-the-Loop**: Major actions (like applying code changes or executing shell commands) **always** require user confirmation.
- **Privacy Guard**: Sensitive data is filtered locally before reaching any external providers.
