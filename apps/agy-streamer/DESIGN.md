# Design System: Antigravity Multi-Agent Streamer (v2.1)

This document defines the complete visual style guide, component specifications, and user experience patterns for the Antigravity Streamer web interface. It acts as the single source of truth for the Google Stitch design project.

---

## 1. Visual Theme & Atmosphere

A dashboard designed for deep technical focus. The interface adopts a "dark cockpit" aesthetic, combining dark obsidian surfaces, frosted glass panels, and thin glowing structural lines. Density is balanced (Daily App Balanced, scale 6/10) to optimize information readability, while visual variance is offset asymmetric (scale 7/10) to create a premium, curated developer feeling.

*   **Obsidian Canvas** (`#07090e`) — Deep, solid background canvas.
*   **Frosted Surface** (`rgba(13, 17, 23, 0.45)`) — Card and panel background with `backdrop-filter: blur(16px)` and `-webkit-backdrop-filter: blur(16px)`.
*   **Whisper Border** (`rgba(255, 255, 255, 0.06)`) — Crisp, thin 1px borders wrapping cards, tables, and sidebars.
*   **Steel Indigo Accent** (`#6366f1`) — Indigo hue for primary highlights, focus states, and selected sessions.
*   **Safety Green** (`#10b981`) — Emerald green indicating active sync status and successful connection.
*   **Agent Orange (Claude)** (`#d97706`) — Orange brand accent for Claude session indicators.
*   **Charcoal Text** (`#94a3b8`) — Muted gray-blue for secondary metadata, descriptions, and file paths.
*   **Foreground Light** (`#f8fafc`) — High-contrast bright color for headlines, core text, and input content.

---

## 2. Typography Rules

*   **Display / Headlines**: `Outfit` (Sans-serif)
    *   *Letter-spacing*: `-0.02em` tight-tracking.
    *   *Sizing*: Main titles at 1.875rem (30px) bold, subheadings at 1.25rem (20px) semibold.
*   **Body Text**: `Manrope` (Sans-serif)
    *   *Line-height*: `1.6` for readable multi-line logs.
    *   *Sizing*: 0.875rem (14px) regular or medium.
*   **Technical / Code**: `Geist Mono` (Monospace)
    *   *Usage*: For folder paths, raw command lines, file diff outputs, tool execution arguments, and session IDs.
*   **Dashboard Rule**: All dashboard interfaces, metrics, and directories must strictly pair `Outfit` and `Geist Mono`. Generic serifs (Times, Georgia) and overused web sans-serifs (Inter) are BANNED.

---

## 3. UI Component Blueprint

### 3.1 Collapsible Sidebar (Session Manager)
*   **Structure**: Left-aligned column, default width `320px`. Can be collapsed entirely (`0px` width) with `overflow-hidden` to provide a full-screen view.
*   **Toggle**: A 32px square floating button positioned next to the workspace banner on the main content header.
*   **Active Session Card**: Renders with an Indigo gradient background overlay (`rgba(99, 102, 241, 0.08)`) and border (`rgba(99, 102, 241, 0.35)`). Contains:
    *   Agent Brand badge (e.g. `Claude` in orange pill, `agy` in indigo pill).
    *   Smart session title (first user prompt) in Outfit bold.
    *   Session UUID string in Geist Mono (small, 10px, truncated).
    *   Timestamp and date in secondary text.

### 3.2 Workspace & Agent Configuration Banner
*   **Structure**: Top-docked grid, 1px bottom border. Contains:
    *   Sidebar toggle button.
    *   Label "Workspace Path:" in Outfit semibold.
    *   File path input field in Geist Mono, styled in dark transparent color.
    *   "Browse..." folder explorer action button.
*   **Interaction**: Changing the path input saves it immediately to local storage. Clicking "Browse" opens the Unified Workspace Browser modal.

### 3.3 Unified Workspace Browser (Dialog Modal)
*   **Structure**: Centered modal overlay, rounded corners `12px`, max-width `500px`.
*   **Sections**:
    1.  **Detected Agent Log Paths**: Lists automatic detections of user agent log directories (e.g., `~/.claude/sessions/`, `~/.gemini/antigravity-cli/conversations/`), allowing quick-connect to active terminal sessions.
    2.  **Recent Workspaces**: Grid tiles displaying previously registered directories, allowing instant double-click selection.
    3.  **Filesystem Browser**: Frosted directory box showing:
        *   Current path breadcrumb with a `⬆️ Up` navigation trigger.
        *   Two-column scrollable grid of subfolders. Clicking a folder navigates deeper and updates the path.
    4.  **New Project Creator**: Text input and a `➕ Create` button to provision a new workspace folder recursively.
*   **Footer**: "Cancel" outline button and "Select Current Folder" Indigo fill button.

### 3.4 Log Card & Collapsible Content
*   **Agent Thoughts**: Thoughts block is nested inside a grey border (`border-slate-800`) with a dark background. Clicking the toggle header (e.g. `👉 Show Thought Process`) unfolds the thoughts using smooth height shifts.
*   **Text Truncator**: Long command outputs or source file contents exceeding 10 lines are wrapped inside a height-constrained box (`max-height: 180px`). A dark gradient mask overlays the bottom edge to indicate continuation, followed by a bold `▼ Expand Text` toggle button.

---

## 4. Spacing, Grid & Responsive Layout (RWD)

*   **Grid Systems**: CSS Grid and Flexbox layouts are structured mobile-first:
    *   **Desktop (>= 1024px)**: Asymmetric 2-column layout (Sidebar 320px + Content flexible).
    *   **Tablet (768px - 1023px)**: Sidebar collapses into a sliding slide-out navigation bar. Content area spans full width.
    *   **Mobile (< 768px)**: Absolute single-column flow. Sidebar becomes a sliding bottom-drawer. Padding shrinks from `24px` to `12px`.
*   **Touch Targets**: All interactive elements (buttons, folders, session links) have a minimum tap target of `44px` on mobile layouts.
*   **Fluid Spacing**: Margin and padding scale dynamically based on viewport width (`clamp(12px, 3vw, 24px)`).

---

## 5. Motion & Physics Engine

*   **Spring Animations**: Sidebar expansion and modals animate using weighty spring physics: `stiffness: 100, damping: 20` to feel premium and grounded.
*   **Waterfall Cascading**: Log entries fade-in and slide upward (`translateY(8px)` to `0`) sequentially over 150ms delays.
*   **Process Progress Indicator**: Pinging status glow rings utilizing hardware-accelerated `opacity` and `scale` animation loop.

---

## 6. Design Anti-Patterns (Forbidden)

*   **No Redundant Approvals**: Avoid displaying custom Zero-Trust interceptor boxes in the web layout since CLI agents (Claude, agy) manage their own console confirmations.
*   **No Purple/Neon Glows**: Banned standard AI glowing grids.
*   **No Pure Black**: Use Obsidian Canvas (`#07090e`) instead of `#000000`.
*   **No Emojis in Headers**: Emojis are strictly banned from UI labels, tab names, and status metrics (allowed only inside the directory browser for file representation).
*   **No Fabricated Statistics**: Metrics like "99.9% uptime" or "150ms response" are forbidden unless real data is supplied.
*   **No Copywriting Clichés**: Avoid words like "Seamless", "Unleash", or "Elevate". Keep descriptions technical and minimal.
*   **No Overlapping Text/Images**: Ensure clean spacing boundaries for all layout items.
