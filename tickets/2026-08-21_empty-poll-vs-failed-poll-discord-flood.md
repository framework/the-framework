Priority: 6
GitHub: [#1623](https://github.com/gemstack-land/the-framework/issues/1623)

# A boot that cannot reach GitHub arms a Discord flood: an empty first poll can't be told from a failed one

## TLDR

`keyed-watcher.ts` refuses to warm up on a failed first poll — it returns before `observe()`, so `warmedUp` stays false — but neither of its inputs can throw. Both fail soft one layer up: `listSummaries` does `await listProjects(undefined, env).catch(() => [])` (`daemon-services.ts:130`) and `buildInterventions` does `await prs(project.path).catch(() => [])` per project (`interventions.ts:89`). So a boot where the registry can't be read, `gh` isn't authenticated yet, or GitHub is unreachable doesn't fail its first poll — it *succeeds, empty*. `SeenTracker.observe([])` warms up against an empty baseline, and the first poll that does reach GitHub announces every already-open PR as new.

## Why it matters

Both Discord watchers are wired this way — the "needs you" queue and the New activity feed — so the failure is one message per pre-existing item, all at once, into the user's Discord. It fires exactly when the machine is least healthy (no network, no auth, no registry), and every layer involved is behaving as designed: the watcher won't warm up on a failure it never sees, the builders won't let one unreachable project sink the whole poll, the registry read won't make a missing file fatal. The bug lives in the seam — **an empty read and a failed read arrive as the same value**, and only the watcher needs to tell them apart.

## What a fix has to decide

The watcher can't distinguish the two from `T[]` alone, so one of:

- **The builders report failure.** `build` returns items *and* whether the read was whole (or throws, which the watcher already handles). The honest fix, and the information already exists at the `catch` that currently discards it.
- **An empty first poll doesn't warm up.** One line in `SeenTracker`. It costs the case it's wrong for: a genuinely empty first poll on a quiet machine stays un-warmed until the first item appears, which then announces as new — a notification nobody asked for. The milder failure, but still a wrong one.

The first is the real fix; the second is what you'd ship today if the first were too large.

## Related

Second seam this week where a value meaning "we could not read" was flattened into one meaning "there is nothing" — #1619 flattened "no model given" into "no model window in force". Both stayed invisible because the flattening happens at a `catch` that reads as defensive.

Found while grounding the spec-vs-code list on #1613. That list names this bug but locates it in the wrong place — fixing where it points would change nothing.

## Source

Imported from GitHub issue [gemstack-land/the-framework#1623](https://github.com/gemstack-land/the-framework/issues/1623), created 2026-08-21, no labels, 0 comments.
