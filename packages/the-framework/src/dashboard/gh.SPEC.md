Everything the dashboard asks or tells GitHub — pull request lookups, merging, CI status — in one place.

## User Stories

- The user sees an agent's pull request and its CI state on the dashboard; when GitHub is unreachable, panels show nothing rather than a failed page.
- The user is never shown a predecessor's merged PR as their agent's own when a branch name is reused.
- The user asks for a merge and it goes through even where the repo refuses GitHub's auto-merge; the automatic merge path never lands unverified work.

## Flows

- Reads are quick, cached, and forgiving: an unreachable GitHub reads as nothing, never a failed page. The one exception is the list of a project's open pull requests, which says so when GitHub could not answer: its reader has to tell that apart from a project with no open pull requests, and a page showing nothing is a smaller cost than a notification flood.
- An agent's PR is picked from its branch's whole history — an open PR always counts, a closed one only if created after the agent began — so a reused branch name cannot wear a predecessor's merged PR.
- Merging prefers GitHub's auto-merge, so the PR lands when its checks pass. Where the repo refuses auto-merge, a merge the user asked for goes through directly; the automatic path merges only on green checks and otherwise hands the PR to the daemon's CI watch, which merges it once its checks pass — unverified work never lands.
- A draft in the way is marked ready and retried: asking for the merge says its review already happened.
- CI status boils down to passing, failing (naming the failures), pending, or none; an unreadable status is never green.
- An agent sent to a GitHub Actions runner authenticates with a token from the environment or, failing that, the user's existing GitHub login.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
