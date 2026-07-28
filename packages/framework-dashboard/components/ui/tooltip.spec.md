Trimmed shadcn-style Tooltip on Base UI (already a dependency via animate-ui — no Radix pulled in), composed per item as Tooltip > TooltipTrigger(render=…) > TooltipContent.

## Decisions

- Tooltips open instantly (#1149): `TooltipTrigger` hard-codes `delay={0}`. Base UI reads delay off the trigger and an explicit trigger delay beats any `<TooltipProvider>`, so this one default governs every tooltip and no provider is needed anywhere (the sidebar still mounts one, harmlessly).
- Popup gets an explicit `role="tooltip"`: Base UI leaves it unlabelled (treating the tooltip as a supplement to the trigger's own accessible name). The role names it for assistive tech and for tests, which query by role now that no element carries a `title` attribute.

## Facts

- Portal + Positioner live inside `TooltipContent`, so `side`/`align`/`sideOffset` are props of TooltipContent — this is why sidebar.tsx can pass `side="right" align="center"` straight to it.
