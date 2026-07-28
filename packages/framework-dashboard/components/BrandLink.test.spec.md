Tests for `BrandLink.tsx` (#909) — covers the `href="/"` anchor, in-app navigation on a plain click, leaving all modified/middle clicks to the browser, the responsive wordmark classes (#980), and the working state reaching the Logo's gradient fill.

## Facts

- jsdom has no layout engine and does not apply utility CSS, so the sm-breakpoint hide is pinned by asserting the `hidden sm:inline` class names (real hiding was verified in a browser for the PR).
