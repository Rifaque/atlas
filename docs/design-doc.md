# Atlas Design Doc (UI/UX)

> [!NOTE]
> Archived pre-refresh design reference. It describes product surfaces retired in Atlas 1.0 Phase 2 and is not the current product contract. The implementation authority is the [Atlas 1.0 UX specification](design/atlas-1.0-ux-spec.md).

> [!IMPORTANT]
> **CRUCIAL FILE**: Preserve this historical design document. It is not the current Atlas 1.0 product contract.

## 1. Design Philosophy: "Dark Glassmorphism"
Atlas follows a **Calm, Technical, and Modern** aesthetic. The goal is a "focused workstation" feel that recedes into the background to let the user work.

### Visual Pillars
- **Frosted Glass (Glassmorphism)**: Panels with 10-20% opacity and 10-12px blur to create depth and a premium feel.
- **Matte Foundations**: A very dark blue-gray base (`#0B0F14`) to reduce eye strain.
- **Hyper-Legibility**: High-contrast, neutral typography (Geist or Inter) for code and technical text.

## 2. Global UI Structure
Atlas uses a three-vertical-pane architecture:
1. **History Sidebar (Left)**: Collapsible pane for managing chat sessions and branch forks.
2. **Workspace Sidebar (Middle)**: Resizable pane for navigating the file tree and semantic search results.
3. **Chat Workspace (Right)**: The dominant area for reasoning, code viewing, and terminal interaction.

## 3. Key UI Components
- **Zen Mode (`Ctrl+J`)**: A centered, distraction-free view for pure conversation.
- **Command Center (`Ctrl+K`)**: A spotlight palette for fuzzy searching files and workspace actions.
- **Mini-Chat Overlay**: A lightweight, semi-transparent assistant summoned by `Alt+Shift+Space`.
- **Analytics Dashboard**: A high-impact visualization of indexing speed, language distribution, and knowledge coverage.

## 4. Interaction Patterns
- **Human-in-the-Loop Actions**: Destructive actions (applying diffs, running shell commands) require a primary action button with clear visual confirmation.
- **Micro-Animations**: Subtle (150ms) transitions for panel visibility and model status changes to ensure the app feels alive but stable.
- **Citations & Highlighting**: References in chat open the **Inline File Viewer** directly at the relevant line with syntax highlighting.

## 5. Theme Tokens
- **App Background**: `#0B0F14`
- **Primary Text**: `#E6EAF0`
- **Accent Color**: `#5FA8FF` (Soft Blue)
- **Glass Border**: `rgba(255, 255, 255, 0.08)`
