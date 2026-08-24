# Bug analysis: packages/framework/dashboard/components/ui/button.tsx

## Business logic (high-level)

The dashboard's button (button.SPEC.md): four emphasis variants — default (filled), outline,
ghost, destructive (red fill for confirmed destructive actions, #1032) — and five sizes including
two square icon sizes. Disabled state dims (`disabled:opacity-50`) and ignores clicks
(`disabled:pointer-events-none`, plus the native `disabled` semantics). All of that matches the
SPEC exactly (SPEC says "four emphasis levels … and in five sizes"; cva lists 4 variants and 5
sizes).

One reliance worth recording rather than reporting: the component does not force
`type="button"`, so a Button inside a `<form>` defaults to `type="submit"`. The dashboard's one
form (`StartAgentForm.tsx`) neutralizes submission with `onSubmit={e => e.preventDefault()}`, and
implicit submission (Enter in an input) clicking the form's first submit-typed button is therefore
the only residual effect — the same behavior upstream shadcn ships. Not contrary to any spec here.

## Functions (low-level)

- `buttonVariants` (cva) — base classes: focus ring on `focus-visible` with the app token, hover
  states per variant, destructive uses `--danger` fill with `--color-background` text (the same
  inversion rule the comment cites). Default variants applied when props are undefined. Correct.
- `Button({ className, variant, size, ...props })` — merges cva output with caller classes via
  `cn` (caller wins on conflicts through tailwind-merge). Spreads the rest, including `disabled`,
  `onClick`, aria props. Verdict: correct.
- `buttonVariants` export — used by callers that need the classes on non-button elements. Correct.

## Bugs found

None found.
