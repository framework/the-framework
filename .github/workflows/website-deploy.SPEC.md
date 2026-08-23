Publishes the product's public website, https://the-framework.ai, whenever its sources land on the default branch.

## Business logic — TL;DR

- **Only the website's own changes trigger a deployment** - a push to `main` deploys only when it touches the website's sources or this deployment definition itself; every other commit is ignored.
- **The site is verified before it is published** - the product is built and the website's test step runs first, and any failure stops the deployment.
- **Each deployment replaces the previous one entirely** - the published site is the newest build and nothing else, with no accumulated history.

## Business logic

### Each deployment replaces the previous one entirely

#### User story

A visitor opens https://the-framework.ai and sees the site as it stands on the default branch, served from the project's own domain.

#### Business logic

The built site is published to the `gh-pages` branch, where it is served as GitHub Pages. Every deployment wipes that branch's previous contents and rewrites it as a single commit, so the published site contains exactly the current build and no leftovers from earlier ones.

#### Rationale

Publishing a single commit each time keeps the repository from growing without bound, since a site's build output would otherwise pile up one full copy per deployment. Wiping the branch is safe because the custom-domain and Pages configuration files travel inside the build output itself rather than living on the published branch, so replacing everything cannot lose them.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
