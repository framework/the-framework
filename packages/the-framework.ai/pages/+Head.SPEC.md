The document head shared by every page of the marketing website: the social-preview metadata (link previews point at `https://the-framework.ai/` and use the banner image `banner.jpg`, which is produced by screenshotting the `/banner` page) and the site's web fonts.

It also restores the visitor's remembered package-manager choice (npm, pnpm, bun or yarn — npm when nothing valid is remembered) before the page is first painted, so install commands shown across the site never flash the wrong package manager.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
