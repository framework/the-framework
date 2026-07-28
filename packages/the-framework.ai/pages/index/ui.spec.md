Shared design-system primitives for the site: URL constants, style constants, and small presentational components.

## TLDR

- Constants: `DISCORD_URL` / `GITHUB_URL` / `NPM_URL`; `mono` (IBM Plex Mono stack); `sectionStyle`, `h2Style`, `h3Style`, `cardStyle`, `kickerStyle`, `noteContainerStyle`, `noteLabelStyle`.
- `SectionHead` — centered chapter break (title + straight green accent bar + optional sub); the one centered element on a left-anchored page.
- `Note` — amber-left-border note `<p>` with a mono "Note" label; `noteContainerStyle` is exported separately for note-shaped blocks that can't be a `<p>` (the `Prompts` band).
- `WipBadge` — "Coming soon" pill (optional construction emoji); `CodeChip` — bordered wrappable inline `<code>` chip; `Emoji` — emoji rendered as static SVGs.

## Decisions

- `sectionStyle`'s vertical rhythm is a margin, not padding: anchors target the border box, so `#section` clicks land on content instead of a screen of padding.
- `Emoji` maps 8 emoji chars to static `/assets/emoji-*.svg` files (Chrome's Noto set) so emoji render identically on every platform; the `EmojiChar` type constrains usage to the shipped set.
- `CodeChip` uses `overflow-wrap: anywhere` + `box-decoration-break: clone` (long paths wrap on mobile, keeping border/padding per fragment), forces upright `font-style` inside italic notes, and keeps a border so the chip stays visible on same-color `#232a2e` surfaces.
- `SectionHead`'s accent bar is straight on purpose — at that size a tilt reads as misalignment, not as a hero-strike echo (comment).
