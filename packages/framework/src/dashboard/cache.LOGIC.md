A read-through cache for the dashboard's slow reads: the pull request facts that come from the `gh` CLI (`gh.ts`). A fact that is already known is answered at once and refreshed behind the caller once it is older than its trust window; a fact that is not known yet is fetched once for everyone asking and waited for only briefly, after which the caller is told the answer is still pending; a fetch that fails never erases the last good answer. The cache lives in the daemon's memory, so a daemon restart starts cold.

## Context

**User story**: the user opens an agent [1] in the dashboard and sees the agent's branch and its pull request in the git status bar and in the handoff [2] summary of its agent view [3], and the same row on project home [4]; the page re-reads those rows every few seconds. Reading a pull request through `gh` takes around 600 ms where the git facts beside it take around ten, so without this cache every panel would wait on GitHub on every poll and the same answer would be bought several times over.

**Problem**: a caller deciding whether to offer "Open PR" must never mistake "not known yet" for "there is no pull request", or it opens a second one. The cache therefore answers with two facts: the value, and whether a read is still running with no value known yet.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends.
[2] handoff: what happens to an agent's work when the agent ends, as one ladder of four levels: `local` (keep the work in its checkout), `push` (push its branch), `pr` (also open a pull request — the default), `merge` (also merge it).
[3] agent view: one agent's page.
[4] project home: a project's own page with the launcher (the Start form) and its composer (the prompt editor, also used for live chat).

## Business logic — TL;DR

- **A known answer is served at once and refreshed behind the caller** - once a value has been read it is returned immediately, and when it is older than its trust window (60 seconds unless the caller sets another) a refresh runs in the background, so the cost of staying current is never paid by the caller that happens to ask.
- **Concurrent asks share one fetch** - while a value is being fetched, every caller asking for the same key joins that fetch instead of starting another, so two panels and a poll do not become three `gh` processes.
- **A cold ask waits briefly, then reports pending** - the first ask for an unknown value waits 150 ms (unless the caller sets another budget) for the fetch, and past that the caller is told the value is pending while the fetch finishes for the next ask.
- **A failed fetch keeps the last good value** - a fetch that fails changes nothing that was known and is retried on the next ask, and a cold fetch that fails leaves the caller with a pending answer rather than a false "none".
- **Forgetting a key** - after an action that changes the answer (opening or merging a pull request), the caller drops the key so the next ask fetches afresh.

## Business logic

### A known answer is served at once and refreshed behind the caller

#### Context

See `## Context`.

#### Business logic

Every fact is cached under a key the caller chooses. When the key has a value, the ask is answered with that value straight away and is never marked pending. If the value was read 60 seconds ago or longer (the caller may set a different window, as `gh.ts` does for the repository's auto-merge setting) and no refresh is already running, a refresh starts in the background; the caller still gets the old value now, and the next ask gets the new one once it has landed. The window is measured from when the value was last read successfully, so after a background refresh that fails the value is still stale and the following ask starts another refresh.

### Concurrent asks share one fetch

#### Context

**Problem**: the git status bar and the handoff [2] summary both ask for the same pull request, and a poll may ask again while the first fetch is still running; each fetch is a `gh` process.

#### Business logic

At most one fetch runs per key at a time. An ask that finds a fetch running for its key never starts another: with a value already known it is answered from that value at once, and with no value known it waits on the running fetch within its own budget.

### A cold ask waits briefly, then reports pending

#### Context

See `## Context`.

#### Business logic

When nothing is known for the key, the ask starts the fetch (or joins the running one) and waits at most 150 ms for it; a caller may set a different budget. If the fetch settles within the budget, its value is answered and nothing is pending. Otherwise the answer carries no value and is marked pending, which means "on its way, ask again": the fetch keeps running, and once it lands the next ask is answered from it at once. Pending is not a failure and is never confused with "there is nothing": a caller that must not act on a half-answer (offering to open a pull request that may already exist) holds off while the answer is pending.

### A failed fetch keeps the last good value

#### Context

**Problem**: a `gh` hiccup (a network blip, a rate limit) must not make a panel drop the pull request it was showing a second ago.

#### Business logic

A fetch that fails is not cached. When a value was already known, it stays exactly as it was and the failure only clears the "fetch running" mark, so the next ask past the trust window tries again. When no value was known, the key is dropped, the cold ask that waited on the fetch is answered as pending, and the next ask starts a new fetch. The error never surfaces to the dashboard: a background failure is silent, and a cold failure reads as pending.

### Forgetting a key

#### Context

**Business logic story**: opening a pull request or merging one (`agent-handoff.ts`) changes the answer for that branch immediately, and a cached "no pull request" would keep the git status bar offering "Open PR" for up to a minute.

#### Business logic

A caller can drop everything cached under a key. The next ask for that key is a cold ask: it fetches afresh, waits its budget, and may answer pending.
