# Analysis result — `triage-quick`

## Prompt analysis

- **Ambiguous prompt: NO.** The ask is explicit — read every ticket, keep only the ones that are quick wins *and* consensual (zero open questions, zero variability, one obvious plan), write them to `TODO_AGENTS.md`. No interpretation gate needed.
- **Scope: SMALL.** Triage of 51 ticket files plus one file written. No `PLAN_triage-quick.agent.md`.
- **Variability: none worth a choice gate.**
  - *Which tickets qualify* — rating 8/10: the user supplied the bar; each candidate was then checked against the actual code rather than judged from the ticket text.
  - *How to write `TODO_AGENTS.md`* — rating 10/10: the repo already has one writer (`insertTodoEntry`, `sendQueueTicket`, `todoPriorityForTicket`). Matching it is the only sensible option.

## Method

All 51 tickets under `tickets/` were read. Every candidate that survived the read was then verified against the code, and its GitHub issue state was checked, before being queued.

## Selected — 4 tickets

Priority numbers follow the framework's own `todoPriorityForTicket()` mapping (urgent 9, high 7, medium/unset 5, low 2), so the queue sorts the way the dashboard and the drain loop expect.

| # | Ticket | Prio | Verified |
|---|---|---|---|
| 1149 | Improve tooltip *(scoped, see below)* | 7 | `ProjectActions.tsx:11` and `PreviewBar.tsx:75` both set `delay={300}`; ~16 interactive elements still carry a native `title=` |
| 1169 | `Import tickets from GitHub` redirects to the wrong page | 5 | `OnboardingChecklist.tsx:94` calls `onSelectProject(projectId)`; `TicketsPanel.tsx:71` already does it right via `onRunStarted(intent, runId)` |
| 1143 | Cannot select Fable | 2 | `Composer.tsx:46-51` lists Default/Opus/Sonnet/Haiku only; `claude --help` confirms `fable` is a valid `--model` alias |
| 947 | readZip/ZipEntry leak onto the public API | 2 | `driver/index.ts:28` re-exports both; the only real callers (`actions.ts`, `actions-zip.test.ts`) import the module directly |

### #1149 is deliberately scoped

Only the two OP items are queued — kill the tooltip delay, and use the custom tooltip everywhere instead of the browser's. Those are directives with no alternatives attached. The thread's follow-ups (auto-show the dropdown on hover, redesign the settings row, make `Autopilot`/`Open PR` read as labels) are design calls and stay out. The ticket therefore stays open after this entry is worked.

### #947 rests on a stale premise

The ticket says the removal is free because nothing has shipped to npm. It has: `@gemstack/the-framework` is published, latest `1.3.0` on 2026-07-24, and the barrel line predates it. The ticket's own branch covers this — "if #746 ships before step 2, removal moves to the next major" — so the queued entry is step 1 only (mark both `@internal`).

## Rejected — and why

**Already fixed; these three ticket files are stale** (the import ran against issues that had just been closed):

- **#1163** `TODO_AGENTS.md` doesn't respect `todo_format.md` — closed by 4dc9c40.
- **#1162** `ticketing_format.md` not respected — closed. Verified: all 51 filenames match `<DATE>_<SLUG>[.spike|.plan].md`, and every body carries `# title` + `## TLDR` + `## Why it matters`.
- **#1165** re-home test loses the bind under load — closed by a9c86ba.

**Carries an open question** (the ticket itself names two or more ways to go):

- #1145 "What is Log?" — clarify, rename, *or* remove.
- #1138 "What is Spend what's left on the roadmap?" — "Let's remove it? Maybe #960 supersedes it?"
- #1140 removing/renaming a directory — drop the entry, mark it gone, or re-point?
- #1039 `metaFromEvents` — persist per-event timestamps, or document the anchoring.
- #945 Discord single live run — module comment, or let the bot target runs.
- #1117 record the ticket a run starts from — queue item carries the slug, or a dedicated entry point.
- #1151 global store — the headline question is live (maintainer replied with a pointer).
- #1139 improve dashboard — one clean item (drop the tagline) sits beside "we should probably re-haul this whole view".

**Not a quick win**:

- #1150 improve "Add project" — a browser cannot hand back an absolute directory path from a system picker; real technical uncertainty.
- #1142 `Files` missing — root cause unknown, suspected to hang off #1140.
- #1144 tickets as a whole page — layout rework.
- #460 Vike error — the fix is upstream and the plugin author's call.
- #1159 routine work — the ticket asks to postpone it.

**Large / deferred by their own text**: the epics (#605, #606, #607, #806), the roadmap (#538), the system prompt (#326), topics (#1115, #1124, #1129), the design-only skill tickets (#11, #12, #13), and the rest of the long-horizon set.
