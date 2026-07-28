The repo's five GitHub Actions workflows: CI, the dispatchable agent runner, prompt-drift checking, releases, and website deployment.

## TLDR

- `ci.yml` — build + typecheck + test on push to `main` and PRs.
- `framework-agent.yml` — the `workflow_dispatch` workflow ActionsDriver uses to run one Claude Code agent turn on a cloud runner (#610); correlation-id addressed, transcript returned as an artifact.
- `prompt-drift.yml` — daily/on-demand check that the repo prompt matches its source-of-truth issue #326; intentionally outside CI.
- `release.yml` — changesets version-PR/publish on `main` (RELEASE_PAT to keep CI running on the version PR).
- `website-deploy.yml` — builds and pushes `the-framework.ai` to the `gh-pages` branch.

## Facts

- `framework-agent.yml` is the only workflow that is part of the product runtime — the daemon's ActionsDriver dispatches it; the rest is repo plumbing.
