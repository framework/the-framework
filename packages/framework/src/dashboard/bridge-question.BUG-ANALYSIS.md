# Bug analysis: packages/framework/src/dashboard/bridge-question.ts

## Business logic (high-level)

The wire shape of a question a *cloud* (claude.ai) session is parked on, as the Chrome-extension
half of the browser bridge reports it (#1237), plus the one projection that turns it into the
`ChoiceRequest` the dashboard's `ChoicePanel` already renders for local gates (#1554). Two
responsibilities only: types, and a pure mapping. No I/O, no state.

The load-bearing constraint is stated in the header comment and is real: this module is imported by
`client.ts` (`export { bridgeChoiceRequest }`) and therefore ships to the browser, so it must not
pull in anything Node-only. The alternative homes for the projection — `bridge-endpoints.ts`
(node:http) and `bridge-store.ts` (node:crypto) — would have dragged those in. Splitting the two
type declarations out of `bridge-endpoints.ts` (which re-exports them, L5) and keeping the
projection beside them is what keeps the client bundle Node-free. Checked: the only import here is
`import type { ChoiceRequest }`, a type-only import that erases at compile time, and `events.ts`'s
value exports are not pulled in.

Invariants the module depends on but does not itself enforce — all of them are enforced upstream in
`bridge-endpoints.ts`'s `validate()` (L212-L255), which is the *only* way a `BridgeQuestion` enters
the system (`POST /_bridge/question` → `validate` → `handlers.record` → `BridgeStore`):

- **Labels are unique** — `validate` rejects `'option labels must be distinct'` (L235). This is what
  makes "label as option id" safe: without it the projection would emit a `ChoiceRequest` with two
  options sharing an `id`, which would make the panel's checked-set (a `Set` of ids) and the
  answer-side label lookup ambiguous. The reliance is total and unguarded here; it is sound only
  because there is no second producer.
- **Labels are non-empty and ≤ `MAX_LABEL`** (L225), so no option gets `id: ''`.
- **`recommended`, when present, names one of the option labels** (L243-L246, with the comment "A
  recommendation that names no option would render a default the user cannot see"). This is the
  other half of the label-as-id contract: `ChoicePanel` compares `o.id === choice.recommended`
  (ChoicePanel.tsx L160/L167), which only lights up because ids *are* labels on this path.
- **`options` is non-empty** (L219), so `ChoicePanel`'s `choice.options[0]?.id` fallback for a
  question without a `recommended` always resolves to a real id rather than `''`.
- **`receivedAt` is stamped by the daemon**, never by the caller — `validate` overwrites it with
  `now.toISOString()` and never reads a caller-supplied one. The JSDoc on the field says exactly
  this, and the SPEC lists it as its own bullet. Verified: `raw.receivedAt` is never read.

Lifecycle: the extension observes an `await-choices` block on a claude.ai page → posts it → the
daemon validates and stores it keyed by session id (one live question per session,
`bridge-store.ts` `bySession`) → `open-questions.ts` joins it to the `web`-target agent whose
`AgentMeta.sessionId` matches (L121-L133) and projects it through `bridgeChoiceRequest` → the
answer comes back keyed by `question.bridge.sessionId` (OpenQuestions.tsx L119), *not* by the
projected `ChoiceRequest.id`. That last point is worth stating because it is what makes the
synthetic `bridge:<sessionId>` id harmless: nothing ever parses it back.

## Functions (low-level)

### `interface BridgeOption`

`label` (required) / `detail?` / `default?` / `stop?`. Each field has a consumer:

- `label` — the answer text the extension types back into the page, and the option id after
  projection.
- `detail` — one-line subtitle, projected straight through.
- `default` — "starts checked, on a `multi` question". `ChoicePanel` reads it only when
  `choice.multi` (L65: `choice.multi ? choice.options.filter(o => o.default)… : new Set()`), which
  matches the doc comment and `ChoiceOption.default`'s own "Ignored for single-select".
- `stop` — deliberately *not* projected (see below). Its only consumer is server-side:
  `bridge-store.ts` L186 picks `takeoverPrompt` over `continuationPrompt` when any picked option
  carries it, resolving the pick against the *stored* question, not the projected one. So the field
  is complete for its actual reader.

Verdict: correct.

### `interface BridgeQuestion`

`sessionId` / `title` / `options` / `recommended?` / `multi?` / `receivedAt`. Mirrors the page's
`await-choices` block, keyed by label. `sessionId` is the join key to `AgentMeta.sessionId` — used
that way in `open-questions.ts` L124 and in `reads.ts`'s `onBridgeQuestion`. `receivedAt` is an ISO
string used as the card's `updatedAt` (so the list sorts by "parked since the bridge saw it", not by
hand-off time — that choice is commented at the call site). Verdict: correct.

### `bridgeChoiceRequest(question: BridgeQuestion): ChoiceRequest` (L40-L53)

Pure, total, allocation-only. Edge cases walked:

- **`id`** — `bridge:${sessionId}`. Uniqueness: the store holds at most one live question per
  session, and `open-questions.ts` claims each session id once (`claimed` set, L123-L125), so two
  cards can never carry the same synthetic id in one render. Never parsed back anywhere (grepped:
  the only other occurrence of the literal `bridge:` is the expectation in
  `open-questions.test.ts` L144), so the prefix is cosmetic/namespacing and cannot collide with a
  real agent choice id. Correct.
- **`options.map`** — label used for both `id` and `label`. Empty options array would produce an
  empty `options`, which `ChoiceRequest` documents as "at least one"; unreachable because `validate`
  rejects it. Duplicate labels would produce duplicate ids; unreachable for the same reason. Both
  reliances are on a validator in another module, noted rather than reported.
- **Conditional spreads** — `detail` is included only when truthy (an empty-string detail is already
  stripped by `validate`, so this is belt-and-braces, not a behaviour difference); `default: true`
  only when truthy, so `default: false` never travels (matching `bridge-endpoints.test.ts` L70's
  "false flags do not"); same for `recommended` and `multi`. The result is a minimal object, which
  matters because `open-questions.test.ts` deep-equals the whole card.
- **`default` on a single-select** — projected even when `multi` is absent. Harmless: `ChoicePanel`
  ignores it outside multi (L65), exactly as `ChoiceOption.default` documents.
- **Missing `recommended` on a single-select** — `ChoiceRequest.recommended`'s JSDoc says "Required
  for a single-select", and `validate` treats it as optional, so a bridged single-select with no
  recommendation is reachable. Checked the consumer: `ChoicePanel` L99 falls back to
  `choice.options[0]?.id`, so Accept picks the first option and nothing crashes; no option renders
  with the "Recommended" badge, which is honest for a question the page did not recommend an answer
  for. Not a bug — but it *is* the one place where this module's output violates the letter of the
  `ChoiceRequest` doc, so it is worth knowing the fallback exists.
- **`stop` not projected** — structurally impossible to carry: `ChoiceOption` (events.ts L4-L13) has
  no `stop` field. The panel therefore cannot distinguish a "hand it back to me" option visually.
  Since the semantics are applied where the pick is turned into page text (`bridge-store.ts` L186)
  and the SPEC never asks for the projection to carry it, this is a deliberate omission, not a loss.
- **`autoAcceptMs` not set** — so a bridged question inherits the 10s autopilot default. Checked the
  only render path: `OpenQuestions.tsx` passes `countdown={false}` (L115), so no countdown runs on
  these cards and a cloud question is never auto-answered out from under the user. Correct.
- **Mutation/aliasing** — `options.map` builds fresh objects; the input is never mutated and the
  output shares no `options` array with it. Safe to call repeatedly on a stored question (it is:
  once per render).

Verdict: correct.

## Bugs found

None found.
