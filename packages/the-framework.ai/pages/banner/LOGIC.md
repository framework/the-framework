The banner page (`/banner`): the composition of the site's pitch, at the exact size of an Open Graph image, that is screenshotted by hand into the link-preview image `public/banner.jpg`; how that image is declared and regenerated is described in `../LOGIC.md`.

## Business logic — TL;DR

- **The composition** (`+Page.tsx`) - a 1200 by 630 pixel, non-interactive page with the struck "Babysit AI", "Autonomous AI", the tagline, the three badges and the logo with its wordmark.
- **The page title** (`+config.ts`) - "Banner — The Framework".
