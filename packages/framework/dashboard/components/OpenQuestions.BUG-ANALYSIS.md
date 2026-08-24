# Bug analysis: packages/framework/dashboard/components/OpenQuestions.tsx

## Business logic (high-level)

The open-questions hub (#1455 item 4, the launcher's main event): polls `onOpenQuestions` (5s)
for every live agent's pending gate across all projects (server-sorted longest-waiting first),
renders one card per gate in one scroll area (no pagination), each with the asking agent's
identity (session name → intent first line → id), project, and an "Open session →" jump; a
sticky jump-nav appears beside the cards once there is more than one. Countdown/autopilot is
disabled per card (`countdown={false}` — a hub rendering every gate must not mass-auto-accept).
A bridge-carried question posts through `bridgeSend(sessionId)` instead of the control channel.
Answered gates collapse in place to the shared `AnsweredChoice` line and persist per-mount in
the `answered` Map — surviving the poll dropping the gate (appended at the end once dropped),
per the "does not vanish under the cursor" story. Nothing waiting and nothing answered → no
section at all.

Verified against the SPEC:

- Empty → `null` (also while `!loaded`). Correct.
- Count = open rows only. Correct (but see Bugs #1 for when it lies).
- Collapse memory per-mount, reload starts clean. Correct.
- Poll-lag grace: an answered gate the poll still returns renders collapsed *in place* (the
  `rows.map` branch), leftovers append after. Correct mechanics.
- Jump-nav: >1 rows, ✓-ticked and dimmed answered entries, `scrollIntoView` on click, refs
  cleaned up via the callback-ref delete branch. Correct.
- Bridge questions: same card, different delivery. Correct.

The defect found is in the identity the answered memory is keyed on — see Bugs.

## Functions (low-level)

- `EMPTY_QUESTIONS`: stable initial. Correct.
- `keyOf(q)`: `projectId + ' ' + agentId + ' ' + choice.id` (ids contain no spaces — project ids
  are slug+hash, agent ids timestamps, gate ids framework-fixed slugs — so no collision from the
  separator). Its comment claims "a re-fired gate is a fresh card": false for same-id re-fires —
  see Bugs #1.
- `OpenQuestions({onOpenAgent})`: poll, `answered` state, `cardRefs`; `rows` = polled questions
  (annotated answered when remembered) + remembered leftovers; `openCount`; `jumpTo`. Rendering:
  answered → `AnsweredChoice` with meta + footer link; open → header button (title tooltip
  "Open this session") + `ChoicePanel` with `countdown={false}`, `onAnswered` storing
  `{question, pick}` under the key, and the bridge `send` override. Correct except Bugs #1.
- `agentLabel(q)`: `sessionName ?? intent-first-line(≤80) ?? agentId`. The server only sets
  `intent` when truthy, so the `''`-first-line edge (intent starting with a newline) is the only
  way to an empty label — vanishingly rare, noted only.

## Bugs found

1. `L15` (`keyOf`) with `L49-56`/`L117`: the answered memory masks a *re-fired* gate that reuses
   its id. Gate ids are framework-fixed and repeat across exchanges within one agent: every
   `runAwaitRounds` invocation restarts its round counter, so the first ask of every turn/backlog
   item is `await-choices` (`src/await-gate.ts` L47 — only re-asks *within* one exchange get
   unique ids `await-choices-<round>`). Scenario: the user launches the backlog loop and stays on
   the launcher (the hub is designed as the surface to sweep questions from); during item 1 the
   agent asks something → gate `await-choices`, answered from the hub → key
   `p run await-choices` stored; during item 2 (a fresh `runAwaitRounds`, todo-loop.ts L390) the
   agent asks a *different* question, again as gate `await-choices`; the daemon reports it open,
   but `rows.map` finds the key in `answered` and renders the new question as the *collapsed
   AnsweredChoice showing the old pick*, excluded from the "Waiting on you" count — the parked
   agent's question is invisible in the hub and the count lies. Contradicts intent three ways:
   the SPEC's "A gate that fires again is a fresh card, since it is a different question being
   asked", `keyOf`'s own comment, and `await-gate.SPEC.md`'s stated reason for unique re-ask ids
   ("otherwise the dashboard cannot tell a fresh question from the one it just answered" — which
   holds only within an exchange). Severity: major (a waiting agent hidden behind a wrong
   "answered" line on the surface built for unblocking agents; bounded by the memory being
   per-mount). Confidence: medium. Fix sketch: give the memory a firing identity — e.g. store
   the answered `question.choice` and treat a polled gate as answered only while its
   `choice` deep-equals the remembered one (a re-fired gate carries a different title/options),
   or have the server stamp each firing (event index / firedAt) into `OpenQuestion` and fold it
   into `keyOf`.
