The site's page map — one directory per route:

- `/` (`index/`) — the landing page: the product pitch, from hero to call-to-action.
- `/banner` (`banner/`) — the 1200×630 social-share banner, rendered to be screenshotted into `banner.jpg`.
- `/go-to-dashboard` (`go-to-dashboard/`) — terminal instructions for opening the dashboard.
- `/press` (`press/`) — brand material: logo, naming, banner, asset sources.

Every page shares the site-wide configuration — prerendered to static HTML, default browser-tab title "The Framework", the product-pitch meta description, the logo as favicon — and the shared head content: Open Graph tags pointing at `banner.jpg`, the IBM Plex webfonts, and a before-first-paint script restoring the visitor's persisted package-manager choice so command snippets render in their package manager without a flash. The subpages reuse the landing page's top nav, footer, and design vocabulary, and override only their browser-tab title.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
