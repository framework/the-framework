Build script that copies the prerendered `framework-dashboard/dist/client` bundle (#405) into `the-framework/dist/dashboard-client` so a published install can serve the dashboard — framework-dashboard is private/unpublished, so the assets must ride inside `@gemstack/the-framework`'s dist.

## TLDR

- Runs after `framework-dashboard build`; verifies `index.html` exists, then rm+cp recursive.
- Missing bundle is a warn-and-skip, not a failure: a standalone `npm pack` must never break, and an install without the bundle falls back to the legacy `page.ts` dashboard (a release runs the dashboard build first).
