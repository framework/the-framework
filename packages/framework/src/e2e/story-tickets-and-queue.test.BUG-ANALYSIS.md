# Bug analysis: packages/framework/src/e2e/story-tickets-and-queue.test.ts

## Business logic (high-level)

Three stories for the propose → decide → work loop: tickets are proposals, the flat `TODO_AGENTS.md`
queue holds confirmed work, and only a *drain* agent claims from that queue.

**1. Browse the backlog (L31-61).** A fixture repo seeded with two ticket files. Asserted: the
project's Tickets page lists both with their parsed row fields (title from the `# ` heading, the
`priority:` front-matter, the `## TLDR` paragraph as the summary — so the parser is exercised
against a realistic file, not a synthetic object); the ticket's own page carries the full text; a
path-shaped name (`'../escape.md'`) is refused with `null` rather than escaping the tickets
directory — a genuine path-traversal assertion, and the only one in this file; and the
cross-project `onAllTickets` sees the same two under this project.

**2. Queue a ticket, then a drain claims it (L63-109).** The most connected story:
`sendQueueTicket` must land the entry in `TODO_AGENTS.md` (the returned `file`), the Queue page must
count it as one open item, and the entry's text must link back to `tickets/<file>` — that link is
what the drain later resolves through. The hot-tickets rail must show it. Then a drain agent is
started with `presets.drainQueue.render()` as its prompt, and three independent surfaces must agree
that it claimed the ticket: the spawned child's spec carries `options.ticket` (read from the
harness's argv recording, the only observable channel for a detached spawn), the agent's meta names
the ticket *while it is live*, and the hot rail links the ticket to that agent id. Using the real
preset text rather than a hand-written prompt is what makes the claim path realistic — the daemon
recognizes a drain by what the preset actually renders.

**3. Any other prompt claims nothing (L111-131).** The negative case, and the reason story 2's
result is meaningful: an unrelated prompt against the same queued backlog must leave
`agent.ticket` unset and the queue entry still open. Without this, story 2 could pass on an
implementation that attached the queue's next ticket to *every* agent.

**Do the tests verify what they claim?** Yes. The trio is well chosen: a read-only story, a positive
claim story with three corroborating surfaces, and the negative control. The `withFakeAwait('choices',
…)` in story 2 parks the drain agent so its meta can be read *while live* — the claim is a
live-state fact, and reading it after the agent finished would not prove the boards flip to
"implementing".

**Ordering and race hazards.** `spawnedSpecs()` at L92 is read after the gate event, so the child has
certainly written its spec. `onHotTickets` at L100 is read while the agent is parked, so the link
cannot have been torn down. The queue assertions in story 3 run after the agent reached `done`, so
"still open" is a settled state, not a snapshot mid-run. Each world is closed in a `finally`.

**Fixture note.** `addProject` seeds `tickets/<file>` into the repo *before* registration, so the
data-branch machinery finds a real `tickets/` directory and leaves it alone (it only creates its
symlink over nothing) — which is what makes these reads address the fixture's own files.

## Functions (low-level)

- **`TICKET_FILE` / `TICKET` constants** — a realistic ticket: `priority: 8` front matter, an `# `
  title, a `## TLDR` section. Built with `join('\n')` so the trailing newline is explicit. Verdict:
  correct.
- **`test('browse the ticket backlog…')`** — the `onTicket(project.id, '../escape.md')` assertion is
  the security-relevant one and is expressed as a strict `null` equality, so an implementation that
  returned `undefined` or threw would fail rather than pass. Verdict: correct.
- **`test('queue a ticket, then a drain run claims it…')`** — `assert.equal(queued.ok, true,
  queued.error ?? '')` surfaces the refusal reason on failure. `projectQueue?.items[0]?.text
  .includes(...)` is optional-chained, so a missing item fails the `assert.ok` rather than throwing
  a confusing TypeError. `gate.recommended!` is guarded by the `if (gate.kind === 'choice')`.
  Verdict: correct.
- **`test('any other prompt claims nothing…')`** — `assert.equal(agent?.ticket, undefined)` would
  also pass if the agent row were missing entirely; the preceding `waitAgent(…, 'done')` guarantees
  the row exists, so the assertion is not vacuous. Verdict: correct.

## Bugs found

None found.
