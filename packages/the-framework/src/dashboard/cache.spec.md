The read-through cache for slow daemon-side reads (notably `gh pr view` at ~600ms against a git read's ~10ms).

## TLDR

Three behaviors, each load-bearing:
- **Single-flight** — concurrent asks share one call; two panels plus a poll tick must not become three subprocesses.
- **Stale-while-revalidate** — a known value answers immediately; the refresh happens behind whoever asked.
- **Budgeted cold ask** — the first ask waits a short budget then reports `pending`, so a slow lookup delays one panel's extra detail, not the page.

## Decisions

- `pending` is not "failed": it is what a caller that must not act on a half-answer (e.g. offering to open a PR that may already exist) uses to hold off.
- A failed load is never cached — the last good value is restored and the next read tries again; "unset" is distinguished from a cached `undefined`, because a cached "no PR" is a real answer.

## Before modifying this file

Read this file's format at https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
