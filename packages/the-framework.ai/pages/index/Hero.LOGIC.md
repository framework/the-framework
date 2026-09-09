The hero at the top of the landing page: the product's pitch in one screen — "Babysit AI" crossed out, "Autonomous AI", the tagline, three badges and two one-paragraph answers — and the fastest path to running it, a "Try:" box with the one-shot command and an "Or install:" chip, both in the visitor's package manager and both copied with one click. It also holds the site's rule for which package manager is chosen and remembered.

## Context

**User story**: a visitor lands on the-framework.ai, understands in a glance what The Framework is, picks their package manager once, clicks the command and pastes it into a terminal; the dashboard opens on their machine.

## Business logic — TL;DR

- **The pitch** - badges "100% Open Source", "100% Free", "100% Local"; the headline "Babysit AI" struck through above "Autonomous AI"; the tagline "Make the important decisions, let AI do the rest."; and two blurbs, "What is it?" and "Any software".
- **The package manager choice** - one of `npm`, `pnpm`, `bun`, `yarn`, chosen with tabs, applied site-wide at once and remembered in the browser; `npm` by default.
- **"Try:" copies the one-shot command** - the box shows the command that runs The Framework without installing it, in the chosen package manager, and copies it on click.
- **"Or install:" copies install-and-launch** - the chip shows the global install command but copies it followed by `&& the-framework`, so one paste installs The Framework and opens the dashboard.

## Business logic

### The pitch

#### Context

See `## Context`.

#### Business logic

From top to bottom: three badges, "100% Open Source", "100% Free" and "100% Local"; the headline, where the words "Babysit AI" are crossed out by a red line that draws itself shortly after the page loads (the animation lives in `styles.css`), above the words "Autonomous AI"; the tagline "Make the important decisions, let AI do the rest."; then, under the command box, two blurbs side by side. "What is it?" answers: "It turns AI agents into autonomous teammates that handle work end-to-end — while you stay in control of key decisions." "Any software" answers: "(Semi-)autonomously build anything from simple web apps to complex software."

### The package manager choice

#### Context

**Problem**: the install and one-shot commands differ per package manager; showing all four, or only npm's, makes the visitor translate. Asking once and remembering lets every command on the site read as the visitor's own.

#### Business logic

The site knows four package managers, offered as tabs in this order: `npm`, `pnpm`, `bun`, `yarn`. Their one-shot commands are `npx framework`, `pnpm dlx framework`, `bunx framework` and `yarn dlx framework`. Their global install commands are `npm i -g framework`, `pnpm add -g framework`, `bun add -g framework` and, for yarn, `npm i -g framework`: the yarn generation that has `yarn dlx` no longer has a global install command, and every yarn user has npm, so the install line uses npm rather than pairing two commands that no single yarn generation can both run.

Clicking a tab makes it the site-wide choice: every command on the page switches to that package manager's variant immediately, the tab is highlighted, and the choice is saved in the browser's local storage so that later visits and the "Go to dashboard" page (`../go-to-dashboard/+Page.tsx`) open with it. All four variants of each command are present in the page and only the chosen one is shown; on later visits the choice is applied before the page first renders (`../+Head.tsx`), and a visitor without JavaScript sees npm's variant. When the browser refuses to save the choice, it still applies to the current page but is forgotten on the next visit. The default is `npm`.

### "Try:" copies the one-shot command

#### Context

See `## Context`.

#### Business logic

The "Try:" box has the package manager tabs in its header row and, below them, the one-shot command for the chosen package manager after a `$` prompt sign, annotated "# One-shot (no install)". Clicking anywhere on the command line copies that command — the variant chosen at the moment of the click, without the `$` — to the clipboard. A badge in the header row reads "copy" while the pointer hovers the command and "copied!" for a moment after a copy; otherwise it is hidden. Which clicks count, how the text reaches the clipboard and what happens when the browser refuses are the rules in `copy.ts`.

### "Or install:" copies install-and-launch

#### Context

**User story**: a visitor who wants The Framework installed for good pastes one line and ends up in the dashboard.

#### Business logic

Next to "Or install:" a chip shows the global install command for the chosen package manager after a `$` prompt sign. Clicking it copies more than it shows: the install command followed by ` && the-framework`, so that one paste installs The Framework and then starts it. The "copy" / "copied!" tip appears beside the chip while hovering and after a copy, under the same clipboard rules as the "Try:" box (`copy.ts`).
