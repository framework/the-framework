Topics: [the-framework, modularity]
GitHub: [#1820](https://github.com/framework/the-framework/issues/1820)

# Working with no forge, and with GitLab, Bitbucket or a custom one: the forge is the packages' business

## TLDR

Can The Framework work with no git provider at all, and with GitLab, Bitbucket or a custom provider instead of GitHub? Yes to both. The forge is already inside the packages, not the framework; what is left is one remainder in the framework and one decision about where the forge adapter lives.

## Why it matters

A project on GitLab, or one with no forge at all, cannot use the framework today: the reads answer "none" and Open PR fails with gh's error. Closing the last remainder makes the forge a package's business, which is the module model as built.

## Where GitHub is today

- **The branches package** (`packages/skill-branches`): opening a pull request, marking a draft ready, merging, watching checks, editing the body — the `gh` calls in `src/publish.ts`, `src/merge-watch.ts`, `src/merge-hold.ts`. The git half of the package (checkouts, push, reclaim) is forge-free.
- **The scheduler** (`packages/agent-scheduler`): merge-on-green and the post-merge cleanup line (`gh pr list`), in `src/run.ts`, `src/scheduler.ts`, `src/pr.ts`.
- **The framework**: the pull-request reads in `src/dashboard/gh.ts`, five callers — the Human Queue's open pull requests (`interventions.ts`), a run's pull request state (`agent-handoff.ts`), the project bar's pull request (`git-status.ts`), the cloud-run adoption (`cloud-work.ts`), the scratch-ref sweep (`cloud-scratch-refs.ts`) — plus the "Open on GitHub" link (`src/dashboard/github.ts`).
- **Issues**: importing issues as tickets is GitHub's own feature on the tickets side (`update-tickets`), and stays GitHub's; another forge brings its own import.

The framework-owned shape of a request (number, url, state, title, head, draft, created) is already forge-neutral, as is the branches contract of #1817 (push, open, land, show).

## No forge

Runs, checkouts, tickets, queue and logs are files and git; none needs a forge. Today the gap is that nothing says "no forge". As a first-class case the framework hears "this project has no forge" from the package and shows it: no pull-request rows in the Human Queue, "Push" as a finished run's last step instead of "Open PR", and, if landing without a forge is wanted, the package merges the branch into the default branch and pushes.

## Other forges

- One forge adapter inside the branches package, picked by the origin's host (github.com, gitlab, bitbucket) or by the project's say, behind the request half of `publish`, `merge`, `show`; the scheduler uses the same adapter.
- The framework's five reads become one more provided command of the branches package ("the requests of this project, and of a branch"); the framework then has no `gh` at all, and the "Open on GitHub" link becomes the forge's project URL from the same command.
- A custom forge is a project's own package answering the same contract: swap the package, nothing in the framework changes.

## The decision

Whether the forge is picked by an adapter inside one branches package, or is a package per forge. Lean: the adapter inside one package, since the git half is identical and only the request half differs.

## See also

#1818 (what the module PRs left behind), #1819 (the agent's browser as a package).
