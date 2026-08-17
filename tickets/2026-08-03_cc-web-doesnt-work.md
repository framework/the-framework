Priority: 9
Topics: [highest-prio]
GitHub: [#1496](https://github.com/gemstack-land/the-framework/issues/1496)

# CC web doesn't work

## TLDR

CC-web sessions were stuck (screenshots in the issue) — highest-prio as a YC-application blocker, and also a dogfooding blocker: the maintainer wants agents to create a `.plan.md` for all open tickets in parallel (that fan-out is #1327).

**Likely fixed, pending one re-test (2026-08-17):** live evidence says #1518 + #1544 together closed it — a "Run on: Claude web" launcher run now goes all the way to a merged PR with no human step after send (run `2026-08-17T10-52-38-535Z` → PR #1546, 39s after hand-off; chain evidence on #1320). #1544 fixed provisioning (the stuck sessions were bundle-provisioned and couldn't push); #1518's hands-off closure instruction fixed the behavior side. What remains before closing: re-test the parallel-`.plan.md` shape (N concurrent web runs, i.e. #1327's fan-out).

## Why it matters

Blocker for the YC application demo and for the core dogfooding loop (parallel spike/plan agents in the cloud).

## Source

Imported from GitHub issue [gemstack-land/the-framework#1496](https://github.com/gemstack-land/the-framework/issues/1496), created 2026-08-03, labels: `highest-prio 🌟`, 2 comments (folded above).
