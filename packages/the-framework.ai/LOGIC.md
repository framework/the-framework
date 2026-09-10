The marketing website of The Framework, published at `https://the-framework.ai`: what a visitor reads to learn what the product is, why it exists and how to start it, plus a press kit and the image that link previews show. It is a static site: every page is rendered to plain HTML at build time, and a push to `main` publishes it to GitHub Pages under the site's own domain. `vite.config.ts` only wires the build plugins, `tsconfig.json` and `package.json` configure the toolchain, `public/` holds the static assets served as-is (the logo, the emoji images, the banner image, and the `CNAME` and `.nojekyll` files GitHub Pages reads), and the `*.BUG-ANALYSIS.md` files beside each source file, a repository-wide convention, only record when the file was last analyzed for bugs; none of these carry business logic.

## Context

**User story**: someone hears of The Framework and opens the-framework.ai; in one screen they learn that it makes AI programming autonomous while they keep the important decisions, and one click puts the command that starts the dashboard on their machine in their clipboard. Journalists and community members find the logo, the spelling of the name and the banner on the press page. Anyone sharing a link to the site sees the banner unfurl in the chat.

## Business logic — TL;DR

- **The pages** (`pages/`) - the landing page with its pitch, chapters and install commands; the "Go to dashboard" page; the press page; the banner page the link-preview image is a screenshot of; and the settings and head content every page shares.
- **Publishing the site** - every push to `main` that touches this package rebuilds the site and replaces what GitHub Pages serves at `the-framework.ai`.

## Business logic

### Publishing the site

#### Context

**User story**: a change to the site is live as soon as the deployment has run, without anyone deploying by hand.

#### Business logic

Every page is pre-rendered to static HTML at build time (the setting lives in `pages/+config.ts`), so the built site is a folder of files with no server behind it. A push to `main` that changes anything in this package, or the deployment workflow itself, rebuilds the site and publishes the built folder to the repository's `gh-pages` branch as a single commit that replaces the previous build entirely (the rules live in `.github/workflows/website-deploy.yml`). The `CNAME` file shipped with the build binds GitHub Pages to the domain `the-framework.ai`, and `.nojekyll` tells GitHub Pages to serve the files untouched; both live in `public/` so that each clean deploy carries them again. The site has no automated tests: the test step the deployment runs (`website:test` in the repository's root `package.json`) is a placeholder.
