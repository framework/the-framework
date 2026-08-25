# Bug analysis: packages/the-framework.ai/pages/+Head.tsx

## Business logic (high-level)

The `<head>` content shared by every page of the marketing site (vike's `+Head` export). Three
responsibilities, all matching `+Head.SPEC.md`:

1. **Restore the remembered package manager before first paint.** An inline, blocking script reads
   `localStorage.pm` and stamps `document.documentElement.dataset.pm`. `pages/index/styles.css`
   L71-93 keys the visible install-command variant off `html[data-pm='…']`, and `index/Hero.tsx`
   L49-56 reads and writes the same attribute and the same `'pm'` key. All three agree on the key
   name, the attribute name, and the four accepted values.
2. **Social-preview metadata** — `og:url`, `og:type`, `og:image` pointing at `banner.jpg`, the file
   produced by screenshotting `/banner`.
3. **Web fonts** — two `preconnect`s plus the IBM Plex Sans/Mono stylesheet with `display=swap`.

Lifecycle: the script runs during head parsing, so the attribute is set before the body renders —
which is the whole point (no flash of the wrong package manager). It runs once per document load;
client-side navigations keep the attribute because nothing removes it, and React never re-executes
an inline `dangerouslySetInnerHTML` script on re-render.

## Functions (low-level)

### `Head()` (L1)

Returns a fragment. No props, no state, no effects.

- **The inline script** (L5-10). Wrapped in `try/catch`: a browser blocking storage (Safari private
  mode, "block all cookies") throws on `localStorage` access, and the catch still stamps `npm`, so
  the page never renders with an unset attribute for a reason the visitor cannot see. The value is
  whitelisted against exactly `'pnpm' | 'bun' | 'yarn'` with `'npm'` as the fallback, so a tampered
  or stale storage value cannot inject an arbitrary attribute value. Nothing from storage is
  interpolated into markup — only assigned to `dataset` — so there is no XSS surface even though
  `dangerouslySetInnerHTML` is used; the script string itself is a compile-time constant.
  `document.documentElement` always exists while `<head>` is being parsed. Correct.
- **`og:url` / `og:type` / `og:image`** (L11-14) are absolute URLs, which is required — relative
  `og:image` values are not resolved by several crawlers. Correct.
- **Fonts** (L15-20). `crossOrigin=""` on the `fonts.gstatic.com` preconnect is the anonymous-CORS
  form font files need; without it the preconnect would open a connection the font fetch could not
  reuse. Correct.
- The site-wide `<title>`/`description`/`favicon` are not here — they come from `+config.ts`, which
  is the right split. `og:title`/`og:description` are absent, so crawlers fall back to the `<title>`
  and `<meta name="description">` that vike-react emits; the SPEC lists only the three OG tags that
  are here, so this is by design.

Verdict: correct.

## Bugs found

None found.
