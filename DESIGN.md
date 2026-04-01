# Markflow Design System

This document defines the current visual and interaction system for Markflow UI.
Use it as the source of truth when adding or updating frontend screens to keep the product consistent.

## 1) Design goals

Markflow's UI is optimized for collaborative writing, so design choices should prioritize:

1. **Focus over decoration**: the editor and content should stay visually dominant.
2. **Quiet dark theme**: low-glare backgrounds, restrained contrast, and accent color used intentionally.
3. **Fast scanning**: monospace labels, clear hierarchy, and compact controls.
4. **Predictable interaction**: consistent states (hover, focus, active, disabled, destructive) across components.
5. **Mobile viability**: full functionality at narrow widths via sidebar overlay and stacked actions.

## 2) Source of truth in code

- Global tokens and most component classes: `client/src/styles.css`
- App shell and topbar composition: `client/src/App.tsx`
- Sidebar structure and several inline styles: `client/src/components/Sidebar.tsx`
- Font loading: `client/index.html`

When this document and implementation differ, update both in the same PR.

## 3) Core design tokens

Defined in `:root` (`client/src/styles.css`):

### 3.1 Color tokens

| Token | Value | Usage |
|---|---|---|
| `--bg` | `#0e0e0f` | App background, base canvas |
| `--bg2` | `#161618` | Elevated surface (sidebar/topbar/dialog panels) |
| `--bg3` | `#1e1e21` | Interactive surface (inputs/active rows/code blocks) |
| `--bg4` | `#252528` | Control background (small buttons, chips, inline code bg) |
| `--border` | `rgba(255,255,255,0.07)` | Default separators and borders |
| `--border2` | `rgba(255,255,255,0.13)` | Stronger borders, focus-adjacent boundaries |
| `--text` | `#e8e8e6` | Primary text |
| `--text2` | `#9a9a95` | Secondary text |
| `--text3` | `#5a5a58` | Tertiary/muted text and placeholders |
| `--accent` | `#c8f060` | Primary highlight, links, active markers, focus identity |
| `--accent2` | `#a8d040` | Secondary accent (reserved) |
| `--coral` | `#ff6b5b` | Error and destructive intent |
| `--blue` | `#5b9cf6` | Secondary gradient/illustrative highlight |

### 3.2 Typography tokens

| Token | Font stack | Usage |
|---|---|---|
| `--sans` | `Inter, system-ui, sans-serif` | Body content and general UI |
| `--mono` | `DM Mono, monospace` | Controls, labels, filenames, code-like metadata |
| `--serif` | `Instrument Serif, serif` | Hero/brand headings and empty states |

Fonts are loaded from Google Fonts in `client/index.html`.

### 3.3 Shape tokens

| Token | Value | Usage |
|---|---|---|
| `--radius` | `6px` | Default control/input/dialog button radius |
| `--radius-lg` | `10px` | Larger panels and modal surfaces |

Additional fixed radii used in implementation:
- `4px`: compact controls and row internals
- `10px`: connect form controls
- `18px`: connect dialog container
- `999px`: pill badge treatment

## 4) Typographic scale and hierarchy

### Base

- Root UI base: `14px`, line-height `1.5`, sans-serif.
- Control text (buttons/labels): commonly `11px` to `13px`.
- Body preview text: `15px`, line-height `1.75`.

### Headings

- Connect and empty-state hero headings use serif + italic style.
- Markdown preview:
  - `h1`: serif, `2.2rem`, italic
  - `h2`: serif, `1.5rem`
  - `h3`: sans, uppercase, increased letter spacing

### Labeling convention

For utility labels and compact UI metadata:
- Use `--mono`
- Use uppercase where appropriate
- Use letter spacing (`0.05em` to `0.1em`)

## 5) Layout system

## 5.1 App shell

- Main layout is split into:
  - **Sidebar** (fixed width desktop)
  - **Workspace main** (flex-grow)
- Full viewport height: `100dvh`

### Sidebar (desktop)

- Width and min-width: `220px`
- Surface: `--bg2`
- Border-right: `1px solid --border`
- Internal regions:
  1. Header (workspace label + new-file button)
  2. Optional create-file form
  3. Scrollable file list
  4. Footer (identity + presence)

### Topbar

- Height: `44px`
- Surface: `--bg2`
- Bottom border: `1px solid --border`
- Contains:
  - Current filename
  - Presence avatars
  - Edit/Preview mode controls
  - Download actions

### Content area

- Empty state centered both axes
- Preview/editor surfaces consume full available height
- Typical horizontal reading/editing padding: `32px 40px` (desktop)

## 5.2 Connect dialog

- Centered shell with subtle radial gradients using accent + blue
- Dialog max width: `560px`
- Radius: `18px`
- Border + soft depth shadow
- Form layout:
  - Label + input/action row
  - Secondary action below
  - Link preview metadata below form

## 6) Interaction states

## 6.1 Focus

Global focus-visible style:
- `outline: 2px solid rgba(200, 240, 96, 0.6)`
- `outline-offset: 2px`

Editor focused state:
- `outline: 1px solid rgba(200, 240, 96, 0.35)` with negative offset

### 6.2 Hover

Hover effects are subtle and quick (`0.1s` to `0.15s` transitions):
- Primary connect button brightens
- Secondary controls strengthen border/text contrast
- Links increase border emphasis rather than dramatic color shifts

