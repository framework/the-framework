The public marketing website for The Framework, served at https://the-framework.ai. Its one job: pitch the product — "Babysit AI" struck through, replaced by "Autonomous AI", under the tagline "Make the important decisions, let AI do the rest." — and convert visitors into three exits: trying the `framework` npm package in their terminal, joining the Discord, and starring the GitHub repository. Throughout, the site leans on three trust badges: 100% Open Source, 100% Free, 100% Local.

Four pages tell the story:

- `/` — the landing page: the full pitch, from hero to call-to-action (see `pages/index/SPEC.md` for the narrative arc).
- `/go-to-dashboard` — how to open the dashboard: it runs on the visitor's own machine, so the website hands them the terminal commands (run, install, or one-shot try).
- `/press` — brand material for anyone writing about The Framework: logo, naming, banner, asset sources.
- `/banner` — the 1200×630 social-share banner, existing solely to be screenshotted into the `banner.jpg` that every page's Open Graph tags point at.

The whole site is prerendered to static HTML at build time — no server, no backend. Every push to `main` that touches the site rebuilds it and deploys the static output to GitHub Pages under the `the-framework.ai` custom domain.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
