The repo's five GitHub Actions workflows: CI, the remote agent runner, a prompt-drift guard, releases, and the website deploy.

## TLDR

- `ci.yml` — push to main + every PR: install → build → typecheck → test. Nothing exotic.
- `framework-agent.yml` — the remote half of the product's GitHub-Actions run target; see `framework-agent.spec.md`.
- `prompt-drift.yml` — daily + on prompt-touching PRs: fails when `prompts/system_prompt.md` drifts from its source of truth (a GitHub issue where the prompt is designed and reviewed). Deliberately **not** part of CI — it needs the GitHub API, and a network blip must not block an unrelated PR. Runs with no install; the checker is dependency-free on purpose.
- `release.yml` — push to main: the changesets action opens/updates the version PR and publishes on merge.
- `website-deploy.yml` — path-filtered to the site package: build and deploy `dist/client` to `gh-pages` (`single-commit` to keep repo size flat; `clean: true` is safe because CNAME/.nojekyll ship from the site's `public/`).

## Facts

- `release.yml` authenticates with `RELEASE_PAT || GITHUB_TOKEN`: GitHub suppresses workflow runs on `GITHUB_TOKEN`-authored pushes, which would leave the version PR without required status checks and permanently unmergeable — the PAT fallback keeps releases working.
- Known wart: `prompt-drift.yml`'s PR path filter names an outdated snapshot filename, so editing the actual snapshot file does not trigger the PR run (the cron still catches drift daily).

## Before modifying this file

Read this file's format at https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
