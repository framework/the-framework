# Bug analysis: packages/framework/dashboard/components/DocsPanel.tsx

## Business logic (high-level)

Renders the agent's surfaced planning docs (#319/#328): a tab row (one button per doc name), the
active doc rendered as Markdown in a scroll area. Data and the docs-exist decision live in the
rail (#1146); this renders what it is handed. Loading and empty are distinct (#948): `!loaded` →
"Loading…", `loaded && docs.length === 0` → "No PLAN/TODO docs yet." — exactly the SPEC's rule
(prevents the empty-message flash).

Lifecycle/edge analysis:

- Selection is an **index**, not a doc identity. The render clamps (`Math.min(active,
  docs.length - 1)`) so a shrunk list cannot crash or go blank. But the polled docs list can
  change while the user reads: a doc removed before the active index shifts every later doc down,
  and a doc inserted earlier re-targets the index — the panel then silently shows a different
  document than the one picked. Also, when clamping kicks in (active beyond the end), the shown
  doc's tab is not highlighted (`i === active` matches nothing). Self-heals on the next click.
  See Bugs.
- Keys by `d.name` (workspace-unique file names). Correct.
- `current` non-null assertion is safe behind the `docs.length === 0` early return.

## Functions (low-level)

### `DocsPanel({ docs, loaded })`

State: `active` index (starts 0 — the first doc, fine). Tab click sets index. Render as above.
Verdict: bug found (index-keyed selection drift), otherwise correct.

## Bugs found

1. `L12`/`L19`: the active document is tracked by list index, so a change in the polled docs list
   re-targets the selection. Scenario: the user opens TODO.md (index 1) while the agent's run
   deletes its finished PLAN doc (index 0); on the next poll the panel silently switches to
   whatever now sits at index 1 (or clamps to the last doc with no tab highlighted, since
   `i === active` no longer matches). The SPEC's model is that the user picks a *document*
   ("picked from a row of buttons naming each document"), not a position. Severity: minor (stale/
   wrong UI selection; recovers on click). Confidence: low-medium (requires the doc set to change
   mid-view, which agents do as plans complete). Fix sketch: key the selection by doc name
   (`useState<string | null>`), resolve `current = docs.find(d => d.name === active) ?? docs[0]`,
   and highlight by name.
