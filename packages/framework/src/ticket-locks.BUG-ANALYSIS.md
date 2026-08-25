# Bug analysis: packages/framework/src/ticket-locks.ts

## Business logic (high-level)

The `.lock.md` claim on a ticket (#1420). A ticket is assigned to one agent, and the guard has to
be a *file on the data branch* rather than daemon memory, because the cooperating parties (a
hands-off cloud session whose local process ends at hand-off, another machine's daemon, a stock
prompt that never heard of this module) share nothing else. The file is
`tickets/<STEM>.lock.md` holding `CLAIMED: <AGENT_ID>`.

Invariants and lifecycle, checked against `ticket-locks.SPEC.md`:

- **Every write goes through `withDataBranch`.** The funnel syncs, runs the op against the data
  checkout, `git add -A`, commits (message resolved *after* the op, which is why both call sites
  pass a thunk — `data-branch.ts` L242-243 confirms this), and pushes. On a lost push race it
  re-runs the whole op against the freshly synced state (one retry, `attempt >= 1` gives up).
  Both operations reset their mutable outcome variable at the top of the op body (`locked = []`
  L128, `outcome = 'released'` L197) precisely so a re-run cannot double-count — this is correct
  and is the subtle thing the design depends on.
- **An existing lock outranks the batch, except this agent's own.** L136-140: a lock naming
  `assignment.agentId` is the batch's own claim seen again after a re-run and still counts as
  locked; any other holder (or unparseable content, where `ticketLockHolder` returns `undefined`)
  means skip.
- **Phase decides how a plan is read.** `plan` batches skip a ticket that already has a
  `.plan.md` (their work is done); `drain` batches treat the plan as input and only a lock stops
  them. Matches the SPEC exactly.
- **Committed-but-unpushed still counts.** `!result.ok && !result.committed` is the only "claimed
  nothing" path; `!result.ok && result.committed` logs the cross-machine gap and keeps the claims.
  This matches `DataWriteResult`'s shape (`committed` exists only on the failure variant).
- **No timed release.** Deliberate: a coordinator can hold a ticket for days.
- **Never throws.** Both exported operations only await the funnel, which catches everything and
  returns a result object; `read`/`write`/`remove` rejections inside the op are either caught
  per-call (`.then(ok, fail)` / `.catch`) or land in the funnel's own catch, which hard-resets the
  checkout before reporting.

Concurrency notes: two assignments naming the *same* ticket in one batch are handled correctly
with the real `fs` seams, because the first iteration's `writeFile` is visible to the second
iteration's `readFile` (same directory, awaited sequentially) — the second is skipped as
"someone else's lock". `auto-pm.ts` L1002 comments that two queue entries can link the same
ticket, so this is a real case and the sequential loop is what makes it safe.

## Functions (low-level)

### `ticketLockName(ticket)` (L35)

`a.md` → `a.lock.md`; a name without `.md` gets `.lock.md` appended. The regex is anchored to the
end, so `a.md.md` → `a.md.lock.md` (only the last extension is stripped) — matches the stem rule
used in `acquireTicketLocks`. Callers pass a bare filename (`control.ts` L358 validates with
`isTicketFile`, `auto-pm.ts` L998 slices off `tickets/`), so no directory ever leaks in. Correct.

### `ticketLockContent(agentId)` (L40)

`CLAIMED: <id>\n`. An empty `agentId` would produce a claim line naming nobody, which
`ticketLockHolder` then reads as "no holder" — but agent ids are always minted non-empty
(`drain-<ts>-<i>`). Correct.

### `ticketLockHolder(md)` (L45)

Trims leading whitespace, requires the `CLAIMED:` prefix, takes the remainder of the first line and
trims it; empty → `undefined`. `split('\n', 1)[0]!` is safe (split always yields ≥1 element). A
`\r\n` file would leave a trailing `\r`, but `.trim()` removes it. Correct.

### `lockMessage(count)` / `releaseMessage(ticket)` / `abandonedReleaseMessage(ticket)` (L53-65)

Commit subjects; `lockMessage` pluralizes on 1. Correct.

### `acquireTicketLocks(cwd, assignments, deps, phase)` (L105)

Inputs: assignments (`{ticket, agentId}`), a phase, injectable seams. Output: the subset locked.

- Default `write` creates parent directories first — needed because retiring the last ticket
  removes `tickets/` and the data branch is born without it. Correct and explicitly reasoned.
- Empty `assignments`: the op writes nothing, `staged` is empty, the funnel returns
  `ok: true, changed: false`, and `[]` is returned. If the funnel fails before committing, the
  error is logged even for an empty batch — deliberate per the SPEC ("no claims" must be
  distinguishable from "lost every race").
- The lock/plan probes use `read(...).then(ok, fail)` so a *missing* file and a *permission* error
  are indistinguishable — an unreadable existing lock would be treated as absent and overwritten.
  On a git checkout this cannot happen; noted as a reliance.
- `locked` is captured by the message thunk and read after the op, so the commit subject names the
  count this cycle actually locked. Correct.
- Verdict: correct.

### `releaseTicketLock(cwd, ticket, deps, opts)` (L172)

- The lock path is rebuilt from `ticketLockName(ticket)`, consistent with the acquire path.
- `heldBy` guard (#1583): only frees a lock still naming that agent; anyone else → `not-holder`,
  and (crucially) the op returns *before* removing, so nothing is staged and the funnel commits
  nothing.
- `no-lock` when the read rejects. Same read-error ambiguity as above.
- Default `remove` is `rm(path)` without `force`, but it only runs after a successful read of the
  same path in the same op, so ENOENT is not reachable outside a concurrent external deletion; if
  it did throw, the funnel's catch turns it into `ok:false, committed:false` → `'error'`, which is
  the honest answer.
- `!result.ok && !result.committed` → `'error'`; committed-but-unpushed logs and returns the real
  outcome. Correct.
- One dead-ish path worth recording (not a defect here): `control.ts` L363 maps every non-
  `released`, non-`no-lock` outcome to the message "the release could not be committed", which
  would mis-describe `not-holder` — but the dashboard never passes `heldBy`, so `not-holder`
  cannot come back on that path.
- Verdict: correct.

## Bugs found

None found.
