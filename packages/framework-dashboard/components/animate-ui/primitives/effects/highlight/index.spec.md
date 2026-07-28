Vendored animate-ui "motion highlight" effect (`@ts-nocheck`): an animated background rectangle that follows the active/hovered item across a set of rows, in two rendering modes.

## TLDR

- `Highlight` provides context (active value, bounds setters, hover/click behavior, transition, exit delay); `HighlightItem` registers each row, sets `data-active`/`data-value`/`aria-selected`, and installs hover (`onMouseEnter`/`Leave`) or click handlers that set the active value.
- `mode: 'parent'`: one absolutely-positioned `motion.div` in the container animates top/left/width/height to the active item's measured `getBoundingClientRect()` (bounds recomputed relative to the container, with optional `boundsOffset`), so the highlight *glides* between rows; a scroll listener re-measures so it tracks the active row while the container scrolls.
- `mode: 'children'` (default): each item renders its own `motion.div` background sharing a `layoutId` (`transition-background-<id>`), letting motion/react morph it between items.
- `controlledItems` renders children as-is (callers place `HighlightItem`s themselves — what the files primitives do); uncontrolled wraps every child in a `HighlightItem` automatically.
- `forceUpdateBounds` re-measures on a requestAnimationFrame loop for items that move; `asChild` clones the child instead of wrapping; data attributes are merged non-overridingly (`getNonOverridingDataAttributes`).

## Facts

- The prop type is a 4-way union (controlled/uncontrolled × parent/children) so parent-mode-only props (`boundsOffset`, `containerClassName`, `forceUpdateBounds`) only typecheck in parent mode.
- `exitDelay` (default 200ms) is added to the transition delay on exit so the highlight lingers briefly after the pointer leaves.
