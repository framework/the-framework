The "Go to dashboard" page (`/go-to-dashboard`): where a visitor who looks for the dashboard on the public site is told that the dashboard runs on their own machine and is opened from their terminal, with the exact command to copy for each of three situations — The Framework is installed, it must be installed first, or the visitor only wants to try it once. The page does not detect, reach or open a running dashboard: it is a static page, and the dashboard is served by the daemon on the visitor's computer.

## Context

**User story**: a visitor who has heard of the dashboard looks for a "dashboard" link on the site; instead of a dead link they get the command that starts it, in their own package manager, one click away from their clipboard.

**Problem**: the dashboard is a local web app served by the daemon on the visitor's machine; a public web page can neither detect whether one is running nor open it. So the site has no dashboard button in its top navigation (`../index/TopNav.tsx`), and this page, which nothing on the site links to, is reached only by its address.

## Business logic — TL;DR

- **Three ways to open the dashboard** - "Run" (`the-framework`, when installed), "Install" (a global install with the visitor's package manager), and "One-time run" (run once without installing).
- **The commands follow the visitor's package manager** - the "Install" and "One-time run" commands show the variant for the package manager picked with the tabs above them, a choice shared with the landing page and remembered across visits.
- **Every command copies with one click** - clicking a command copies exactly the visible text to the clipboard and confirms with "copied!".

## Business logic

### Three ways to open the dashboard

#### Context

See `## Context`.

#### Business logic

Under the heading "Go to dashboard" and the sentence "The dashboard runs 100% locally — you open it from your terminal.", three steps follow in this order:

- "Run": "If The Framework is installed, run it:" followed by the command `the-framework`.
- "Install": "Not installed yet? Install it globally:" followed by the global install command of the chosen package manager — `npm i -g framework`, `pnpm add -g framework`, `bun add -g framework`, or `npm i -g framework` again for yarn (why yarn's install line is an npm command is explained in `../index/Hero.tsx`, where the commands are defined).
- "One-time run": "You just want to try it out? Run it once, no install:" followed by the one-shot command of the chosen package manager — `npx framework`, `pnpm dlx framework`, `bunx framework` or `yarn dlx framework`.

The install command shown here is the bare install: unlike the landing page's install chip, it does not append `&& the-framework` to launch the dashboard right after installing.

### The commands follow the visitor's package manager

#### Context

**Business logic story**: the site keeps one package manager choice for the whole site — made with tabs, applied before first paint on later visits, `npm` by default — as described in `../LOGIC.md`.

#### Business logic

Both the "Install" and the "One-time run" steps carry a row of tabs, "npm", "pnpm", "bun" and "yarn", directly above their command. Clicking a tab in either row switches both commands at once, highlights that tab in both rows, and saves the choice for the visitor's next visit and for the landing page. The commands for all four package managers are present in the page and only the chosen one is visible; a visitor without JavaScript sees npm's.

### Every command copies with one click

#### Context

**User story**: the visitor clicks the command and pastes it into their terminal.

#### Business logic

Each command is a click-to-copy chip: a click copies the command visible at that moment, exactly as displayed and without the leading `$` prompt sign, to the clipboard. A "copy" tip appears next to the chip while the pointer hovers it and turns into "copied!" for a moment after a copy. Which clicks count, how the text reaches the clipboard, and what happens when the browser refuses are the rules in `../index/copy.ts`.
