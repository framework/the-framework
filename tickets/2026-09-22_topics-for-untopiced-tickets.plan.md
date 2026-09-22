Effort: 1
Uncertainty: 2

# [Plan] Give every ticket that has no Topics line one, from its title and TLDR

This file holds the ways to add a `Topics:` line to the 8 tickets that lack one, the topics proposed for each, and the way recommended.

## The tickets and the topics proposed

Read from `npx tickets list` on 2026-09-22; none is claimed or in review. The words reuse the vocabulary already on the other tickets (`the-framework`, `modularity`, `dashboard`, `skills`, `UX`, `system-prompt`) and add a new word only where none fits.

| Ticket | Topics |
|---|---|
| `2026-09-09_dashboard-architecture-plan.md` | `[dashboard, modularity]` |
| `2026-09-09_dashboard-architecture.md` | `[dashboard, modularity]` |
| `2026-09-08_cursor-parity-checklist.md` | `[the-framework, cursor-parity]` |
| `2026-09-05_skill-browser-access.md` | `[skills, browser]` |
| `2026-09-04_cold-read-follow-ups.md` | `[skills, docs]` |
| `2026-08-28_actions-agent-two-branch-names.md` | `[agent-driver, branches]` |
| `2026-08-18_ac-enforcement-merge-gate.md` | `[system-prompt, merge-gate]` |
| `2026-07-31_dashboard-ux-notes.md` | `[dashboard, UX]` |

`browser` also fits the two browser tickets that already have topics (`agent-browser-as-a-package`, `browser-phase2-chromium-in-sandbox`); adding it to them is outside this ticket, which only fills tickets that have none.

## Solutions

- **A. Fill the 8 tickets, one `put` each.** For each: `npx tickets show` it, add the `Topics:` line in its place (after `Priority:` when there is one, before `Issue:`), `put` the whole file back, then `show` it again to confirm only that line changed. 8 commits on `agent-data`, one per ticket.
- **B. A, plus make topics appear on new tickets.** Change the `update-tickets` and `plan` skills so every ticket they write gets a `Topics:` line. Keeps the gap from reopening, but it changes two skills' SKILL.md files, which is code, not what the task asks, and topics are optional in the ticket format on purpose.
- **C. Take the topics from the issue's labels.** Every one of the 8 tickets has an issue. Rejected: the task says title and TLDR, and labels (`enhancement`) say little about what the ticket is about.

## Recommendation

**A.** It is exactly the task, touches only ticket files, and each write is checked by reading it back. B is worth its own ticket if the gap reopens after the next imports.

## Considerations

- `put` writes the whole file: start from the text `show` prints, never from a copy, or a concurrent edit is lost. A rejected write (someone wrote first) is tried once more after reading again.
- `update-tickets` updates a ticket "in place" when its issue changes; it may rewrite the file without the new line. After the next import, check the 8 still carry it; if not, that is the case for B.
- `UX` is upper case on the existing tickets; kept as is so the filter's option list does not show `UX` and `ux` side by side.
