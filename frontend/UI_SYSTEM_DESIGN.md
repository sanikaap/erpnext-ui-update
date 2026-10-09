# Modern ERP UI — System Design Reference

> A complete map of the current visual system of `apps/modern_erp_ui/frontend`.
> Every section has an ID (e.g. **[T-COLOR]**, **[C-BUTTON]**, **[P-LIST]**) so a change request can point at exactly one place:
> *"In [C-METRIC], make the value 32px and put the icon on the right."*
>
> Snapshot date: 2026-10-09 (updated after the visual refresh: new teal palette, unified cards/KPI tiles/menus/search fields, gradients removed). Values below are copied from the source; the file paths show where each one lives.

---

## Table of contents

1. [Stack & styling architecture](#1-stack--styling-architecture) — `[A-*]`
2. [Design tokens](#2-design-tokens) — `[T-*]`
3. [Global utility classes](#3-global-utility-classes) — `[G-*]`
4. [App shell & layout](#4-app-shell--layout) — `[L-*]`
5. [Navigation components](#5-navigation-components) — `[N-*]`
6. [Core components](#6-core-components) — `[C-*]`
7. [Forms & fields](#7-forms--fields) — `[F-*]`
8. [Charts & data viz](#8-charts--data-viz) — `[V-*]`
9. [Pages](#9-pages) — `[P-*]`
10. [Motion](#10-motion) — `[M-*]`
11. [Responsive breakpoints](#11-responsive-breakpoints) — `[R-*]`
12. [Accessibility rules in place](#12-accessibility-rules-in-place) — `[X-*]`
13. [Known inconsistencies / improvement hooks](#13-known-inconsistencies--improvement-hooks) — `[Q-*]`
14. [How to write a change request](#14-how-to-write-a-change-request)

---

## 1. Stack & styling architecture

### [A-STACK] Stack
| Concern | Choice |
|---|---|
| Framework | **Vue 3.5** (`<script setup lang="ts">`), Vue Router 4, Pinia 2 |
| Build | Vite, `@vitejs/plugin-vue`, `@tailwindcss/vite` |
| Icons | `lucide-vue-next` (stroke icons; usual sizes 12–20, stroke-width 1.9–2) |
| Charts | **ECharts 5** (TrendChart, DonutChart, RadarChart); hand-made SVG/CSS for Sparkline, DonutGauge, RankBars, SegmentedBar, BudgetBars |
| Fonts | Google Fonts: **Bricolage Grotesque** (display), **Public Sans** (UI), **IBM Plex Mono** (mono) |
| Backend | Frappe/ERPNext via `/api` (Vite proxy → `VITE_FRAPPE_BASE_URL`) |

### [A-CSS] How styling works
- **One global stylesheet:** [src/index.css](src/index.css) holds all tokens (`:root` + `.dark`), base resets, and shared classes.
- **Every component uses `<style scoped>`** with plain CSS that reads tokens via `var(--…)`. Tailwind is imported but **not used for component styling** in practice.
- **Rule written in the CSS header:** components use semantic tokens only, never raw hex values.
- **Per-element accent colour** is passed through a local custom property `--c` (module colour) or `--tone` (KPI tone), set inline: `:style="{ '--c': 'var(--mod-crm)' }"`. Tints come from `color-mix(in srgb, var(--c) 12%, transparent)`.
- **Dark mode:** the theme store toggles the `.dark` class on `<html>`; `.dark` redefines every token.

### [A-LEGACY] Unused leftover files
`src/components/ui/*.tsx`, `src/hooks/*.ts(x)`, `src/components/error-boundary.tsx`, `src/pages/not-found.tsx` are **React/shadcn leftovers**. Nothing in the Vue app imports them, so ignore them when describing the UI. The only live files in `components/ui/` are `BaseButton.vue`, `BaseBadge.vue`, `PanelCard.vue`.

### [A-FILES] Where things live
```
src/
  index.css                 tokens + global classes          [T-*] [G-*] [M-*]
  App.vue                   picks login vs shell
  layouts/ErpShell.vue      sidebar + topbar + page body      [L-SHELL]
  stores/theme.ts           light / dark / system             [T-THEME]
  stores/layout.ts          sidebar collapse, open module     [L-SIDEBAR-STATE]
  config/navigation.ts      modules, sections, items, colours [N-CONFIG]
  app/module-registry.ts    flattens nav config for routing
  lib/display.ts            status → tone, monograms          [C-BADGE-MAP]
  components/
    navigation/             Sidebar, Topbar, CommandPalette, NotificationsMenu
    ui/                     BaseButton, BaseBadge, PanelCard
    data-display/           DataTable, MetricCard
    overlays/               AppModal, AppDrawer, AppPopover
    feedback/               ToastHost, ConfirmHost, EmptyState, ErrorState
    list/                   FilterControl, QuickFilters, SortBy, ColumnSettings
    forms/                  DynamicForm, FieldRenderer, fields/*
    document/               ActivityPanel, EmailDialog
    charts/                 TrendChart, DonutChart, DonutGauge, RadarChart, RankBars, SegmentedBar, BudgetBars, Sparkline, ChartPlaceholder
  pages/                    Dashboard, Module, List, Document, Reports, Login, Settings, Profile
```

---

## 2. Design tokens

All in [src/index.css](src/index.css). Two names exist for some tokens: **working names** (`--surface`, `--primary`) used everywhere, and **semantic aliases** (`--bg-surface`, `--color-primary`) for new code.

### [T-IDENTITY] Visual identity in one line
**Teal / emerald on a cool off-white ground (#F3F6F5), white cards, deep-teal sidebar (#103B3D), flat (no decorative gradients or colour washes), soft 1px borders, 16px card radius, small dense type (13px body). Colour is reserved for meaning: actions, selection, status, charts and module icons.**

### [T-COLOR-GROUND] Ground, surfaces, lines
| Token | Light | Dark | Used for |
|---|---|---|---|
| `--background` | `#f3f6f5` | `#0b1819` | page ground |
| `--background-alt` | `#edf2f1` | `#091415` | alt ground |
| `--surface` | `#ffffff` | `#112223` | cards, panels, table |
| `--surface-elevated` | `#ffffff` | `#172b2c` | modals, popovers, menus, toasts |
| `--surface-tint` / `--surface-2` | `#f7faf9` | `#142728` | table header, card footers, filter strip |
| `--muted` | `#edf2f1` (secondary surface) | `#1a3031` | chips, hover fills, skeletons |
| `--readonly-background` | `#f3f6f5` | `#0f1f20` | read-only fields |
| `--input-background` | `#ffffff` | `#0e1d1e` | inputs |
| `--border` | `#dce6e3` | `#20383a` | default 1px border |
| `--border-strong` | `#c3d2ce` | `#2f4c4e` | hover border |
| `--input-border` | `#d3dfdc` | `#29434a` | inputs, quiet buttons |

### [T-COLOR-TEXT] Text
| Token | Light | Dark | Role |
|---|---|---|---|
| `--foreground` | `#193536` | `#e3eeed` | primary text, titles |
| `--muted-foreground` | `#496263` | `#a8bebc` | secondary text, labels |
| `--subtle-foreground` | `#5c6f70` | `#8ba3a1` | muted text: hints, captions (closest to #718483 that passes 4.5:1) |
| `--icon-foreground` | `#718483` | `#7f9896` | idle icons, chevrons, placeholder glyphs (≥ 3:1) |
| `--help-foreground` | `#4f6667` | `#9fb5b3` | field help text |
| `--faint-foreground` | `#9aaaa9` | `#56706e` | decorative only (not for reading) |

### [T-COLOR-BRAND] Brand & status
| Role | Token | Light | Dark | Soft bg / soft text (light) |
|---|---|---|---|---|
| **Primary (teal)** — main buttons, links, active, focus | `--primary` | `#087f80` | `#35bdb2` | `--primary-soft` rgba(8,127,128,.09) / `--primary-soft-foreground` `#06696b` |
| hover / pressed | `--primary-hover` / `--primary-strong` | `#06696b` / `#055a5c` | `#4fcac0` / `#2aa69c` | `--primary-softer` rgba(…,.05) |
| text on primary | `--primary-foreground` | `#ffffff` (4.8:1) | `#05201f` (dark ink) | |
| **Secondary (emerald)** — Submit, positive | `--secondary` | `#16845a` | `#3fb57f` | `#ddf5ea` / `#0f6b47` |
| **Accent (teal)** — sidebar accent, demo tags | `--accent` | `#35bdb2` | `#4fcac0` | `#e1f5f3` / `#0b6f6a` |
| Success | `--success` | `#198754` | `#4cc38a` | `#ddf5ea` / `#0f6b47` |
| Warning (amber) | `--warning` | `#c98918` | `#e0ae4a` | `#fbf1dc` / `#8a5d0b` |
| Danger (red) | `--danger` | `#c94b43` | `#e8857c` | `#fbe7e5` / `#a2352e` |
| Info (blue) | `--info` | `#3284a8` | `#6bb8da` | `#e2f1f7` / `#1f6684` |

Status pattern everywhere: **soft background + dark text of the same hue** (never solid status fills, except the primary/secondary buttons).

### [T-COLOR-CHART] Chart palette (fixed order, max 6)
| Slot | Light | Dark | Hue |
|---|---|---|---|
| `--chart-1` | `#009090` | `#1f9d99` | teal |
| `--chart-2` | `#e07a2e` | `#d5732f` | orange |
| `--chart-3` | `#3d6fd1` | `#6b93e3` | blue |
| `--chart-4` | `#c2417f` | `#d9659a` | magenta |
| `--chart-5` | `#6f9a22` | `#78a532` | olive |
| `--chart-6` | `#7650c4` | `#9a7de0` | violet |
| `--chart-neutral` | `#a7b7b5` | `#5f7473` | "Other", drafts |
| `--chart-track` / `--chart-grid` | `#e8efed` | `#213536` / `#233738` | unfilled bars, gridlines |
| `--chart-axis` | `#617374` | `#91a5a4` | axis labels |
| `--severity-0…3` | teal → amber `#d9a13a` → orange → red | | ageing buckets |

### [T-COLOR-MODULE] Module accent colours (icons only)
| Token | Light | Dark | Modules using it |
|---|---|---|---|
| `--mod-crm` | `#c2416b` | `#e88aa8` | CRM, HR, NGO Beneficiaries |
| `--mod-selling` | `#0e6e70` | `#32b8b2` | Selling |
| `--mod-buying` | `#3a6fb0` | `#7fa7dd` | Buying |
| `--mod-accounts` | `#16845a` | `#4cc38a` | Accounts, NGO Donors |
| `--mod-stock` | `#b7791a` | `#e0ae4a` | Stock |
| `--mod-manufacturing` | `#19a7ae` | `#3cc3ca` | Manufacturing, NGO Impact |
| `--mod-projects` | `#4f5fb8` | `#95a0e0` | Project Mgmt, NGO Projects |
| `--mod-assets` | `#0f8a7e` | `#3fc2b4` | Assets, NGO Centres |
| `--mod-support` | `#c46a2b` | `#e39a62` | Support, NGO Expenses |
| `--mod-quality` | `#3f8f4f` | `#7cc98b` | Quality, NGO Programmes |
| `--mod-setup` | `#607879` | `#9fb3b2` | Setup |

Inside `.sidebar`, the module tokens are set to their **dark-theme variants** in both themes so they read on the deep-teal sidebar while staying the same hues.

### [T-COLOR-NAV] Sidebar (deep teal in both themes)
| Token | Light | Dark |
|---|---|---|
| `--nav-bg-1` (Level 1) | `#103b3d` | `#0a2e30` |
| `--nav-bg-2` (Level 2) | `#164749` | `#0f3739` |
| `--nav-border` | rgba(255,255,255,.08) | .07 |
| `--nav-fg` / `--nav-muted` | `#f4f8f7` / `#dbe7e5` | same |
| `--nav-subtle` | `#9dbcb9` | same |
| `--nav-hover` | rgba(255,255,255,.06) | .05 |
| `--nav-active-bg` | rgba(53,189,178,.17) (teal wash) | .16 |
| `--nav-accent` / `--nav-brand` | `#35bdb2` (selected bar, focus) | same |
| `--nav-input` | rgba(0,0,0,.18) | .22 |
| `--nav-tooltip-bg` | `#0a2a2c` | `#071f20` |

### [T-TYPE] Typography
| Token / class | Value | Used for |
|---|---|---|
| `--font-sans` | Public Sans | all UI text |
| `--font-display` | Bricolage Grotesque | page titles, big numbers (KPI, chart totals), brand name, section titles |
| `--font-mono` | IBM Plex Mono | eyebrows, record IDs |
| `--text-2xs` | 11px | captions |
| `--text-xs` | 11.5px | helper, badges |
| `--text-sm` | 12px | labels |
| `--text-base` | **13px** | **body default** |
| `--text-md` | 14px | page subtitle |
| `--text-lg` | 15px | card title |
| `--text-section` | 18px | section title |
| `--text-xl` | 28px | page title (22px under 700px) |
| Body line-height | 1.5 | |
| Common weights | 400 / 500 (labels, buttons) / 600 (titles, active) / 700 (page titles, KPI values) | |
| Table header | 10.5px, 600, uppercase, letter-spacing .07em | |
| Eyebrow | mono 10.5px, 500, uppercase, letter-spacing .12em, teal | |

### [T-SPACE] Spacing (4/8 scale)
`--space-1` 4 · `--space-2` 8 · `--space-3` 12 · `--space-4` 16 · `--space-5` 20 · `--space-6` 24 · `--space-8` 32 · `--space-10` 40.
Most components use literal px values close to this scale (10, 14, 18, 22 are also common).

Typical paddings: card body `18px 22px 22px`; panel `18px 20px 20px`; KPI tile `16px 18–20px`; table cell `0 14px`; page body `22px 28px 56px`.
Typical gaps: grids **14px**, page sections **20px** (`.page` gap), Module page **16px**, Document page **14px**.

### [T-RADIUS] Radius
| Token | Value | Used for |
|---|---|---|
| `--radius-sm` | 6px | badges, small chips |
| `--radius-md` | 9px | buttons, inputs, menu items |
| `--radius-lg` | 12px | small cards (browse, shortcut, report), popovers, toasts |
| `--radius-xl` | 16px | **cards / panels / modals / list card** |
| pills | 999px | counts, filter chips, trend pills |

### [T-SHADOW] Elevation (very subtle, teal-tinted)
| Token | Light value | Used for |
|---|---|---|
| `--shadow-sm` | `0 1px 2px rgba(15,59,61,.04)` | inputs, buttons, form sections |
| `--shadow-md` | `0 1px 2px …04, 0 4px 14px -4px rgba(16,59,61,.07)` | cards, KPI tiles, panels, form sections |
| `--shadow-hover` | `0 1px 2px …05, 0 10px 24px -10px rgba(16,59,61,.18)` | interactive cards on hover (KPI links, browse, report cards) |
| `--shadow-lg` | `0 18px 40px -16px rgba(15,59,61,.22)` | modals, popovers, toasts, save bar |
| `--shadow-primary` | `0 1px 2px rgba(14,110,112,.24)` | primary button |

### [T-SIZE] Fixed sizes
| Token | Value |
|---|---|
| `--control-height` | 38px (md button, input) |
| `--control-height-sm` | 34px (sm button, tool button) |
| `--topbar-height` | 60px |
| Sidebar Level 1 | 248px |
| Sidebar rail | 68px |
| Sidebar Level 2 | 236px |
| Page max-width | 1480px (`.page-body`) |
| Narrow page | 960px (`.page--narrow`) |

### [T-FOCUS] Focus
`--ring: rgba(14,110,112,.45)`; `--focus-ring: 2px solid var(--ring)`, offset 2px — applied to every `:focus-visible`.
Inputs on focus: border `--primary` + `--focus-glow` (`0 0 0 3px rgba(14,110,112,.12)`).
In the sidebar: `outline: 2px solid var(--nav-accent)`, offset −2px.

### [T-THEME] Theme switching
- Store: [src/stores/theme.ts](src/stores/theme.ts). Preference `light | dark | system`, saved in `localStorage['arcway-theme']`, default **light**.
- Toggles the `.dark` class on `<html>`. System mode listens to `prefers-color-scheme`.
- Controls: topbar sun/moon button, user-menu segmented control, Settings page.

---

## 3. Global utility classes

From [src/index.css](src/index.css).

| ID | Class | What it does |
|---|---|---|
| [G-EYEBROW] | `.eyebrow` | mono, 10.5px, uppercase, wide tracking, teal; small label above titles |
| [G-DISPLAY] | `.display` | display font |
| [G-SECTION-TITLE] | `.section-title` | 18px display, 600 |
| [G-PAGE] | `.page` | flex column, gap 20px |
| [G-PAGE-HEADER] | `.page-header` | title block on the left, `.page-actions` on the right, bottom-aligned; stacks under 700px |
| [G-PAGE-TITLE] | `.page-title` | 28px display, 700, −.015em |
| [G-PAGE-SUBTITLE] | `.page-subtitle` | 14px subtle text |
| [G-BACK-LINK] | `.back-link` | 12px muted link with arrow, underline on hover |
| [G-TEXT-LINK] | `.text-link` | teal link, underline on hover |
| [G-TONES] | `.tone-violet / green / amber / rose / cyan / blue / slate` | soft bg + text pairs (note: "violet" is teal now) |
| [G-MONOGRAM] | `.monogram` (28px, r8) / `.monogram--lg` (48px, r12) | initials square for records |
| [G-KPI-TONE] | `.kpi-tone-*` | sets `--tone` to a chart/status colour for KPI tiles |
| [G-CONTROL] | `.control` | shared input/select/textarea look: 38px, r9, 1px `--input-border`, focus glow, read-only dashed look |
| [G-TOOL-BUTTON] | `.tool-button` (+`--icon`, `--active`), `.tool-count` | 34px toolbar buttons used in list toolbars and pagination |
| [G-POP-TITLE] | `.pop-title` | 11px uppercase heading inside popovers |
| [G-ICON-BUTTON] | `.icon-button` | 36px square icon button (topbar theme/notifications) |
| [G-SEARCH] | `.search-field` + `.search-field-clear` | search input with icon (List toolbar, Reports) |
| [G-COUNT] | `.count-pill` | count after a page title |
| [G-MENU] | `.menu-panel`, `.menu-item`, `.menu-item--danger`, `.menu-separator` | every dropdown menu (account, record ⋯, overflow tabs) |
| [G-SUMMARY] | `.summary-stat` | headline figure above a chart |
| [G-GROUP-LABEL] | `.group-label` | 11px uppercase label above card groups |
| [G-SKELETON] | `.skeleton` | pulsing muted block |
| [G-STAGGER] | `.stagger-in`, `.delay-1…4` | 4px rise + fade on load |
| misc | `.muted`, `.mono`, `.tabular`, `.sr-only`, `.spin` | |

---

## 4. App shell & layout

### [L-SHELL] Overall frame — [src/layouts/ErpShell.vue](src/layouts/ErpShell.vue)
```
┌──────────┬──────────────────────────────────────────────────────────┐
│          │ TOPBAR (sticky, 60px, frosted white, bottom border)      │
│ SIDEBAR  │ [☰] Module › List › Record      [🔍 Search… ⌘K] [☾][🔔][👤]│
│ (fixed,  ├──────────────────────────────────────────────────────────┤
│ deep     │                                                          │
│ teal)    │   PAGE BODY  (max-width 1480, centered,                  │
│          │              padding 22 28 56)                           │
│ 248px or │                                                          │
│ 68+236px │   <RouterView> with route-fade transition                │
│ or 68px  │                                                          │
│          │                                                          │
└──────────┴──────────────────────────────────────────────────────────┘
                                         Toasts bottom-right ▸ [ToastHost]
                                         Confirm modal       ▸ [ConfirmHost]
```
- `.main-column` gets `margin-left: var(--sidebar-offset)` (animated .22s).
- Login route (`meta.public`) renders without the shell.
- Under 900px: no margin; sidebar becomes a drawer with a blurred scrim.

### [L-SIDEBAR-STATE] Sidebar open / closed — [src/stores/layout.ts](src/stores/layout.ts)
One open/close button, always in the sidebar's **top-right corner**: in Level 2's header while it is docked, otherwise in Level 1's brand row (closed: an "Open sidebar" button under the brand mark). The state is saved in `localStorage['erp-sidebar-collapsed']`; Settings › "Compact sidebar" toggles the same state.

| State | When | Width taken |
|---|---|---|
| **Open, no module menu** | Dashboard, account pages | Level 1 with labels, 232px |
| **Open, module menu docked** | a module page, window ≥ 1280px | 232px Level 1 + 240px Level 2 = 472px |
| **Open, narrow window** | a module page, window < 1280px | 68px icon rail + 240px Level 2 |
| **Closed** | user closed it | 68px rail; a module's Level 2 **floats** over the page |
| **Mobile drawer** | ≤ 900px | 288px (max 86vw) overlay; Level 2 slides over Level 1 |

Choosing the open module again closes its Level 2. Level 2 header: "← Module" (display 18px) + open/close button; an always-visible "Search module…" filter; sections start with the module's own label above Overview.

### [L-GRIDS] Page grid patterns
| Class | Columns | Where |
|---|---|---|
| `.metric-grid` / `.kpi-grid` | 4 → 2 (≤1200/1100) → 1 (≤520/480) | Dashboard, Module |
| `.grid-2-1` / `.dash-grid` | `2fr / minmax(300px,1fr)` → 1 col (≤1000/1100) | chart + side panel |
| `.grid-1-1` | 2 equal → 1 col (≤1000) | Dashboard |
| `.browse-grid` / `.report-grid` | `auto-fill, minmax(240–260px, 1fr)` | Module browse, Reports |
| `.doc-layout` | `1fr / 300px` aside → 1 col (≤1200) | Document page |

---

## 5. Navigation components

### [N-CONFIG] Navigation data — [src/config/navigation.ts](src/config/navigation.ts)
Configuration-driven. Each module: `id, label, icon, color (--mod-*), type ('erpnext'|'custom'), workspace, sections[{label, items[{label, icon, doctype|report|route}]}]`. Items for DocTypes not installed are hidden at runtime.

**Workspaces & modules (order shown in sidebar):**
- **NGO:** Projects, Programmes, Beneficiaries, Centres, Donors, Expenses, Impact
- **ERPNext:** CRM, Selling, Buying, Accounts, Stock, Manufacturing, Project Mgmt, Assets, Support, HR, Quality, Setup
- Utility (footer): Help & docs, plus `utilityNavigation` entries (Preferences/Profile)

### [N-SIDEBAR] Sidebar container — [Sidebar.vue](src/components/navigation/Sidebar.vue)
Fixed, full height, z-index 50, background `--nav-bg-1`. Animates width .22s. Level 2 enters with slide (−12px → 0, fade) when docked; "float" variant when collapsed (shadow `12px 0 32px -12px rgba(0,0,0,.45)`).

### [N-LEVEL1] Level 1 (modules) — [SidebarLevelOne.vue](src/components/navigation/sidebar/SidebarLevelOne.vue)
```
┌──────────────────────────┐
│ [◆] ERPNext          [⇤] │  brand row, 60px. Mark: 30px teal-mint square, rotated outlined diamond
│     MODERN WORKSPACE     │  brand: display 15px 700 / 10px uppercase subtle
│ [🔍 Search        ⌘K ]   │  34px, dark input, nav-border
│ [▦] Overview             │  36px item, accent icon
│ NGO                      │  workspace label 10.5px 700 uppercase .1em, subtle
│ [●] Projects          ›  │  module item 36px, icon tinted module hue, chevron on hover/active
│ ...                      │
│ ERPNEXT                  │
│ ▌[●] Selling          ›  │  active: bg --nav-active-bg, 600, 3px left bar in module colour
├──────────────────────────┤
│ [📖] Help & docs         │  footer links 34px, border-top
│ [⚙] Preferences          │
└──────────────────────────┘
```
- **Rail (compact) mode:** icons only, 42×42 buttons, r10; workspace labels become 28px rules; tooltips fixed-position, dark (`--nav-tooltip-bg`), 12px.
- Hover: `--nav-hover` background, text to `--nav-fg`.

### [N-LEVEL2] Level 2 (module pages) — [SidebarLevelTwo.vue](src/components/navigation/sidebar/SidebarLevelTwo.vue)
```
┌────────────────────────┐
│ ← All modules      [×] │  head 60px (× only when floating)
│ [■] Selling            │  36px badge in module colour (dark ink icon); title display 16px 700
│     ERPNEXT · 14 pages │  kind tag 10px uppercase outlined
│ [🔍 Filter Selling… ]  │  shown when > 8 items
├────────────────────────┤
│ ▌ Overview             │  nav item 32px, 13px, r7
│ MASTERS                │  section label 10.5px 700 uppercase
│   Customer        1.2k │  count pill (nav-input bg, 10.5px)
│ TRANSACTIONS           │
│   Sales Order       45 │
│ REPORTS                │
│   All reports          │
└────────────────────────┘
```
Active item: `--nav-active-bg`, 600, icon + 3px left bar in module colour.

### [N-TOPBAR] Topbar — [Topbar.vue](src/components/navigation/Topbar.vue)
- Sticky, 60px, padding `0 28px`, `background: color-mix(surface 86%, transparent)` + `backdrop-filter: saturate(1.4) blur(12px)`, 1px bottom border.
- **Breadcrumbs moved into the page** ([Breadcrumbs.vue](src/components/navigation/Breadcrumbs.vue), rendered by ErpShell above every page): Dashboard › Module › List › Record; hidden on the Dashboard itself.
- **Layout:** wide search on the left (max 480px), then company chip (default company), theme, notifications, user on the right.
- **Search box:** 300px × 36px button ("Search or jump to…" + `⌘K` kbd). Hover: teal text, teal-tinted border, 3px soft ring. Shrinks to 220px ≤1280, icon-only ≤1080.
- **Icon buttons** (theme, notifications): 36×36, r9, 1px border, white; hover teal on `--primary-softer`. Theme icon cross-fades.
- **User chip:** 32px round avatar (teal bg, white initials) + name/email (max 150px) + caret; pill-shaped hover.
- **User menu (popover 250px):** header with name/email, Profile, Preferences, theme segmented control (light/dark/system), red "Log out".

### [N-PALETTE] Command palette (⌘K / Ctrl+K) — [CommandPalette.vue](src/components/navigation/CommandPalette.vue)
Overlay (`--overlay` + blur 3px), panel 640px wide, top 12vh, max-height 70vh, r16, `--shadow-lg`.
Input row 54px (14.5px text, teal search icon). Section headings 10.5px uppercase. Items 40px with a 26px tinted icon square (module colour), label + hint, active row tinted with `--c` at 11%. Footer with keyboard hints on `--surface-tint`.

### [N-NOTIFY] Notifications — [NotificationsMenu.vue](src/components/navigation/NotificationsMenu.vue)
Bell icon button with a red count badge (17px, 2px surface border). Popover list (max 380px); unread rows have a teal dot with soft ring; read rows muted. "Mark all read" link in teal.

---

## 6. Core components

### [C-BUTTON] BaseButton — [BaseButton.vue](src/components/ui/BaseButton.vue)
Props: `variant` (default `quiet`), `size` (default `md`), `loading`, `disabled`, `type`.

| Size | Height | Padding | Font |
|---|---|---|---|
| `xs` | 28px | 0 10px | 12px |
| `sm` | 34px | 0 12px | 13px |
| `md` | 38px | 0 16px | 13px |

| Variant | Look | Use for |
|---|---|---|
| `primary` | solid teal, white text, 600, `--shadow-primary`; hover lighter, pressed darker | the one main action per surface (New X, Save) |
| `secondary` | solid emerald, 600 | positive confirmation (Submit) |
| `quiet` | white, 1px `--input-border`, dark text, sm shadow | neutral secondary (Refresh, Reports, Cancel) |
| `outline` | teal-tinted bg (`--primary-softer`) + teal 35% border, teal text | accent secondary (Amend) |
| `ghost` | transparent, muted text; hover `--muted` | inline/toolbar (Discard) |
| `danger` | white with red text; hover red-soft bg + red border | destructive (Delete, Cancel doc) |

All: r9, gap 6px (icon + label), `translateY(1px)` on press, disabled = 50% opacity, loading shows spinning `LoaderCircle 14`.

### [C-BADGE] BaseBadge — [BaseBadge.vue](src/components/ui/BaseBadge.vue)
22px tall (`md` = 26px), r6, 11.5px 600, **6px dot in currentColor** + label, soft bg + tinted 1px border. Tones: `violet` (=teal), `green`, `amber`, `rose`, `cyan`, `blue`, `slate`.

### [C-BADGE-MAP] Status → tone vocabulary — [src/lib/display.ts](src/lib/display.ts)
| Tone | Meaning | Example statuses |
|---|---|---|
| slate | draft / neutral | Draft, Disabled, Closed, Not Started |
| blue | submitted / in flight | Open, Submitted, In Progress, Ordered |
| amber | waiting | To Bill, To Deliver, Unpaid, Pending, On Hold |
| green | done / good | Completed, Paid, Active, Delivered, Approved |
| rose | bad | Cancelled, Overdue, Rejected, Lost, Expired |
| cyan | returns | Return, Credit/Debit Note Issued |

Monograms use a hash of the record name → `violet | cyan | blue | slate` (never status colours).

### [C-CARD] PanelCard — [PanelCard.vue](src/components/ui/PanelCard.vue)
Props: `title`, `eyebrow` (subtitle under the title), `actionLabel` (small 30px quiet button top-right), `noPadding`.
White, 1px border, **r16**, `--shadow-md`, overflow hidden. Header padding `20px 22px 0`; title 15px 600; subtitle 12.5px subtle. Body padding `18px 22px 22px`. `noPadding` adds a divider under the header (for tables).

### [C-PANEL] (removed)
The Module page now uses PanelCard; there is one card component. PanelCard has an `#actions` slot for header content such as a legend.

### [C-METRIC] MetricCard (the only KPI tile) — [MetricCard.vue](src/components/data-display/MetricCard.vue)
```
┌──────────────────────────────────┐  white, r16, border, shadow-md (no colour wash)
│ [▣] Sales this month             │  30px icon square (tone 12%) — or, with no icon, an 8px tone dot on the right
│                                  │
│ ₹4.2L                ╱╲_╱‾       │  value: display 28px 700 (19px when longer than 10 chars); sparkline 32px
│ [↗ +12%]  vs last month          │  trend pill (green good / red bad / grey flat)
└──────────────────────────────────┘  link hover: tone border, shadow-hover, 1px lift
```
Props via `metric`: `label, value, hint, delta, trend, upIsGood, tone, icon?, to, loading, emptyHint, spark, sparkColor`. Used on the Dashboard and on every Module page (ERPNext and NGO).

### [C-TABLE] DataTable — [DataTable.vue](src/components/data-display/DataTable.vue)
| Part | Spec |
|---|---|
| Header | 38px, `--surface-2` bg, 10.5px 600 uppercase .07em, muted; sticky; sortable columns are buttons with arrow 12px; sorted column teal |
| Row | **50px** (compact 38px), 13px muted text, 1px bottom border, tabular nums |
| First column | identity: 28px image or monogram + title (13px 600) + ID (11px mono subtle) |
| Status | BaseBadge |
| Link cells | teal 500 |
| Check cells | dot + Yes/No (green dot with ring when Yes) |
| Numbers | right-aligned |
| Hover / focus | `--primary-softer` bg; focus adds a 3px teal inset on the left; chevron at row end fades in & nudges 2px |
| Selected | `--primary-soft` bg + 3px teal inset left |
| Loading | skeleton rows with varied widths; refresh dims body to 55% |
| ≤ 720px | **rows become cards** (r12, border, label: value pairs, dashed divider under title) |

### [C-MODAL] AppModal — [AppModal.vue](src/components/overlays/AppModal.vue)
Default 480px, top 12vh, max-height 76vh, r16, `--surface-elevated`, `--shadow-lg`, overlay + 2px blur. Head 15px 600 + subtitle; footer right-aligned buttons on `--surface-tint`. Enter: fade + `translateY(-6px) scale(.98)`. Esc / backdrop closes.

### [C-DRAWER] AppDrawer — [AppDrawer.vue](src/components/overlays/AppDrawer.vue)
Right side, default 560px, full height, border-left, same head/footer pattern. Slides in 24px.

### [C-POPOVER] AppPopover — [AppPopover.vue](src/components/overlays/AppPopover.vue)
Anchored under the trigger (+6px), `align: start|end`, default 320px, padding 12px, r12, `--shadow-lg`. Closes on outside click / Esc. Used for filters, sort, columns, user menu, notifications.

### [C-TOAST] ToastHost — [ToastHost.vue](src/components/feedback/ToastHost.vue)
Bottom-right stack, max 380px. Card r12, 3px **coloured left border** (success emerald / error red / info teal / warning amber), icon 17px in the same colour, title 13px 600 + description 12.5px, dismiss ×. API: `useToast()`.

### [C-CONFIRM] ConfirmHost
AppModal 420px with message + Cancel (quiet) + confirm (primary / secondary / danger by `tone`). API: `useConfirm()`.

### [C-EMPTY] EmptyState — [EmptyState.vue](src/components/feedback/EmptyState.vue)
Centered, min-height 260px. 48px rounded icon tile on solid `--primary-soft` with an inner ring; title 14px 600; description 13px muted (max 360px); action slot. `compact` variant smaller.

### [C-ERROR] ErrorState
Same layout; icon tile red-soft (error), amber-soft (permission, lock icon), cyan-soft (not found). Optional Retry quiet button.

### [C-CHIPS] Chips & pills used across pages
| Name | Look | Where |
|---|---|---|
| count pill | 22px, teal-soft, 12px 600 | after page titles (List, Reports) |
| filter chip | 26px pill, teal-soft + border, × button | List active filters |
| fixed filter chip | cyan-soft | List |
| demo tag / demo note | cyan-soft pill (note: dashed border) | NGO demo data |
| dirty pill | dashed amber outline, amber text | Document "Unsaved changes" |
| status tab count | 18px muted pill → teal-soft when active | List status tabs |

---

## 7. Forms & fields

### [F-DYNAMIC] DynamicForm — [DynamicForm.vue](src/components/forms/DynamicForm.vue)
Renders any DocType from metadata: Tab Break → tabs, Section Break → section cards, Column Break → columns.
- **Tabs bar:** sticky under the doc header, 4px padding, r12, frosted surface (92% + blur 8px). Tab 32px, 13px 500; active = teal-soft bg + teal text 600; red 7px dot when the tab has errors; extra tabs go into a "More ⋯" menu.
- **Section card:** padding `18px 20px 20px`, r16, `--shadow-md`. Heading 14px 600 with a **3px solid teal bar** on the left; optional description 12px. Collapsible sections use a teal caret that rotates −90°.
- **Grid:** `repeat(--form-columns, 1fr)`, column gap 24px, field gap 14px; single column ≤900px.
- **Field:** label 12px 500 muted (turns teal when the field has focus; red when invalid); required `*` red; help 11.5px; error 11.5px red.
- **Dense mode** (used in child-row editors): sections lose their card look and become divided blocks.

### [F-RENDERER] FieldRenderer — [FieldRenderer.vue](src/components/forms/FieldRenderer.vue)
| Field type | Look |
|---|---|
| Data/Int/Float/etc. | `.control` input (38px). Numbers right-aligned, with a teal-soft affix chip (currency/%) |
| Select | native select + shared chevron |
| Check | custom 18px box, r5, 1.5px border; checked = teal fill with white tick |
| Text / Small / Long text | textarea, min-height 92 / 60 / 150 |
| Rating | stars, amber when on |
| Color | 26×24 swatch + hex input |
| Read-only | 36px box with **dashed border** on `--readonly-background`; numbers right-aligned |
| Compact (in grids) | 30px, transparent until hover/focus |

### [F-LINK] LinkField — [LinkField.vue](src/components/forms/fields/LinkField.vue)
Input with link icon + caret; dropdown panel fixed-position (z 120), max 300px, r12, `--shadow-lg`. Options: name 13px 500 + description 11.5px; active option teal-soft; selected gets ✓. "+ Create new" row at the bottom. Read-only shows a **teal-soft chip** linking to the record.

### [F-TABLE] TableField (child tables) — [TableField.vue](src/components/forms/fields/TableField.vue)
Bordered r12 block. Head 44px on `--surface-tint` with title (teal icon) + count pill + actions. Grid min-width 640px, header 34px 11.5px 600, rows 40px with compact inline editors; hover `--primary-softer`; row index column; per-row icon actions fade in on hover; error cells get a 2px red underline; totals in a tinted footer.

### [F-OTHER] Other fields
- **AttachField:** dashed teal drop zone (36px, or 120×96 for images), file row with teal name and red-hover ×.
- **TableMultiSelectField:** teal-soft pill chips with ×.
- **TextEditorField:** toolbar (28×26 icon buttons) on `--surface-tint` + content area 120–420px.

### [F-ACTIVITY] ActivityPanel (document aside) — [ActivityPanel.vue](src/components/document/ActivityPanel.vue)
300px sticky column of small cards (r16, padding 14/16): Attachments, Comments (textarea with an inline 28px teal send button), Timeline (1px vertical line, 9px dots: emerald = created, cyan = email, grey = other; comments in speech-bubble boxes on `--surface-tint`).

---

## 8. Charts & data viz

General rules (from the code comments): colours come from `--chart-*` tokens in fixed order, max 6 series; 2px surface gaps separate segments; tooltip and axis text use `--font-sans`; tokens are read at runtime via `getComputedStyle`, so charts follow the theme.

| ID | Component | Look |
|---|---|---|
| [V-TREND] | [TrendChart.vue](src/components/charts/TrendChart.vue) (ECharts) | Line: smooth 0.3, no point symbols until hover (8px circle), **area gradient 32% → 2%**, dashed gridlines `[3,4]`. Bar: top radius 5, stacked bars split by surface-coloured borders. Optional legend (10px rounded squares) |
| [V-DONUT] | [DonutChart.vue](src/components/charts/DonutChart.vue) (ECharts) | ring with 2px surface borders, r4 slices; total in the centre (display 24px 700 + 10.5px uppercase label); legend list beside it with dashed separators, value + % |
| [V-GAUGE] | DonutGauge | SVG progress ring, centre value display 30px; arc animates .6s |
| [V-RADAR] | RadarChart (ECharts) | ≤ 3 series, legend on top |
| [V-RANK] | RankBars | numbered rows (22px tinted index square), label + value, 6px track with a solid fill |
| [V-SEGMENT] | SegmentedBar | 14px stacked horizontal bar, 2px gaps, r6 ends; heading total in display 22px; legend list (1 or 2 columns) |
| [V-BUDGET] | BudgetBars | allocated (neutral 45%) vs used (coloured) on an 8px track; "over" tag red |
| [V-SPARK] | Sparkline | tiny SVG line in `--spark` colour + end dot with surface ring; decorative (aria-hidden) |
| [V-PLACEHOLDER] | ChartPlaceholder | empty state that keeps the card size: faint dashed **ghost** of the chart (line / bar / donut / rows) under a frosted message box with icon, title, description, optional action |

---

## 9. Pages

### [P-LOGIN] Login — [LoginPage.vue](src/pages/LoginPage.vue)
```
┌──────────────────────────────┬──────────────────────────────┐
│ [◆] ERPNext                  │                              │
│  (fine dot-grid background,  │   ┌──────────────────────┐   │
│   faded at edges)            │   │ Welcome back          │  │
│                              │   │ Sign in with your…    │  │
│ Run the whole business from  │   │ Username or email     │  │
│ one calm, fast workspace.    │   │ [                  ]  │  │
│  [▣] Every module, one UI    │   │ Password              │  │
│  [▣] Live ERPNext data       │   │ [                  ]  │  │
│  [▣] Your permissions apply  │   │ [   → Sign in      ]  │  │
│                              │   └──────────────────────┘   │
│ Powered by Frappe & ERPNext  │       card max 400px, r16    │
└──────────────────────────────┴──────────────────────────────┘
```
Two equal columns; brand panel is white with a radial-masked dot grid; headline 28px 600. Brand mark: 26px teal square with diamond + small emerald dot. Under 900px only the form shows.

### [P-DASHBOARD] Overview — [DashboardPage.vue](src/pages/DashboardPage.vue)
Top-to-bottom:
1. **[P-DASH-HERO] Page header** — standard page header (no tinted box): eyebrow date, greeting as a 28px page title, "Live from ERPNext · N items · N customers", Refresh (quiet sm) on the right.
2. **[P-DASH-METRICS]** 4 × MetricCard (staggered entrance).
3. **[P-DASH-ATTENTION] + [P-DASH-CREATE]** (`grid-1-1`) — "Needs your attention" list rows (36px tinted icon, title/detail, teal "Open →") | "Create" 2-column shortcut grid (32px module-tinted icon, label/detail, + icon).
4. **[P-DASH-SALES] + [P-DASH-COLLECTION]** (`grid-2-1`) — "Sales & purchases" summary stats (display 24px) + net + line chart | "Collection rate" gauge + 2-cell stat box.
5. **[P-DASH-CUSTOMERS] + [P-DASH-AGEING]** (`grid-1-1`) — Top customers RankBars | Receivables by age SegmentedBar.
6. **[P-DASH-RECENT]** Recent transactions list (module-tinted icon, doc + party/time, amount + badge).
7. **[P-DASH-NGO]** NGO strip at the end, below a divider and tagged "Demo data": metrics + trend line + donut.

### [P-MODULE] Module overview — [ModulePage.vue](src/pages/ModulePage.vue)
Page tinted by module colour `--c`.
1. **[P-MOD-HEADER]** 46px module mark (module colour at 12% with a tinted ring, icon in module colour) + eyebrow ("ERPNext" / "NGO workspace") + title 28px + "N pages"; actions: Reports (quiet), New X (primary). Bottom border.
2. **[P-MOD-KPI]** 4 MetricCard tiles (tone dot, no icon); sparklines "new per week". No gradient lead tile.
3. **[P-MOD-TREND]** (`dash-grid` 2fr/1fr) headline trend chart + ranking (if configured in `config/module-dashboards.ts`).
4. **[P-MOD-CHARTS]** Activity line chart (documents per week, 8 weeks) + Status donut. NGO modules show their own panel set (trend, segments, donut, bars, radar, rank, budget, progress list).
5. **[P-MOD-BROWSE]** every page of the module, grouped by section (11px uppercase heading), auto-fill cards 240px+: 32px tinted icon, label/description, record count pill or ↗.
6. **[P-MOD-RECENT]** "Latest changes" rows: monogram, title/doctype, badge, relative time, chevron.

### [P-MOD-STOCK] Stock overview — [StockOverview.vue](src/components/dashboards/StockOverview.vue)
Replaces the generic KPI/chart/latest sections on the Stock module page; the browse section stays. Data: one call to `modern_erp_ui.api.stock_dashboard.get_stock_overview` (permission-aware, per-section `error`).
1. Meta line ("Live from ERPNext · company · currency · as of …") + Refresh tool button.
2. 4 × MetricCard: Total stock value (Bin, sparkline from the trend) · Stock items · Low-stock items · Pending stock entries.
3. `dash-grid`: Stock value trend (weekly running total from the Stock Ledger, 26 weeks) | Stock alerts (items at/below reorder level, qty bar, Low/Out badge, "Replenishing" vs "Needs reorder").
4. `dash-grid`: Top items by value (RankBars) | Quick actions (only DocTypes the user may create, plus the Stock Balance report).
5. Recent stock activity: latest stock vouchers with direction icon (in = emerald, out = orange, transfer = blue), party, qty, value change.
Every card has loading skeleton, empty (ChartPlaceholder), permission and error (ErrorState) states.

### [P-DASH-LAYOUT] Dashboard layout (Dashboard, Stock and every module overview)
One layout from the reference design, built from shared parts in [src/components/dashboards/](src/components/dashboards/) and the global `.dashboard` grid classes in `index.css`:
1. **DashboardHeader** — "Good morning, <name>" (name in teal), subtitle, actions (Refresh · Reports · primary "New …").
2. **`.dash-kpis`** — 4 × MetricCard (round icon, value, change + "vs …" bottom-left, smooth sparkline bottom-right).
3. **`.dash-main`** — main trend chart (PanelCard, legend + period in `#actions`) | **ActivityFeed** ("Recent … Activity", View all).
4. **`.dash-three`** — **ValueTable** (top items / customers / ranking) | **AlertList** (stock alerts, needs attention, status overview) | **QuickActions**.
Grids use container queries on `.dashboard`, so they reflow with the sidebar open or closed. Module pages keep the "browse all pages" grid underneath; NGO modules keep their own panel set under the same header and KPI row.

**Chart rules:** lines are smooth curves (ECharts `smooth: 0.55`, monotone; sparklines are monotone cubic curves). A series with no figures is not drawn; a line series that is mostly empty (< 30% of buckets) is drawn as columns; sparklines need ≥ 3 non-zero points. The empty-chart ghost is a soft solid curve.

### [P-LIST] DocType list — [ListPage.vue](src/pages/ListPage.vue)
```
 ● SELLING · SALES ORDER                                   [+ New Sales Order]
 Sales Orders (128)
 ┌───────────────────────────────────────────────────────────────────────────┐
 │ All 128 │ Draft 4 │ To Deliver 12 │ Completed 100 │ …    ← status tabs 42px│
 ├───────────────────────────────────────────────────────────────────────────┤
 │ [🔍 Search sales orders…] [Quick filters…]   [Filter][Sort][Cols][≡][⟳]   │ toolbar
 ├───────────────────────────────────────────────────────────────────────────┤
 │ (Customer = X ×) (Status contains Y ×)  Clear all       ← active filters  │
 ├───────────────────────────────────────────────────────────────────────────┤
 │ 3 selected  Clear                     [Export CSV] [Delete] ← bulk bar    │
 ├───────────────────────────────────────────────────────────────────────────┤
 │ DataTable [C-TABLE]                                                       │
 ├───────────────────────────────────────────────────────────────────────────┤
 │ 1–20 of 128 · 2 empty columns hidden Show     Rows [20▾]  [‹] 1 / 7 [›]   │
 └───────────────────────────────────────────────────────────────────────────┘
```
- Eyebrow has an 8px module-colour square with ring.
- Everything sits in one `.list-card` (r16, border, shadow-md).
- Status tabs: 2px teal underline when active.
- Search: 280px × 34px, focus = teal border + 3px soft ring.
- Bulk bar: solid `--primary-softer` with a 3px teal inset on the left.
- Density toggle (comfortable/compact) and refresh are icon tool buttons.
- Empty states: "no match" (with Clear) vs "no records" (with Create).

### [P-DOCUMENT] Record / new record — [DocumentPage.vue](src/pages/document/DocumentPage.vue) + [DynamicForm.vue](src/components/forms/DynamicForm.vue)
Metadata-driven for every DocType (tabs, sections, columns, depends_on, permissions all from ERPNext).
- **Header** (sticky): `New Sales Order` / DocType label · status badge (Not saved, Draft, Submitted, To Bill…) · "Unsaved changes" pill; record name (display 19px) · title; subtitle = the DocType's own description from metadata (fallback for new records). Actions by docstatus + permissions: ⋯ menu (Email, Duplicate, Reload, Show/hide empty, Delete), Print, Cancel, Amend, Save (primary unless Submit is the next step), Submit.
- **Summary strip** (existing records): up to 3 facts picked from metadata (party link → one amount → date → list-view fields; never the record's own name/title) + Status with "Modified …". 4 columns, 2×2 when the form column < 820px, stacked < 480px.
- **Tabs**: underlined strip on a white sticky bar; row count only on a tab that is essentially one child table.
- **Sections**: white cards (r16, shadow-md) with a 28px teal icon tile + 15px heading; the untitled first section reads "<DocType> details"; a section that is just one child table uses the table's own header. Collapsible sections: caret on the right + "N fields".
- **Fields**: 12.5px labels (teal while focused, red when invalid), red `*` for required, 40px inputs, read-only values in solid soft-grey boxes.
- **Child tables** ([TableField.vue](src/components/forms/fields/TableField.vue)): header with icon, label, "N rows", primary "Add row"; 38px header row, 46px rows, right-aligned numbers, totals footer, hover row actions (open, duplicate, delete), row drawer for full edit. Class is `grid-table` (not `grid`, which collides with Tailwind's `.grid`).
- **Side panel** (300px, sticky; optional): existing records → lifecycle from docstatus/creation/modified (Draft → Submitted → Cancelled, or Created / Last updated), Attachments, Activity; new records → "Required fields" checklist with progress (shown when ≥ 2 required fields). No invented timeline entries or related records.
- **Save bar**: floating at the bottom while there are unsaved changes (Ctrl/⌘ S).

### [P-REPORTS] Module reports — [ModuleReportsPage.vue](src/pages/reports/ModuleReportsPage.vue)
Page header + count pill + 260px search; groups with module-tinted uppercase titles; auto-fill report cards (32px tinted icon, name, type, arrow).

### [P-REPORT] Report runner — [ReportPage.vue](src/pages/reports/ReportPage.vue)
Filter card (auto-fill 200px grid), optional chart card, summary tiles (r12 with a **3px coloured left border**: cyan default, emerald, red, amber), results table (36px rows, 12.5px, sticky tinted header, hover teal-softer, links teal), row count footer.

### [P-SETTINGS] Preferences — [SettingsPage.vue](src/pages/SettingsPage.vue)
Narrow page (960px). PanelCards with setting rows: title 13px 600 + description; theme **segmented control** (muted track, selected = elevated white with shadow, teal icon); **toggle switch** 38×22 (teal when on). Connection card with a green status dot.

### [P-PROFILE] Profile — [ProfilePage.vue](src/pages/ProfilePage.vue)
Hero card (plain surface, shadow-md), 60px rounded-square avatar (r18); 2-column detail grid (icon + label/value rows); roles as teal-soft pills.

---

## 10. Motion

| ID | Name | Spec |
|---|---|---|
| [M-EASE] | easing | `--ease: cubic-bezier(.2,.7,.2,1)`; `--dur-fast` 120ms; `--dur-med` 200ms |
| [M-STAGGER] | page/tile entrance | `.stagger-in`: 280ms, from `opacity 0, translateY(4px)`; delays 30/60/90/120ms |
| [M-ROUTE] | page change | new page fades in 120ms; old page leaves instantly |
| [M-POP] | popovers/menus | 140ms, from `translateY(-4px) scale(.98)` |
| [M-MODAL] | modal | 160ms fade + 180ms `translateY(-6px) scale(.98)` |
| [M-DRAWER] | drawer | 200ms fade + 220ms slide 24px |
| [M-SIDEBAR] | sidebar | width .22s; Level 2 slide −12px / float −10px, 200ms |
| [M-TOAST] | toast | 180ms, from `translateY(8px) scale(.98)` |
| [M-MICRO] | hovers | chevrons/arrows nudge 2px; buttons press 1px; colours 120ms |
| [M-SKELETON] | loading | 1.4s opacity pulse .55 ↔ 1 |
| [M-REDUCED] | reduced motion | all animations/transitions reduced to .01ms |

---

## 11. Responsive breakpoints

| ID | Width | What changes |
|---|---|---|
| [R-1280] | ≤ 1280 | topbar search 220px |
| [R-1200] | ≤ 1200 | dashboard metric grid 2 cols; document aside drops below the form |
| [R-1100] | ≤ 1100 | module KPI grid 2 cols, dash grid 1 col |
| [R-1080] | ≤ 1080 | topbar search becomes an icon |
| [R-1000] | ≤ 1000 | dashboard 2-col grids stack |
| [R-900] | ≤ 900 | **sidebar → drawer**, hamburger shows, page padding 16px, user name hidden, form sections 1 col, list toolbar wraps, login brand panel hidden |
| [R-760] | ≤ 760 | document header not sticky, actions wrap full-width |
| [R-720] | ≤ 720 | **DataTable rows become cards** |
| [R-700] | ≤ 700 | page header stacks, page title 22px |
| [R-560] | ≤ 560 | breadcrumb shows only the current crumb |
| [R-520] | ≤ 520 | metric & shortcut grids 1 col, hero stacks |

---

## 12. Accessibility rules in place

- [X-CONTRAST] Text tokens are documented as ≥ 4.5:1; dark-mode primary uses dark ink because white would be 2.4:1.
- [X-FOCUS] One visible focus ring everywhere (`:focus-visible`).
- [X-KEYBOARD] ⌘K palette, Ctrl+S save, Esc closes overlays, mobile drawer traps focus and restores it, table rows are focusable (Enter opens).
- [X-ARIA] `aria-current` on nav, `aria-sort` on table headers, `role=tablist/tab`, `role=switch`, `role=radiogroup`, live region for toasts.
- [X-COLOR-MEANING] Green/red/amber are reserved for status; monograms use brand/neutral hues only.

---

## 13. Known inconsistencies / improvement hooks

These are places where the current UI is uneven. They are good starting points for "make it more attractive" work.

| ID | Issue | Where |
|---|---|---|
| [Q-SIDEBAR-HUES] | Sidebar module icons use Tailwind-style pastels (pink, **violet for Selling**, blue…) that don't match the teal identity or the light-mode `--mod-*` values | `index.css` `.sidebar { --mod-*: … }` | ✅ fixed: sidebar now uses the dark-theme module hues
| [Q-VIOLET-NAME] | Tone `violet` actually renders teal (legacy name) | `.tone-violet`, BaseBadge, `monogramTones` |
| [Q-CHEVRON] | Native select chevron is hard-coded `#807a99` (old purple-grey), not a token | `select.control` in `index.css` | ✅ fixed: now `--select-chevron` per theme
| [Q-DUP-CARDS] | Two card systems: `PanelCard` (title 15px/600, padding 22) vs Module page `.panel` (14.5px/700, padding 20) | PanelCard.vue vs ModulePage.vue | ✅ fixed: Module page uses PanelCard
| [Q-DUP-KPI] | Two KPI tiles: `MetricCard` (icon square) vs `.kpi` (dot + lead gradient) | MetricCard.vue vs ModulePage.vue | ✅ fixed: Module page uses MetricCard
| [Q-DUP-SEARCH] | Search inputs built 4 different ways (topbar box, `.tool-search`, `.report-search`, sidebar `.filter`) with slightly different heights (34/36) and focus rings | Topbar, ListPage, ModuleReportsPage, SidebarLevelTwo | ◐ List + Reports now share `.search-field`; topbar (button) and sidebar (dark) stay separate on purpose
| [Q-DUP-ROWS] | List-row patterns repeated with small differences (`.list-row`, `.recent-row`, `.rank-row`, `.notif-item`) | Dashboard, Module, charts, notifications |
| [Q-DUP-ICONBTN] | `.icon-button` defined separately in Topbar and NotificationsMenu | | ✅ fixed: global `.icon-button`
| [Q-HERO] | Dashboard hero is a low-key strip (20px title) while other pages use 28px titles — weak first impression | DashboardPage `.hero` | ✅ fixed: standard 28px page header
| [Q-BRAND] | Name mismatch: `index.html` title says **"Arcway"**, sidebar/login say **"ERPNext"**, theme key is `arcway-theme` | index.html, SidebarLevelOne, LoginPage |
| [Q-LOGIN-FONT] | Login headline uses the sans font, not the display font used for other titles | LoginPage `.brand-copy h2` | ✅ fixed: display font
| [Q-FLAT] | Almost everything is white card + 1px border + near-invisible shadow; depth/hierarchy comes only from borders | global | ✅ fixed: shadow scale retuned + `--shadow-hover` for interactive cards
| [Q-TAILWIND] | Tailwind is installed but unused; styling is scoped CSS (pick one direction before a large redesign) | package.json, index.css |
| [Q-LEGACY-TSX] | ~50 unused React `.tsx` files in `components/ui/` | [A-LEGACY] |
| [Q-HEADER-INCONSISTENT] | Page headers differ: Module page has a bordered header with a coloured mark; List page uses eyebrow + title; Document page has its own sticky header | ModulePage, ListPage, DocumentPage |

---

## 14. How to write a change request

Use the IDs above. The more of these fields you give, the closer the result will match what you have in mind.

```
TARGET:     [C-METRIC]            (one or more IDs, or "global")
SCOPE:      light + dark | light only | this page only | everywhere it's used
CHANGE:     what should look different
            - value font size 28px → 34px
            - icon square: move to top-right, 40px, solid tone background, white icon
            - add a subtle hover lift (translateY(-2px) + shadow-lg)
KEEP:       what must NOT change (e.g. "keep sparkline", "keep token names")
REFERENCE:  (optional) a site/app/screenshot whose style you like and which aspect of it
PRIORITY:   must / nice-to-have
```

### Example requests

**Token-level (changes everything at once):**
> [T-RADIUS] Change `--radius-xl` from 16px to 20px and `--radius-md` from 9px to 10px.
> [T-SHADOW] Make `--shadow-md` more visible: `0 1px 3px rgba(15,59,61,.06), 0 12px 32px -8px rgba(15,59,61,.12)`.

**Identity-level:**
> [T-COLOR-BRAND] Switch primary from teal to indigo `#4f46e5` (dark `#818cf8`); keep emerald for secondary. Also update [T-COLOR-NAV] to a deep indigo sidebar and fix [Q-SIDEBAR-HUES] to match.

**Component-level:**
> [C-TABLE] Rows 50px → 56px, zebra striping on `--surface-tint`, header no longer uppercase (12px 600, sentence case).

**Page-level:**
> [P-DASH-HERO] Make the hero a full-width banner: 28px greeting, teal→emerald gradient background with white text, quick stats on the right, keep the Refresh button.

**Consistency clean-up:**
> Fix [Q-DUP-CARDS] and [Q-DUP-KPI]: make ModulePage use PanelCard and MetricCard so all cards and KPI tiles look the same.

### Handy vocabulary
- **Ground** = page background; **surface** = card background; **elevated** = floating layers (menus, modals).
- **Soft** = tinted background + same-hue dark text (badges, chips, active states).
- **Tone** = one of `violet(teal) / green / amber / rose / cyan / blue / slate`.
- **Module colour** = the `--mod-*` hue a module uses for its icon, dot and tints (`--c`).
- **Rail** = the 68px icon-only sidebar.
