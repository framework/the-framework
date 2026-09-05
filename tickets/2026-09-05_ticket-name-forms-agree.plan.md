Effort: 1
Uncertainty: 3

# [Plan] A dot-prefixed ticket filename passes as a bare name but not as a path

Make `isTicketFile` and `isTicketPath` in `packages/skill-tickets/src/names.ts` accept the same names, so the bare form and the `tickets/…` form of the same ticket are answered the same way.

## TLDR

The two gates disagree on three kinds of name, not just one. Pick where the rule lives — duplicate the leading-dot check into `isTicketFile`, or define `isTicketPath` as `tickets/` plus `isTicketFile` — then add the cases to `names.test.ts` and re-say the rule in `names.SPEC.md` and `names.test.SPEC.md`.

## What the code does today

Verified against the built `dist/names.js`:

| name | `isTicketFile` | `isTicketPath` (with the `tickets/` prefix) |
| --- | --- | --- |
| `2026-01-01_a.md` | true | true |
| `.x.md`, `..md` | **true** | **false** (`file.startsWith('.')`) |
| `a.plan.md`, `a.lock.md` | **false** (`SIBLING`) | **true** |
| `sub\x.md` | **false** (`/^[^/\\]+\.md$/`) | **true** (only `/` is checked) |

The ticket names the first row. The other two are the same defect with the gates swapped, and any fix that only patches the dot leaves them.

Where it shows:

- `ticketArg` (`src/cli.ts:285`) tries `isTicketPath` first and falls back to the raw argument, then requires `isTicketFile`. So `show .x.md` passes the gate and reads the file, while `show tickets/.x.md` is refused `invalid-path` — `isTicketPath` says no, and the whole string then fails `isTicketFile` on its `/`.
- `put` (`src/cli.ts:158`) strips the `tickets/` prefix by hand rather than through `isTicketPath`, so both its forms already agree — a leading dot is accepted either way, which is how a `.x.md` can exist in the first place.
- `ticketFromQueueEntry` returns `tickets/a.plan.md` and `tickets/sub\x.md` as "the ticket this entry came from", both of which `ticketArg` then refuses. `packages/framework/src/cli.ts:344` records `--ticket` through the same `isTicketPath`.
- `readTickets` (`src/tickets.ts:213`) lists every `.md` in the folder without either gate, so an existing `.x.md` is listed as a ticket whichever way the gates end up.

## Problems

- **Where the rule lives** (uncertainty 4) — the leading dot can be duplicated into `isTicketFile`, or the two gates can be collapsed so there is one rule and nothing left to disagree about. The second answers the whole table; it also changes what `isTicketPath` says about siblings and backslashes, which is behaviour outside this package's own commands.
- **Whether a sibling is a ticket path** (uncertainty 3) — `isTicketPath` accepts `tickets/a.plan.md`. Nothing in the code or the SPEC says that is wanted: `ticketArg` refuses it one line later, and `names.test.ts` already asserts a queue entry mentioning a `.plan.md` yields no ticket (it passes for the unrelated reason that the mention is not a markdown link). Collapsing the gates would refuse it; keeping them separate leaves it.

## Solutions

**(a) The dot only.** Add `!file.startsWith('.')` to `isTicketFile`. Smallest change, exactly what the ticket asks. Leaves the sibling and backslash rows disagreeing.

**(b) One rule, two spellings — recommended.**

```ts
export function isTicketPath(path: string): boolean {
  return path.startsWith(`${TICKETS_DIR}/`) && isTicketFile(path.slice(TICKETS_DIR.length + 1))
}
```

with `!file.startsWith('.')` added to `isTicketFile`. Every row of the table agrees by construction, and `names.SPEC.md`'s "A ticket path is the same thing spelled out" becomes literally true instead of aspirational. Costs: `isTicketPath` starts refusing siblings and backslash names, so `ticketFromQueueEntry` returns nothing for a queue entry linking to a `.plan.md` (today it returns the plan's path), and `packages/framework/src/cli.ts` drops such a `--ticket` value instead of recording it. Both are the outcome `ticketArg` already produces for the same string, one step earlier.

**(c) (a) plus backslash.** Also reject `\` in `isTicketPath`. Fixes two rows, keeps the sibling asymmetry and keeps two hand-kept copies of one rule.

Recommend (b): the package has no external users, and two predicates that must agree are one predicate.

## Considerations

- A `.x.md` already on the branch stays listed by `list` after the fix and unreachable by `show` — `readTickets` filters on `.md` alone. No such file exists on `agent-data` today; not worth a migration, worth knowing.
- `put` keeps its own prefix strip, so it inherits the leading-dot refusal through `isTicketFile` and no longer creates such a name. It stays the one command that never routes through `isTicketPath`; leaving that alone is fine, and making it call `ticketArg` is not — `put` also accepts `.plan.md` and `meta.json`, which `ticketArg` refuses.
- Both gates keep taking the name as given: neither trims, lowercases nor normalises, and the fix must not start.
- SPEC files to update, per `AGENTS.md` read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md first: `src/names.SPEC.md` ("The gate for a filename from outside" — say the dot is refused on both sides, and under (b) that the path is the filename with the folder in front) and `src/names.test.SPEC.md` (its "A ticket path" and "A bare ticket filename" bullets). `src/cli.SPEC.md` needs nothing: its "named bare or as its `tickets/…` path" already describes the fixed behaviour.
- No `FEATURES-SPEC.md` change: no feature is added or removed.

## Implementation

1. `src/names.ts` — add the leading-dot refusal to `isTicketFile`; under (b) rewrite `isTicketPath` in terms of it. Update both doc comments.
2. `src/names.test.ts` — add `.x.md` and `..md` to the bad list in *a bare ticket filename has no path segments and is not a sibling*, and `tickets/.x.md` (already there) plus, under (b), `tickets/a.plan.md` and a backslash name to the bad list in *only a plain file inside tickets/ counts as a ticket path*. Add one assertion that the two gates answer the same for the same name, so a future edit to one of them fails here.
3. `src/cli.test.ts` — a case that `show tickets/<name>` and `show <name>` refuse a dot-prefixed name identically.
4. Update the two SPEC files.
5. `pnpm -C packages/skill-tickets test`, and `pnpm -C packages/framework test` under (b) since `ticketFromQueueEntry` changes.
