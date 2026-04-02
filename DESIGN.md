# Design notes (markflow.md)

Single shared-document UI: **topbar**, **markdown toolbar**, **CodeMirror editor** / **preview**. Source of truth in code is [`client/src/styles.css`](client/src/styles.css) and [`client/src/App.tsx`](client/src/App.tsx). Fonts: [`client/index.html`](client/index.html).

If this file and the implementation disagree, update both in the same change.

## Goals

- Editor and content stay visually dominant; dark, low-glare theme.
- Monospace for compact metadata; accent (`--accent`) for focus and brand.
- Keyboard-accessible controls; visible `:focus-visible` outlines.

## Tokens (`:root` in `styles.css`)

| Token | Typical use |
|-------|-------------|
| `--bg` … `--bg4` | Surfaces (page, topbar, controls) |
| `--text`, `--text2`, `--text3` | Primary → muted copy |
| `--accent` | Brand, focus, links in preview |
| `--coral` | Errors / destructive emphasis |
| `--border`, `--border2` | Dividers and control borders |
| `--sans`, `--mono`, `--serif` | UI, labels/code, preview headings |
| `--radius`, `--radius-lg` | Corners |

Prefer **variables** over raw hex for new styles.

## Layout

- **`.single-app`:** column flex, `100dvh`, full-height workspace.
- **Topbar (~44px):** brand, presence / connection, Edit | Preview, Copy URL, Download.
- **Toolbar:** formatting chips; disabled in preview mode.
- **Panels:** editor and preview are stacked absolutely; hidden panel uses `.is-hidden` (visibility + `aria-hidden` in React).

## Components

- **Buttons:** global reset in `styles.css`; mode switch and topbar actions use dedicated classes.
- **Collab banner:** coral-tinted strip when sync is unavailable.
- **Preview:** sanitized HTML from marked; serif headings per existing `.preview` rules in CSS.

## PR checklist (UI)

- [ ] Tokens/spacing consistent with existing patterns  
- [ ] Focus states for new interactive elements  
- [ ] Preview and editor both usable at narrow widths if layout changes  
