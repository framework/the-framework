The top navigation shown on every page of the site: the logo and the name "The Framework" on the left, and "Discord" and "GitHub" buttons on the right, linking to the community's Discord server and the product's GitHub repository (the addresses live in `ui.tsx`). There is deliberately no dashboard button: the dashboard is served by the daemon on the visitor's own machine, which a public page can neither detect nor open.

## Business logic — TL;DR

- **The logo goes home** - on the landing page a click scrolls smoothly back to the top and removes the URL's fragment; on any other page it navigates to the landing page.
- **Right-clicking the logo opens the press page** - instead of the browser's context menu, a right-click on the logo opens `/press`, where the logo can be downloaded; this is the only way the site leads to the press page.
- **Narrow screens keep the icons** - below 480 pixels of width the "Discord" and "GitHub" buttons show their icons only (the rule lives in `styles.css`).
