Atlas – UI/UX Design Document
1. Design Philosophy

Atlas should feel:

Calm

Focused

Technical

Modern

Unintrusive

The UI should disappear and let the user think.

Core inspirations (conceptual, not literal copies):

ChatGPT Desktop layout

VS Code panel structure

macOS frosted sidebars

No playful visuals.
No skeuomorphism.
No neon.

2. Visual Style Summary

Theme: Dark Glassmorphism

Dark background base

Frosted glass panels

Matte finish

Low contrast highlights

Sharp typography

Minimal gradients

Think: clean workstation, not gaming RGB setup.

3. Color System
Base Colors

App background:
#0B0F14 (very dark blue-gray)

Primary panel background (glass):
rgba(20, 25, 35, 0.15)

Secondary panel background:
rgba(20, 25, 35, 0.12)

Text

Primary text:
#E6EAF0

Secondary text:
#9AA4B2

Muted / placeholder:
#6B7280

Accent (single color only)

Pick one:

Soft blue: #5FA8FF
or

Teal: #4FD1C5

Use accent only for:

Active states

Buttons

Links

Never overuse.

4. Glassmorphism Rules

Applies to:

Chat panel

Document search panel

History sidebar

Modals

Properties

Opacity: 10–20%

Blur: 8–12px

Border:
1px solid rgba(255,255,255,0.08)

No glow

No shadows or extremely subtle shadow only

This creates frosted look without “glass toy” effect.

5. Typography
Font Style

Sans-serif, neutral, technical:

Good options:

Inter

IBM Plex Sans

Source Sans 3

Weights

Regular (400) – body

Medium (500) – labels

Semibold (600) – headings

Avoid ultra-bold.

Type Scale

App title: 18px

Panel heading: 14px

Chat text: 14–15px

Metadata / hints: 12px

Line height: 1.4–1.6

6. Layout Structure

Desktop app window divided into three vertical regions:

| History Sidebar | Document Search | Chat Area |

History Sidebar is collapsible.

Document Search can be resized.

Chat Area always dominant.

7. Landing Screen

Purpose: Choose workspace and model.

Layout:

Centered frosted card.

Elements:

App name

Short subtitle

Folder selector

Model dropdown

Index button

Visual:

Large empty space

One glass panel

No clutter

8. Main Workspace Layout
Left: History Sidebar

Width: 220–260px

Contents:

New Chat button

List of previous chats

Each chat row:

Title

Subtle hover highlight

Collapsed state:

Icons only

Middle: Document Search Panel

Width: 300–350px

Top:

Search input

Below:

List of results:

File name

Path (muted)

Open button

Bottom:

Indexed file count

Right: Chat Panel

Largest area.

Top bar:

Workspace name

Model name

Chat area:

Messages stacked vertically

User messages right aligned

Assistant messages left aligned

Bottom:

Multiline input

Send button

Stop generation button

9. Chat Message Design
User Message

Slightly darker glass bubble

Right aligned

Rounded 10px

Assistant Message

Normal glass panel

Left aligned

Rounded 10px

Source Citations

Under assistant message:

Small pills:

[file1.py] [notes.pdf] [README.md]

Clickable.

10. Buttons

Shape:

Rounded 8px

Flat

No heavy shadows

States:

Default: muted glass

Hover: slightly brighter

Active: accent border

No gradients.

11. Inputs

Glass background

Thin border

Focus border = accent color

No glow.

12. Icons

Style:

Outline icons

Thin stroke

Monochrome

Examples:

Folder

Search

Plus

Trash

Settings

Avoid filled icons.

13. Motion & Animation

Keep minimal.

Fade in panels (100–150ms)

Subtle scale on modal open

No bounce

No overshoot

Everything should feel steady.

14. Accessibility

Sufficient contrast

Keyboard navigation

Text scaling friendly

15. Example CSS Tokens (Conceptual)
--bg-main: #0B0F14;
--glass-bg: rgba(20,25,35,0.15);
--glass-border: rgba(255,255,255,0.08);
--text-primary: #E6EAF0;
--text-secondary: #9AA4B2;
--accent: #5FA8FF;
--radius: 8px;
--blur: 10px;
16. What This Design Communicates

Serious tool

Privacy-first

Developer-focused

Not a toy