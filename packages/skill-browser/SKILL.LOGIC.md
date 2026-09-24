The instructions an agent [1] reads before using the browser: what the browser is, the `browser` command's eight commands, how a page reads back, what a refusal looks like, that a person may be using the same browser live, and when it closes. Linked into the agent's checkout where the coding agent's harness looks for skills, it is what turns the command into a skill [2].

## Context

**User story**: an agent that changed a web app opens it in the browser, reads it, fills a field, clicks, reads the result and closes the browser, as a check that the change works; a person watching the agent sees that browser live and may use it too.

**Business logic story**: everything the skill says the command does is enforced by `src/cli.ts`, `src/host.ts` and `src/page.ts`.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch, started through the project's start hook and shown in the dashboard from the files its tool keeps.
[2] skill: a capability an agent is taught, as a package with the instructions the agent reads (its `SKILL.md`, linked into the checkout where the coding agent's harness looks for skills) and a command on the agent's PATH.

## Business logic — TL;DR

- **What the browser is and how to reach it** - a headless Chrome of the agent's own on an empty profile, with nobody's logins; run as `npx browser` from the repository's dependency `@gemstack/skill-browser`, installing with the lockfile's package manager when `node_modules` is missing; it needs a Chrome on the machine or `CHROME_PATH`.
- **The commands** - `open <address>`, `read`, `click <n>`, `type <n> <text>`, `press <key>` (nine keys), `screenshot [file]`, `eval <script>`, `close`.
- **How a page reads back** - `open`, `read`, `click`, `type` and `press` print the page once loaded: title, address, text, then its elements numbered `[n]`; the numbers are those of the last print and change with the page; an address without `http://` or `https://` gets `http://`, and no other kind opens.
- **Refusals and usage errors** - a refusal exits 1 with the reason on stderr; a wrong command line exits 2 with the usage.
- **A person may be using it too** - a person watching the agent sees this browser live where the agent opened it and can click and type in it; if the page is not what the last print showed, read it again.
- **When it closes** - close it when done; it also closes when the agent ends and after 30 minutes unused.

## Business logic

### What the browser is and how to reach it

#### Context

**Problem**: the agent must not see the logins of the person at the machine, and the command must work from any repository that depends on the package.

#### Business logic

The agent is told the browser is a headless Chrome of its own on an empty profile, so nobody's logins are in it. It runs the `browser` command, a dependency of the repository (`@gemstack/skill-browser`), as `npx browser`; when that fails for a missing `node_modules`, it installs with the lockfile's package manager (`npm install` for `package-lock.json`) and runs it again. The browser needs Chrome on the machine, or `CHROME_PATH` set to a Chrome or Chromium executable.

### The commands

#### Context

See `## Context`.

#### Business logic

- `open <address>` opens the address, starting the browser if none is open.
- `read` prints the page again.
- `click <n>` clicks element n.
- `type <n> <text>` replaces what element n holds with the text; on a select, it picks that option.
- `press <key>` presses one of Enter, Tab, Escape, Backspace, Space, ArrowUp, ArrowDown, ArrowLeft, ArrowRight.
- `screenshot [file]` saves what the page shows as a PNG and prints its path, a temporary file when none is named; the agent is told never to name one inside the repository.
- `eval <script>` runs JavaScript in the page and prints what it returns, as JSON.
- `close` closes the browser.

### How a page reads back

#### Context

**Problem**: the agent cannot see the page, so it needs the page as text and a way to point at one element of it.

#### Business logic

`open`, `read`, `click`, `type` and `press` print the page once it has loaded: its title, its address, its text, then its elements (links, buttons, fields) numbered `[n]`. `click` and `type` take that number from the last print; when the page changes, the numbers do too. An address without `http://` or `https://` gets `http://`; no other kind of address opens.

### Refusals and usage errors

#### Context

See `## Context`.

#### Business logic

A refusal (no browser open, no such element, a page that did not load) exits 1 with the reason on stderr; a wrong command line exits 2 with the usage.

### A person may be using it too

#### Context

**User story**: the person watching the agent clicks in the live browser, so the page can change without the agent doing anything.

#### Business logic

The agent is told that a person watching it sees this browser live where it opened it and can click and type in it too, so if the page is not what its last print showed, it reads it again.

### When it closes

#### Context

See `## Context`.

#### Business logic

The agent is told to close the browser when it is done, and that it also closes when the agent ends and after 30 minutes unused.
