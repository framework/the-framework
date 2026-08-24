# Bug analysis: packages/framework/dashboard/components/EventList.test.tsx

## Business logic (high-level)

Pins the behaviours `EventList.test.SPEC.md` lists: conversation rows (YOU/AGENT badges, inline
prompt text, Markdown replies, long-message collapse, tail inside the scroller), colour meaning
(red failures incl. agent-reported `error`, stopped/finished not red, blue own turn, badge tints,
semantics beating the kind map, washes), prompt hoisting (first hoisted, later stays, no-prompt log
untouched), inline gates (answerable with project, plain without, resolved collapses + hides the
"chose" line + no longer answerable, expand shows the pick, `end`-closed stays text, only the
latest firing of a re-fired gate interactive), inline browser rows (latest hosts the pane, earlier
one-liners, re-said URL replaces, post-`end` degrade, plain without `agentId`, primary badge).

Test hygiene: `sendChoice` and preferences are mocked before the dynamic `await import`, so the
inline ChoicePanel never reaches a daemon; `sendChoice` reset per test; `cleanup` in `afterEach`.
All renders pass `stick={false}` so the scroller renders static — no async settling needed, and no
un-awaited work. `fireEvent.click` on the pick posts through ChoicePanel synchronously and the
assertion checks the mock's arguments, not UI aftermath, so no missing `await`.

Do the tests verify what they claim? Spot-checks:

- "long message collapses": `'word '.repeat(40)` → collapsed length 199 > 100, so the Expand
  control genuinely appears; the short-message twin asserts its absence. Both can fail.
- "resolved gate ... no longer answerable" asserts the AnsweredChoice trigger is `aria-expanded=
  "false"` and that no `region` named by the title exists — matches AnsweredChoice/ChoicePanel
  roles.
- "only the latest firing ... interactive" asserts exactly one "Work on it" text node: the earlier
  firing renders formatter text (which shows the title, not option labels), so the count is a real
  discriminator.
- Browser tests distinguish the live one-liner (`browser: URL`, formatter) from the degraded pane
  one-liner (`browser · URL`, InlineBrowser) — consistent with the two components' actual output.
- Wash tests query `[class*="bg-info/10"]` etc. on the container — matches the literal classes in
  `rowWash`.

Coverage gaps (not bugs, noted): no test for the arrival-time column (needs `stampReceived`), for
`openAt`, for the multi-open-gate `active` selection, or for row identity across live re-renders —
the index-key defect found in `EventList.tsx` is exactly in this untested seam.

## Functions (low-level)

- `sendChoice` hoisted mock + `vi.mock('../rpc/control.js')` / `('../lib/preferences.js')`: correct
  hoisting pattern with `vi.hoisted`; `usePreferences: () => ({})` satisfies ChoicePanel. Correct.
- `gate(id)` / `resolved(id)` builders: minimal valid `choice` / `choice-resolved` events with a
  recommended pick. Correct.
- `rowText()`: reads `[data-message-id]` nodes in document order — a faithful proxy for row order
  (message-scroller stamps that attribute). Correct.
- Each `test` body: assertions are all reachable-and-falsifiable; `getByText('you')` relies on the
  badge being CSS-uppercased (`text` stays lowercase in the DOM) — true of `Badge` usage. Correct.
- `cleanup()` mid-test before a second `render` (badge tones, wash): keeps `getByText` unambiguous.
  Correct.

## Bugs found

None found.
