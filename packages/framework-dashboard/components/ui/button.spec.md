Trimmed shadcn/ui `Button` built with cva variants, the dashboard's canonical button (#406).

## TLDR

- Variants: `default` (primary fill), `outline`, `ghost`, `destructive`; sizes: `default`, `sm`, `xs`, `icon`, `icon-sm`.
- Also exports `buttonVariants` for callers that need the classes without the element.

## Facts

- `destructive` (#1032) is a `--color-danger` fill whose label inverts to `text-[var(--color-background)]` — the same fill-inversion rule ChoicePanel's Approve button follows.
- Styling is CSS-var tokens (`--color-primary` etc.), not Tailwind theme colors.
