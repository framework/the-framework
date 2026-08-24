Effort: 3
Uncertainty: 4

# [Plan] Continue planning: resume the agent that made a plan

Concrete plan for a framework-written `## Agent` section on `.plan.md` files plus a "Resume agent" button on the plan page — the main open choice is who writes the section (the daemon at the session's end, recommended, vs the agent itself via `CLAUDE_CODE_SESSION_ID`).

## TLDR

Almost every ingredient already exists; the feature is wiring, not machinery:

- **The CLI resume one-liner is already built and shipped**: `buildResumeCommand` (`dashboard/lib/resume-command.ts`, #1195) renders `mkdir -p <workspace> && cd <workspace> && claude --resume <sessionId>` — exactly what the ticket wants recorded — and `AgentActionsMenu` already ships it as "Copy resume command".
- **The daemon already knows every handle**: drivers announce the session id on the first stream line (#1322, `DriverEvent {type:'session'}`) and the cloud driver reports the real web URL (#1317, `sessionLink: session.url`, `driver/cloud.ts:359`) — it even prints the local continuation command already: `` claude --teleport <sessionId> `` (`cloud.ts:345`). `SessionInfo` (`agent-view.ts:109`) folds `driver`/`sessionId`/`sessionLink`/`workspace`; `meta.host` names the machine. The tf-data archive (`agents/<user>/<id>.json`, #1582) keeps all of it after the agent is gone.
- **The daemon partly knows which plan a session is writing**: `pinnedPlanJob` (`auto-pm.ts`) mints `tickets/<stem>.lock.md` with `CLAIMED: <agentId>` and names `tickets/<stem>.plan.md` in the prompt; queue entries read "Create tickets/<TICKET>.plan.md" (`ticketFromQueueEntry`, `tickets.ts:75`). But the everyday single-ticket "Create a plan" button does *not* record the link today: `TicketsPanel.startPlan` (`TicketsPanel.tsx:309`) passes no `ticket:` option (unlike `startWork` right below it), and the `ticketForStart` inference (`dashboard-rpc/control.ts:194` → `ticketForPrompt`) only covers queue-drain prompts — a one-line fix this feature needs anyway.
- **The gap is real and known**: the `.lock.md` is the only "who is touching this ticket" record and it is deliberately deleted in the same commit as the finished plan (`auto-pm.ts:326`, `ticket-locks.SPEC.md`) — once planning lands, nothing anywhere says which session authored a `.plan.md`. The `## Agent` section is that missing durable record.
- **The daemon already writes tf-data atomically**: `withDataBranch` (`data-branch.ts:225`) — commit, rebase-retry, push — is how locks are minted and queue entries checked off today.
- **The plan page exists**: `TicketPlanPage.tsx` fetches the plan via the confined `onFileContent` and renders it; its header row is where the button goes.

So: at the end of a planning session, the daemon upserts an `## Agent` section into the plan on tf-data (CLI command, or web-session link); the tickets service parses the section back out server-side; the plan page renders a "Resume agent" button — copy-command for CLI sessions, open-link for web sessions — with a tooltip that says what will happen and where it works.

The one non-obvious fact feeding the alternatives: the agent *can* know its own CLI session id — Claude Code exports `CLAUDE_CODE_SESSION_ID` into the agent's shell (verified in a live session, CC 2.1.241) — so a prompt-only "agent writes the section itself" variant is genuinely on the table (see Problem 1).

## Problems

1. **Who writes the `## Agent` section — uncertainty 5.** The agent writes the plan and pushes it to tf-data itself, but the *reliable* record of its handles lives in the daemon (`<SESSION_ID>` in `ticketing_format.md` is never substituted — agents improvise it today, e.g. from the branch name). Two viable writers with different tradeoffs; this is the fork that decides most of the diff.
2. **How the dashboard gets the handle — uncertainty 3.** Parse the section client-side out of the markdown the plan page already fetches, or parse it server-side in the tickets service. The confined read caps at `MAX_PREVIEW_LINES = 500` (`dashboard/file-read.ts:6`), so a bottom-of-file section on a long plan can be cut before a client-side parser ever sees it.
3. **Section grammar — uncertainty 2.** The ticket says the section holds "either the CLI command … or the link", but the framework owns both writer and reader, so the exact shape (prose + fenced command vs `Key: value` data lines) is a contained choice.
4. **Which sessions count as "the agent that made the plan" — uncertainty 2.** Plan-intent flows are marked at launch (auto-pm plan jobs, "Create …plan.md" queue entries, the tickets list's write-a-plan button). An *implementing* agent also carries `meta.ticket`, and a random attended chat can touch a plan too — neither should claim authorship.
5. **Staleness of the recorded handle — uncertainty 1.** A CLI command only works on the machine that ran the session (`meta.host`), Claude Code prunes transcripts (default ~30 days), and the worktree is usually gone (the command's `mkdir -p` already covers that, by design of #1195). Nothing to solve, only to be honest about in the tooltip.

## Solutions

**Problem 1 — who writes the section.**

- *(a) The daemon, at the session's end (recommended).* The teardown of every finished agent already archives it to tf-data; extend that settle path: when the agent had plan intent (see Problem 4) and `tickets/<stem>.plan.md` exists on the data branch, upsert the `## Agent` section in the same `withDataBranch` cycle that archives the session. The daemon uses `SessionInfo` + `meta.host`, so the record is the *latest* session id (multi-leg sessions: "the latest `session` event wins", `agent-view.ts:124`), works for every driver, and needs no prompt change. One writer, deterministic content, testable in node.
- *(b) The agent itself, via prompt (the pure quick-win: zero daemon code).* Extend `ticketing_format.md`: "when writing a `.plan.md`, record how to resume you under `## Agent`: on a CLI session, `$CLAUDE_CODE_SESSION_ID` + `pwd`; on a web session, your session URL." Verified: the env var reaches the agent's shell, and cloud sessions see their own `https://claude.ai/code/session_…` URL (it rides the commit-trailer instruction in their system prompt). Costs: depends on an undocumented env var and on model compliance (a forgetful agent = silently missing section), is Claude-Code-specific by construction, and records the id of the *plan-writing leg* rather than the session's last leg. Fine as an MVP or as a fallback for plans written outside the daemon's flows; not the primary mechanism.
- *(c) No section at all — dashboard-only correlation via `meta.ticket` + archives.* Rejected: the ticket prescribes the section, and it is what makes the handle readable outside the dashboard (tf-data on GitHub) and on machines that never ran the agent.

**Problem 2 — how the dashboard gets the handle.**

- *(a) Server-side (recommended).* The tickets service (`src/dashboard/tickets.ts`) already reads each plan's text for `planMeta` (Effort/Uncertainty); parse the `## Agent` section there too and ride the result on `WorkspaceTicket` (e.g. `planAgent?: { kind: 'cli' | 'web', command?, link?, host? }`). `TicketPlanPage` fetches the ticket row (`onTicket` exists) beside the plan text. No truncation hazard, validation lives in node with tests, and the tickets list can reuse the field later.
- *(b) Client-side parse of `plan.text`.* Smaller diff (no RPC change) but inherits the 500-line cap (silent button loss on long plans — the section sits at the file's end) and moves handle validation into the browser. Rejected for the cap alone; revisit only if (a) turns out awkward.

**Problem 3 — section grammar.** Recommended shape — human-first (the ticket's own words: the command, or the link), one fixed grammar the server parses back, writer + parser + tests in one module:

````md
## Agent

Resume the session that wrote this plan (works on `rom-thinkpad-x280`):

```sh
mkdir -p /home/rom/…/worktrees/<id> && cd /home/rom/…/worktrees/<id> && claude --resume 86f72803-…
```
````

and for a web session (mirroring the pair the cloud driver already reports, `cloud.ts:345`):

````md
## Agent

Continue with the [Claude Code Web session](https://claude.ai/code/session_01ABC…) that wrote this plan, or pull it into a terminal:

```sh
claude --teleport session_01ABC…
```
````

The parser accepts exactly: a fenced block whose content matches the `claude --resume <uuid>` / `claude --teleport <id>` command shapes, or a link whose URL starts with `https://claude.ai/code/`. Anything else → no handle (button hidden), so a hand-edited or malicious plan can only *lose* the button, never repoint it at an arbitrary command or URL — the button never executes anything anyway (copy / open-link only). Alternative `Key: value` data lines (Driver/Host/Workspace/Session) are more machine-stable but make the GitHub reader assemble the command themselves; rejected since the framework owns both ends of the grammar.

**Problem 4 — which sessions count.** Mark plan intent at launch, don't infer at settle: auto-pm's `pinnedPlanJob` (has `ticket` + `claim` already), pinned drain jobs whose entry text names `…plan.md`, and the dashboard's `planTicketPrompt` starts — which requires the one-line `TicketsPanel.startPlan` fix from the TLDR (pass the ticket like `startWork` does). Carry it as one meta field (e.g. `planFor: 'tickets/<stem>.md'`) beside `meta.ticket`. Implementing agents and free-form chats never set it, so they never rewrite authorship. Repeat planning: replace the whole section — latest session wins, matching "the plan file is revised over time" (`ticketing_format.md` notes); no author history inside the plan (the tf-data git log has it).

**Problem 5 — staleness.** Record `meta.host` in the section ("works on `<host>`") and say it in the tooltip. Do not try to verify resumability (transcript GC, other machine) — the button is an offer, not a guarantee.

## Considerations

- **Button behavior per kind**: web → plain link (`target="_blank"`); CLI → copy-to-clipboard with "Copied" feedback, exactly the `AgentActionsMenu.copyResume` pattern. Tooltip (there is a `ui/tooltip` component): CLI — "Copies a command that reopens this planning session in your terminal — run it on `<host>`."; web — "Opens the Claude Code Web session that wrote this plan.".
- **Upgrade path (not v1)**: when the authoring agent still exists in *this* daemon's store (`meta.ticket`/`planFor` match), "Resume agent" can instead navigate to the agent page, where chat already continues the same conversation (#714/#762) — the richest resume. v1 sticks to the section's handle, which also covers the cross-machine and long-gone cases.
- **`buildResumeCommand` moves** from `dashboard/lib/resume-command.ts` into `src/` (shared by the daemon writer and any dashboard consumer; the dashboard already imports from `../../src/index.js`).
- **"Resume" means different things per driver, and that's fine**: a CLI session resumes in a terminal (`claude --resume`); a cloud session is *not* daemon-resumable (`CloudSession` never reads `resumeSessionId` — view the URL, or `claude --teleport` it into a terminal); a `github-actions` run's workspace dies with its runner. The section records whatever handle exists: command, link, or nothing (fake, codex — `codex resume` exists but is out of the ticket's scope). No section → no button.
- **Post-hoc patching has precedent**: `patchArchivedAgent` (`agent-store.ts:1197`) already updates an archived agent's facts after its process is gone (branch/PR); the section upsert is the same move aimed at a markdown file, through `withDataBranch` like `ticket-locks.ts`.
- **Plan exists but session still running**: the section lands at settle, so a freshly pushed plan briefly shows no button. Acceptable for v1; the live-agent upgrade above is the eventual answer.
- **Failure isolation**: the upsert must never block teardown/archive — a failed section write is a logged wart, not a failed agent.
- **Cross-machine reality**: a CLI command recorded on machine A is dead weight on machine B (the tooltip's `<host>` note is the mitigation); web links work everywhere but only for viewers with access to that claude.ai session (same account/org).
- **`ticketing_format.md` + its SPEC** must document the section (agents revising a plan must preserve it; agents should not invent one — under option (a) the framework writes it). Per repo rules, read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md before touching any SPEC.md.
- **FEATURES-SPEC.md** gains the feature (plan page: resume the planning agent; plans record their author's session) — feature additions need human approval, which the imported GitHub issue (#1511) constitutes.
- **Idempotence**: upsert = replace-or-append of exactly the `## Agent` heading's block; reopened agents that settle again simply refresh it.

## Implementation

1. **Shared resume-handle module** (`src/resume-handle.ts` or beside `session-link.ts`): move `buildResumeCommand` out of `dashboard/lib`; add `renderAgentSection(info, host)` and `parseAgentSection(md)` with the grammar above + tests (`.test.ts` + `.SPEC.md` siblings, house style).
2. **Plan intent at launch**: `planFor` on agent meta, set by `pinnedPlanJob`, plan-shaped pinned drain entries, and `planTicketPrompt` starts.
3. **Daemon upsert at settle**: in the teardown that already archives every finished agent onto the data branch (`daemon-runtime.ts` → `archiveWorktreeAgent`, `agents/<user>/<id>.json`), when `planFor` is set and the plan file exists on tf-data, `withDataBranch`-upsert the `## Agent` section (commit message in the existing `[The Framework] …` voice). Never fails the teardown.
4. **Server parse**: `src/dashboard/tickets.ts` extracts the handle into `WorkspaceTicket.planAgent`; extend its tests.
5. **Plan page button**: `TicketPlanPage.tsx` fetches the ticket row, renders "Resume agent" (copy or link + tooltip) in the header row; `TicketPlanPage.test.tsx` covers both kinds and the no-section case.
6. **Docs**: `ticketing_format.md` (regenerated into every agent's system channel via `scripts/gen-prompts.mjs` → `CONTEXT_FORMATS`, `system-prompt.ts:93/229`) + its SPEC; `TicketPlanPage.SPEC.md`; the moved `resume-command` SPEC (`AgentActionsMenu.SPEC.md`'s "take the conversation to a terminal" section is the prose precedent); `FEATURES-SPEC.md` (sibling bullet to "A plan page when a plan exists…"). Read the SDD doc (repo rule) before touching any SPEC.
7. **Out of scope, noted for later**: navigate-to-live-agent upgrade; codex resume; agent-self-written sections for plans authored outside the framework's flows.
