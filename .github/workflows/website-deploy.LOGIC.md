Publishes the marketing website, the `packages/the-framework.ai` package, to GitHub Pages at `the-framework.ai`: on every push to `main` that touches the website, it builds the site and replaces the whole `gh-pages` branch with the fresh build.

## Context

**User story**: a change to the website merged into `main` is live at https://the-framework.ai a few minutes later with nothing to do by hand; a change elsewhere in the repository does not redeploy the site.

## Business logic — TL;DR

- **When it deploys** - only a push to `main` that changes the website package or this workflow.
- **What it builds** - the framework package, then the website's production build, after a website test step that has no tests yet.
- **How it publishes** - the built site replaces the `gh-pages` branch as one single commit, with the custom domain and the no-Jekyll marker carried inside the build.

## Business logic

### When it deploys

#### Context

See `## Context`.

#### Business logic

The workflow, named "Website Deployment", runs on a push to the `main` branch only, and only when the push changes a file under `packages/the-framework.ai/` or the workflow file itself. A pull request never deploys, and a push to any other branch never deploys.

### What it builds

#### Context

**Business logic story**: the root `package.json` scripts define the website's build and test commands; this workflow calls them in order.

#### Business logic

One job on the latest Ubuntu runner, with pnpm, runs four commands at the repository root, each only if the previous one succeeded:

1. `pnpm install`: every package's dependencies.
2. `pnpm run build`: the framework package's build.
3. `pnpm run website:test`: the website's tests. There are none yet: the command prints "no tests yet" and succeeds, so this step cannot fail today.
4. `pnpm run website:build`: the website's production build, which lands in `packages/the-framework.ai/dist/client`.

A failing command fails the job and nothing is deployed; the previously deployed site stays up.

### How it publishes

#### Context

**Problem**: a deploy branch that kept one commit per build would grow the repository without bound, and a deploy that wiped the branch would also wipe the custom-domain file GitHub Pages needs.

#### Business logic

The workflow is allowed to write the repository's contents, which pushing the `gh-pages` branch needs. The "Deploy" step publishes the folder `packages/the-framework.ai/dist/client` to the `gh-pages` branch, removing every file of the previous deploy first and rewriting the branch as one single commit, so the branch never keeps history. The website's `public/` folder ships `CNAME`, holding `the-framework.ai`, and an empty `.nojekyll` into that build folder, so every deploy carries the custom domain and the marker that stops GitHub Pages from running Jekyll on the build, and wiping the branch loses neither.
