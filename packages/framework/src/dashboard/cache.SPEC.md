Keeps the dashboard responsive when the answer it needs is slow to fetch: an answer already known is served instantly and refreshed behind the user's back, several simultaneous asks for the same answer cost one fetch, and a first ask that takes too long reports "still loading" rather than holding up the page.

## User story

The dashboard polls. Opening an agent asks for its pull request twice — once for the worktree bar, once for the handoff summary — on every navigation and again every ten seconds, and each of those asks GitHub, which takes the better part of a second where a local git read takes ten milliseconds. Without this, the same answer is bought over and over and the panel waits for it every time.

## Glossary

- **still loading** - the answer to a read that has not arrived yet. Explicitly not a failure: it means the answer is on its way and a later read will have it. A caller that must not act on a half-answer — offering to open a pull request that may already exist — holds off while it sees this.

## Business logic — TL;DR

- **One fetch for simultaneous asks** - two panels and a poll tick asking at once share a single fetch rather than starting three.
- **A known answer is served immediately** - and refreshed in the background once it has aged past its lifetime, so the cost of being current is never paid by whoever happens to ask.
- **A first ask waits only briefly** - past that it reports "still loading", so a slow fetch delays one panel's extra detail instead of the page.
- **A failed fetch is not remembered** - the last good answer stays, and the next ask tries again.
- **An answer can be dropped on demand** - so an action that is known to have changed something is followed by a fresh read.

## Business logic

### Serving and refreshing

#### User story

See `## User story`.

#### Business logic

An answer already known is returned at once. If it is older than its lifetime and no refresh is already running, a refresh is started in the background and the caller still gets the old answer — it never waits.

When nothing is known yet, the caller joins the fetch already running for that answer, or starts one, and waits a short budget for it. If the fetch finishes inside the budget the caller gets the answer; otherwise it is told "still loading" and the fetch carries on so a later ask can have it.

An answer that is genuinely nothing is remembered as an answer, and is distinguished from having no answer yet.

### Failures

#### Business logic

A fetch that fails caches nothing. Whatever was already known is kept — a panel keeps showing the last pull request it knew about rather than dropping it because GitHub hiccuped — and the next ask tries again. A caller waiting on a failed fetch is told "still loading" rather than being handed the failure.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
