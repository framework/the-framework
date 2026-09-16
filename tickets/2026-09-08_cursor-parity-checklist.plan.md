Effort: 3
Uncertainty: 8

# [Plan] Cursor parity checklist: what the framework covers, what is missing, what is skipped on purpose

A spike: what changed in the checklist since 2026-09-08, and what a person must decide before any gap is built.

## TLDR

This ticket builds nothing. It is a list, and a list of decisions that belong to people ("which of the four missing items are in, and whether any skipped row should not be"). Nobody has answered on #1764 (0 comments). So no agent should start any gap from this ticket. The work an agent can do is to keep the table true and to split each gap a person approves into its own ticket.

The table is already out of date in three places (checked on main 9bb62321):

- **Start an agent from a terminal** is now covered. `agent-scheduler run <prompt> [--model <id>]` runs one prompt in its own checkout, right away, and records the run (`packages/agent-scheduler/src/cli.ts:16`). Gap 2 of the proposed order is done.
- **The yardstick file is gone.** The issue scores the features against FEATURES-SPEC.md, and the repository has no such file anymore. AGENTS.md still names it. The table must point at something that exists: the README, `LOGIC.md`, or the skills list.
- **Routines and background agents moved.** Routines are now command skills (`.claude/skills/{work-queue,update-tickets,plan-tickets,triage-quick,triage-consensual}`) started by `agent-scheduler` from `agent-schedule.md`. The daemon starts no agent on its own (#1782, #1785). "The queue drain; routines" should say "agent-scheduler + agent-schedule.md". It is still covered.

## Problems

- **Scope (uncertainty 9).** Which missing items are in is a product call, and it has no answer yet. Linear and the marketplace wait on the catalogue and distribution design, which Rom owns.
- **Code review before merge (uncertainty 6).** "A skill" fits the architecture: a command skill, one package per command, that knows no other skill. But there are real alternatives:
  (a) a `review-prs` command skill with a `when` line in `agent-schedule.md` (for example `gh pr list --search "review:none"`), so the scheduler starts it;
  (b) an open-PR hook, which the dashboard's hooks (#1784) do not have (they fire on project open and close);
  (c) a GitHub Actions job that runs the harness's own review.
  (a) needs no new mechanism. Where the review goes is also open: a PR comment, or a blocking review status.
- **MCP as a user feature (uncertainty 8).** `packages/mcp*` and `ai-mcp` exist. What a user should see is undecided.
- **Mobile, Slack, image as context (uncertainty 3-4 each).** Each one is small and has an obvious cheap version (a responsive dashboard, a Slack webhook beside Discord in `daemon-services.ts`, an upload in the composer). But the dashboard is headed toward "a projection of files", and the daemon may go away (Rom, 09-14). Dashboard work may be thrown away.

## Solutions

- For each row that changed, update the table on #1764 as a comment or an edit. A person posts it: GitHub text follows Rom's marker rules.
- Once a person picks the in-scope items, add one ticket per gap (`npx tickets put`) and queue each one at its own priority. Do not queue them from this plan.
- The shortcut for code review, if approved: option (a). It uses only what exists today (a command skill plus one line in `agent-schedule.md`).

## Considerations

- AGENTS.md still says "Every user-facing feature is listed at FEATURES-SPEC.md", and the file is gone. Fixing that line is a separate small ticket, and whoever picks the new yardstick decides it.
- The list of what Cursor lacks gains two items: the scheduler's spend boundary and offset (`agent-scheduler offset`), and keep-alive in a repository file.
- The "Multi-model, subagents" row: a model per run now also exists as `agent-scheduler model <id>` for scheduled runs.
- Do not re-score rows that were skipped on purpose (editor, design, deep search, checkpoints) without a person asking. That is the second decision the issue wants.

## Implementation

1. A person answers the two decisions on #1764.
2. An agent re-scores the table against the chosen yardstick, starting with the three rows above, and drafts the update for a person to post.
3. For each approved gap: one ticket, in the proposed order minus gap 2 (done). Code review comes first.
4. Close this ticket when the per-gap tickets exist, or when #1764 is closed.
