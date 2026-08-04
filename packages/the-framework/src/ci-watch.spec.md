CI watch: poll the pull requests the framework is waiting to land, merge a watched PR once its checks pass, and start one unattended fix session per failing head commit (told to land on the PR's own branch).

## Decisions

- **Polling, not webhooks** — a local daemon has no public URL for GitHub to call. Every decision starts from what `gh` answers, so a hosted deployment could later feed the same handlers from a webhook receiver.
- The `watched` state replaced merging directly on arm: the direct fallback used to land a PR seconds after opening, before its first check ran. Merge-on-green now also works on repos without GitHub's native auto-merge.

## Facts

- Bounded on purpose: a 7-day PR window (survives a weekend of the daemon being off without letting `gh` spend grow with the archive), a no-checks grace period (a just-opened PR reads as check-less for a few minutes), and max 2 fix attempts keyed by PR + head commit.

## Before modifying this file

Read this file's format at https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
