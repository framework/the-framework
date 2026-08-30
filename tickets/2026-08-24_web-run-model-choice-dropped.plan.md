Effort: 0
Uncertainty: 0
Outdated: yes

# [Plan] A model choice is silently dropped on web runs

The gap the ticket describes was closed by PR #1714 two days after the ticket was imported, along option 1 (drive the picker); nothing is left to implement, so the plan is to close the ticket.

## TLDR

The ticket was imported from GitHub issue #1697 on 2026-08-24 and traced on main `619e886e`. On 2026-08-26 commit `c3861d8f` ("A web run runs on the model it was started with (#1697) (#1714)") carried the model the whole way — `/_web-start` → the start-queue → `/_bridge/start` → the extension's `createSession` — and made the extension pick it in claude.ai's model menu before sending. Verified on `ca5aa4bf`: the chain is present at every hop, covered by tests that pass, specced, and listed in FEATURES-SPEC.md. The ticket is stale, not open work.

## What the code does today (verified on `ca5aa4bf`)

Every hop the ticket named as dropping the model now carries it:

- `agent.ts:187` hands `model` to every driver's start, `agent.ts:164` records it on the opening `session` event (so the dashboard names the model rather than "unknown", #1438).
- `driver/cloud.ts:172,208` — the cloud driver passes `this.startOpts.model` into the `/_web-start` POST body, and its notice line names the model it asked for (`cloud.ts:215`).
- `dashboard/web-start-endpoints.ts:61-66` — the route accepts `model`, rejects a non-string with 400, and forwards it to the queue.
- `dashboard/bridge-starts.ts:25,65-73` — the queued request holds `model`, trimmed; blank is dropped, longer than `MAX_START_MODEL` (100) refused.
- `dashboard/server.ts:206` — `claimNext` hands `model` out on `/_bridge/start`; `bridge-endpoints.ts:109` types it.
- `chrome-extension/background.js:393` relays it to the content script; `content.js:668-744,780,826-843` reads the model picker, opens its menu when it does not already read the wanted model, clicks the entry (exact label first, else the model's word — "opus" reads "Opus 5" — with "More models" searched for older versions), re-reads the picker, and **fails the creation naming the model** when the menu does not offer it or the page has no picker. No model in the request leaves the picker untouched.

So both directions the ticket proposed are satisfied at once: the choice is honoured (option 1), and a choice that cannot be honoured stops the run saying so rather than silently falling back to the page's default (better than option 2's note).

## Evidence it works

Run on `ca5aa4bf`:

- `npx tsx --test src/dashboard/bridge-starts.test.ts src/dashboard/web-start-endpoints.test.ts src/driver/cloud.test.ts` → 37 pass, 0 fail. Named cases: "a queued start carries the model when the run named one, trimmed; a blank one is dropped and an absurd one refused (#1697)", "the model travels to the queue when the run names one, and must be a string when it does (#1697)", "the model the run was started with travels with the request, and an unset one does not (#1697)".
- `node packages/chrome-extension/check.mjs` → all cases passed, including "create picks the requested model in the model menu before sending", "create leaves a model picker that already reads the requested model alone", "create finds an older model behind \"More models\"", "create refuses to send on a model the menu does not offer", "create names a missing model picker rather than sending on the default".
- Documented: `FEATURES-SPEC.md:180` ("A web run runs on the model chosen for it …"), `packages/chrome-extension/content.SPEC.md:28,147,151`, `bridge-starts.SPEC.md`, `bridge-endpoints.SPEC.md`.

## Implementation

1. Close the ticket: `tickets close 2026-08-24_web-run-model-choice-dropped.md`.
2. Close GitHub issue [#1697](https://github.com/framework/the-framework/issues/1697) if it is still open, pointing at `c3861d8f` / PR #1714 — the issue was the ticket's source and the ticket carries no state the issue does not.

No code change, no SPEC change, no FEATURES-SPEC change.

## Considerations

- **The one residual is fragility, not a gap.** The picker selectors come from a single live look at claude.ai on 2026-08-26 (stated in `c3861d8f`'s message and in `content.js:668-671`). If claude.ai reshapes its model menu, the failure mode is the safe one — creation fails naming the model, the run stops — not the silent drop this ticket was about. `check.mjs` pins the observed DOM, so drift shows up as a real-page failure rather than a green suite; that is a selector-maintenance concern for the extension as a whole (every chip has it), not this ticket.
- **Do not reopen this as option 2.** Adding a "web runs use claude.ai's default model" note or hiding the dashboard's model pick for web runs would now be wrong: the pick is honoured, and a run started with no model legitimately uses the account default on both the local and the web path.
