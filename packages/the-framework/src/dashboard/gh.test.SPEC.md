What the tests cover: how The Framework talks to GitHub.

- **The GitHub credential** - `GH_TOKEN` and `GITHUB_TOKEN` both win over the GitHub CLI's own login, and the CLI is then not consulted at all; with neither set, the CLI's login is used; an empty environment variable falls through to the CLI rather than counting as a credential; a missing, logged-out or refusing CLI reports "no token" instead of failing, and a blank answer from it counts as no token rather than an empty one.
- **Merging** - a merge arms GitHub auto-merge as a squash; a repository that does not allow auto-merge falls back to a direct squash merge, in both wordings GitHub uses to refuse; any other refusal (not mergeable, permissions, network) is reported as failed and never retried as a direct merge; a draft pull request is marked ready and the arming retried once, and a readied draft still falls back to the direct merge where auto-merge is unavailable; a direct merge that also fails reports that second refusal.
- **Merging in the deferred mode** - after a refusal to arm, a pull request whose checks are still running is reported as watched and nothing is merged, a pull request whose checks are already green is merged directly, and a pull request reporting no checks at all is left to the watch rather than merged.
- **A pull request's check verdict** - all-green (including skipped checks) is passing; one concluded failure is failing even while other checks still run, and names the failed check; still-running checks are pending; classic commit statuses count alongside check runs; no checks at all is "none", and so is a GitHub CLI that could not answer — never a green.
- **Whether the repository allows auto-merge** - the setting is read as on or off, while an unreadable answer, unparseable output, or an answer omitting the setting (which happens for viewers without push access) all report "could not say" rather than "off".
- **The pull request lookup** - it asks GitHub for every field the answer carries, including the creation time and head commit that the CI watch decides on, and keeps them; a field GitHub did not answer with is left absent, so "we do not know" stays distinguishable from "it has none".
- **Listing a checkout's open pull requests** - reports a GitHub CLI that could not answer as a failure rather than as an empty list, and otherwise returns the open pull requests.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
