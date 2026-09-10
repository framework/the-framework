Adds to the head of every page what must be there before anything renders: a script that restores the visitor's package manager choice before first paint, the metadata that link previews (Open Graph) read, and the site's two typefaces, IBM Plex Sans and IBM Plex Mono, loaded from Google Fonts.

## Business logic — TL;DR

- **The package manager choice is restored before first paint** - the choice saved in the browser's local storage is applied to the page before it renders, so the command snippets never flash the wrong variant; anything but `pnpm`, `bun` or `yarn` means `npm`.
- **Every page previews as the home page** - link previews in chats and on social networks show the banner image and the site's root URL, whichever page of the site is shared.

## Business logic

### The package manager choice is restored before first paint

#### Context

**Business logic story**: the site shows every install and one-shot command in the visitor's package manager (`npm`, `pnpm`, `bun` or `yarn`); the choice is made with tabs on the landing page and on the "Go to dashboard" page and is remembered across visits. How it is made and shown is described in `LOGIC.md` beside this file.

**Problem**: the page is served as static HTML with npm's variant visible by default; if the saved choice were applied only once the page's scripts have loaded, a pnpm user would see the npm command flash first on every visit.

#### Business logic

A script that runs before the page renders reads the saved choice from the browser's local storage and applies it to the page. Only `pnpm`, `bun` and `yarn` are accepted as saved values; any other value, no saved value at all, or a browser that refuses access to its local storage (private browsing, storage disabled) yields `npm`. After the script has run the page therefore always carries an explicit choice, and that choice is `npm` unless the visitor picked otherwise.

### Every page previews as the home page

#### Context

**User story**: a visitor pastes a link to the site into a chat or a social network and the card that unfurls shows The Framework's banner.

#### Business logic

Every page declares the same link-preview metadata: the site's root URL `https://the-framework.ai/` as the canonical address of what is shared, "website" as its kind, and `https://the-framework.ai/banner.jpg` as the preview image. Sharing a subpage such as `/press` therefore unfurls as the home page with the banner. The banner image is a screenshot of the `/banner` page made by hand as described on the press page; that rule is described in `LOGIC.md` beside this file.
