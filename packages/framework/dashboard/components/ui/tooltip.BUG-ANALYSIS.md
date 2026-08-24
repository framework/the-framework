# Bug analysis: packages/framework/dashboard/components/ui/tooltip.tsx

## Business logic (high-level)

The tooltip kit (tooltip.SPEC.md) on Base UI: opens instantly everywhere, and paints above the
menus/popovers whose entries trigger it. Checked:

- **Instant open**: `TooltipTrigger` hardcodes `delay={0}` before the spread — a caller could
  override via props (none does), and per the comment a trigger delay beats any provider, so the
  `TooltipProvider delay={0}` that SidebarProvider mounts is belt-and-braces. Matches #1149.
- **Painted above menus** (#1506): the `z-50` lives on the `Positioner` — the actually positioned
  element — not the Popup (which Base UI leaves `position: static`, where z-index is inert). The
  long comment records the regression this fixes; the code matches it. Since menus/popovers carry
  their z-50 on their own positioners too, source order (tooltip portal mounts later, on hover)
  breaks the tie in the tooltip's favor. Matches.
- `role="tooltip"` on the Popup: names the popup for AT and tests (the stated replacement for
  `title` attributes). Matches.
- `side`/`align` are lifted onto the Positioner and only passed when defined (spread-conditional,
  respecting exactOptionalPropertyTypes); `sideOffset` defaults to 6. Remaining props (including
  the `hidden` the sidebar uses to suppress expanded-state tooltips) land on the Popup. Correct.

## Functions (low-level)

- `TooltipProvider` / `Tooltip` — direct aliases of the primitives. Correct.
- `TooltipTrigger(props)` — delay-0 trigger; render-prop pattern (`render={<button/>}` with
  children) is Base UI's own contract, used by CopyButton/SidebarMenuButton. Correct.
- `TooltipContent({...})` — Portal > Positioner(z-50) > Popup(card-toned, role=tooltip).
  Verdict: correct.

## Bugs found

None found.
