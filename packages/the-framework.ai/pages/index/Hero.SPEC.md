The landing page's opening: the product's promise and the one command that gets a visitor started.

It leads with the three claims "100% Open Source", "100% Free" and "100% Local", then the headline — "Babysit AI" struck through and replaced by "Autonomous AI" — and the tagline "Make the important decisions, let AI do the rest." Below it, two short blurbs answer "What is it?" ("It turns AI agents into autonomous teammates that handle work end-to-end — while you stay in control of key decisions.") and "Any software" ("(Semi-)autonomously build anything from simple web apps to complex software.").

## Business logic — TL;DR

- **Trying it is the primary call to action** - the highlighted box offers the one-shot command that runs The Framework without installing anything; installing is the smaller, secondary option underneath.
- **The visitor's package manager is remembered site-wide** - tabs switch every command on the website between npm, pnpm, bun and yarn, and the choice survives reloads and page changes.
- **Copying the install command also runs it** - the chip shows only the install command but copies it chained with `the-framework`, so one paste installs and opens the dashboard.
- **Yarn installs through npm on purpose** - the yarn tab's install line is npm's.

## Business logic

### Trying it is the primary call to action

#### User story

A visitor who just read the pitch wants the shortest possible path to seeing the product, without committing to a global install.

#### Business logic

The hero's most prominent element is a terminal-styled box holding the one-shot command — `npx framework` and its equivalents — labelled "One-shot (no install)". Clicking anywhere in the box copies that command. A quieter line underneath offers the global install instead.

### The visitor's package manager is remembered site-wide

#### User story

A pnpm user should not have to mentally translate npm commands on every page.

#### Business logic

Tabs for npm, pnpm, bun and yarn sit above the command. Picking one immediately switches every command shown anywhere on the website, and the choice is remembered for the visitor's next visit. It is applied before the page is first painted, so a returning pnpm user never sees an npm command flash first.

### Copying the install command also runs it

#### User story

A visitor who chooses to install wants the product open, not merely installed.

#### Business logic

The install chip displays just the install command, but a click copies it followed by the `the-framework` command, so a single paste installs the package and starts the daemon that serves the dashboard.

### Yarn installs through npm on purpose

#### User story

A yarn user copies the install command and expects it to work.

#### Business logic

The yarn tab's one-shot command is yarn's own, but its install command is npm's.

#### Rationale

The one-shot command `yarn dlx` exists only in Yarn 2 and later, which is exactly the generation that dropped global installs. Pairing the two would produce a pair of commands that no single yarn generation can both run, so the install line falls back to npm — which every yarn user already has.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