### 6.3 Active and selected

- Active sidebar file row:
  - Surface `--bg3`
  - Left accent bar (`2px`)
- Active topbar filename uses `--text2` (inactive uses `--text3`)

### 6.4 Disabled

- Disabled controls reduce contrast/opacify (example topbar action: `opacity: 0.65`)
- Avoid changing layout in disabled state

### 6.5 Error and destructive

- Error/destructive uses `--coral` + translucent coral backgrounds and borders
- Keep destructive emphasis explicit but restrained (no saturated red fills)

## 7) Component patterns

## 7.1 Buttons

### Base button behavior

- No default browser border/background
- Font family `--sans` by default
- Fast transition (`0.15s`)
- Pointer cursor

### Variants in use

1. **Primary action (connect)**  
   Accent background, dark text, medium/high emphasis.

2. **Secondary action**  
   Neutral dark background with border (`--border2`), secondary text.

3. **Topbar utility actions**  
   Compact mono text, subtle bordered chip look (`--bg4`).

4. **Destructive modal action**  
   Coral-tinted border + background, coral text.

## 7.2 Inputs and textareas

- Monospace (`--mono`)
- `13px`
- Dark control background (`--bg3`)
- Border `--border` default; `--border2` on focus
- Radius `--radius`
- Placeholder color `--text3`

## 7.3 Sidebar file rows

- Compact row with left-state indicator
- Filename in monospace with ellipsis truncation
- Optional collaborator dots per file
- Delete button always present with subtle prominence

## 7.4 Dialogs

Two dialog styles currently exist:

1. **Connect dialog**: branded, large, onboarding entry state.
2. **Delete confirmation**: compact, utility modal with destructive controls.

Dialog rules:
- Always use overlay scrim
- Keep clear heading/title and primary decision actions
- Ensure keyboard dismissal when appropriate (`Escape`)

## 7.5 Avatars and presence

- Circular `24px` avatars in topbar with deterministic user color
- Small dots represent collaborator presence in sidebar rows and footer
- Self avatar gets subtle border differentiation

## 7.6 Editor and markdown preview

### Editor (CodeMirror)

- Monospace editing surface with generous line height (`~1.8`)
- No visible gutters
- Accent cursor and subtle selection tint
- Visual style aligned to dark theme with minimal chrome

### Preview

- Rich markdown typography with serif heading accents
- Accent links and blockquote indicators
- Soft bordered code/pre/table treatments

## 8) Spacing and sizing rhythm

Common spacing units in current UI:

- `2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 24, 32, 40`

Recommended practice:
- Use existing values before introducing new ones
- Prefer 4px-based increments for new controls
- Preserve vertical density in sidebar and topbar

## 9) Responsiveness

Breakpoints in use:

- `max-width: 980px`: mobile/tablet navigation behavior
- `min-width: 981px`: desktop-only visibility behavior
- `max-width: 640px`: compact mobile spacing and stacked controls

### Mobile behavior rules

- Sidebar becomes off-canvas with backdrop and toggle button
- Topbar wraps and reorders content for readability
- Actions become full-width where needed
- Editor/preview padding is reduced to `18px 16px`
- Dialog actions stack vertically on small screens

## 10) Accessibility and usability standards

Current standards implemented and expected for new UI work:

- Visible keyboard focus for all interactive controls
- ARIA labels on non-text or icon-only controls
- Semantic button usage for actions (not clickable divs)
- Reasonable minimum tap targets on mobile (`~34px` to `38px` in key controls)
- Preserve text legibility against dark surfaces

When adding features:
- Support keyboard interaction paths
- Avoid color-only communication for critical state
- Keep copy concise and action-oriented

## 11) Implementation guidelines for contributors

1. **Token-first**: use CSS variables instead of hardcoded color values.
2. **Reuse existing component patterns** before introducing new variants.
3. **Keep typography role-based**:
   - serif = branded headings
   - mono = utility metadata/controls
   - sans = body and general UI
4. **Minimize visual noise**: avoid heavy shadows, saturated fills, and dense borders.
5. **Respect mobile rules** at both breakpoints (`980`, `640`).
6. **Prefer class-based styling** in `styles.css` for reusable UI.
7. **If adding a new token**, document purpose and usage here.

## 12) UI review checklist for PRs

Before merging UI changes, confirm:

- [ ] Uses existing tokens (`--bg*`, `--text*`, `--accent`, `--coral`) correctly
- [ ] Uses existing radius and spacing scales
- [ ] States implemented: default, hover, focus-visible, disabled, active/destructive where applicable
- [ ] Mobile behavior verified at `<=980px` and `<=640px`
- [ ] Dark-theme contrast remains readable
- [ ] Interaction labels/ARIA are present
- [ ] New visual patterns are documented in this file

## 13) Current consistency gaps (to address in future UI cleanup)

The current UI is functional and coherent, but there are known implementation inconsistencies:

1. **Mixed styling strategies**: many Sidebar and dialog styles are inline in TSX while related refinements live in `styles.css`.
2. **Missing shared class definitions**: some class names used in JSX (for example, `icon-btn`) do not currently have a matching CSS block in `styles.css`.
3. **Legacy selector remnants**: some sidebar-related selectors in `styles.css` are not currently represented by active JSX structure.

When touching related areas, prefer incremental consolidation (move repeated inline styles into named classes) without changing user-visible behavior unless explicitly intended.
