A chrome-less fixed 1200×630 page rendered solely to be screenshotted into the site's Open Graph image (`public/banner.jpg`).

## TLDR

- 1200×630 is the OG image size; layout is sized to stay legible at ~40% scale (X/Slack cards) with >=64px safe margins all around.
- Content: "Babysit AI" struck through by a static rotated red bar (inline span, not the animated `.strike` CSS) above "Autonomous AI", the tagline, the three "100%" pill badges, and a brand lockup (logo + uppercase mono wordmark) on the right; two radial glows keep the background from reading flat.
- All styling inline; imports only `styles.css` (fonts/body) and `mono` from `../index/ui`.

## Facts

- Regeneration instructions are linked from `/press` (a gist); `+Head.tsx` points `og:image` at the resulting `/banner.jpg`.
