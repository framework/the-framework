# Bug analysis: packages/framework/src/dashboard/activity-discord.test.ts

## Business logic (high-level)

Pins the Discord delivery half of the activity feed (`postActivityDiscord`) via an injected
`fetchImpl`: a started run's message names project and title; a failed run is marked distinctly
from a done one; several items collapse into one counted summary; an empty list makes no call at
all. Matches `activity-discord.test.SPEC.md` one-for-one.

Verification quality:

- Every fake fetch parses the actual JSON body the transport builds, so the assertions run against
  the wire shape (`{ content }`), not an internal. A regression in `postDiscordWebhook`'s body
  construction would fail here.
- "posts a started run with its project and title" — regexes for `gemstack`, `started`,
  `add cart` on the single message. Sound (format-flexible on purpose).
- "marks a failed run distinctly from a done one" — two sequential posts, asserts ✅ then ❌.
  Distinctness is genuinely asserted (different markers on the two contents). The ⏹️ stopped
  marker is uncovered — gap, not a wrong assertion.
- "summarizes multiple items and skips the call when there are none" — asserts the counted header
  (`2 session updates`) and that the empty call adds no second POST (`calls.length` still 1).
  Both falsifiable. The per-item `• project: line` rows of the summary are not asserted — minor
  gap.
- Return-value contract (`true` on 204 / `false` on failure) is untested here; it is the
  transport's behavior (`discord-webhook.ts`) and tested at that layer's own suite if any — not
  this file's claim.
- The fakes return `new Response(null, { status: 204 })`, matching Discord's real webhook
  success, so `res.ok` is exercised truthfully.

## Functions (low-level)

- `started(agentId, project, title?)` / `finished(agentId, status, project, title?)` — fixture
  factories building exactly the `Activity` shape, with conditional title spread so absent stays
  absent. Fine.
- Three `test()` blocks as above; all awaited; assertions falsifiable; the `contents[0]!`/
  `calls[0]!` non-null assertions are safe given the pushes above them.

## Bugs found

None found.
