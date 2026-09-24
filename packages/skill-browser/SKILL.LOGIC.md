The instructions an agent [1] reads before using the browser: what the browser is, the `browser` command's eight commands, how a page reads back, what a refusal looks like, that a person may be using the same browser live, and when it closes. Linked into the agent's checkout where the coding agent's harness looks for skills, it is what turns the command into a skill [2].

## Context

**User story**: an agent that changed a web app opens it in the browser, reads it, fills a field, clicks, reads the result and closes the browser, as a check that the change works; a person watching the agent sees that browser live and may use it too.

**Business logic story**: everything the skill says the command does is enforced by `src/cli.ts`, `src/host.ts` and `src/page.ts`.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch, started through the project's start hook and shown in the dashboard from the files its tool keeps.
[2] skill: a capability an agent is taught, as a package with the instructions the agent reads (its `SKILL.md`, linked into the checkout where the coding agent's harness looks for skills) and a command on the agent's PATH.

## Business logic — TL;DR

- **What the browser is and how to reach it** - a headless Chrome of the agent's own on an empty profile, with nobody's logins; run as `npx browser` from the repository's dependency `@gemstack/skill-browser`, installing with the lockfile's package manager when `node_modules` is missing; it needs a Chrome on the machine or `CHROME_PATH`.
- **The commands** - `open <address>`, `read`, `click <n>`, `type <n> <text>`, `press <key>` (nine keys), `screenshot [file]`, `eval <script>` (an expression), `close`; a text or script with spaces is quoted as one argument.
- **How a page reads back** - `open`, `read`, `click`, `type` and `press` print the page once loaded: title, address, the first 10,000 characters of text, then the first 300 elements numbered `[n]`, the numbers written on the page's elements as `data-browser-ref`; the numbers are those of the last print and change with the page; an address without `http://` or `https://` gets `http://`, and no other kind opens; a dialog the page opens is accepted at once and named at the top of the next print.
- **One browser per project** - the browser belongs to the project's git root, so every command runs from inside the same project.
- **Refusals and usage errors** - a refusal exits 1 with the reason on stderr, a page that did not answer within 30 seconds among them; a wrong command line exits 2 with the usage.
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
- `eval <script>` runs a JavaScript expression in the page and prints its value, as JSON: `document.title`, not `return document.title`.
- `close` closes the browser.

A text or script with spaces is quoted as one argument: `npx browser type 2 'Ada Lovelace'`.

### How a page reads back

#### Context

**Problem**: the agent cannot see the page, so it needs the page as text and a way to point at one element of it.

#### Business logic

`open`, `read`, `click`, `type` and `press` print the page once it has loaded: its title, its address, its text (the first 10,000 characters), then its elements (links, buttons, fields; the first 300) numbered `[n]`. `click` and `type` take that number from the last print; when the page changes, the numbers do too. The agent is told the numbers are written on the page's elements as `data-browser-ref` attributes. An address without `http://` or `https://` gets `http://`; no other kind of address opens. A dialog the page opens (alert, confirm, prompt) is accepted at once, and the next print begins with a `Dialog, accepted:` line naming it.

### One browser per project

#### Context

**Problem**: the browser is found by the project the command runs in, so a command run from elsewhere finds no browser, or another one.

#### Business logic

The agent is told the browser belongs to the project the command runs in, its git root, and to run every command from inside the same project.

### Refusals and usage errors

#### Context

See `## Context`.

#### Business logic

A refusal (no browser open, no such element, a page that did not load, a page that did not answer within 30 seconds) exits 1 with the reason on stderr; a wrong command line exits 2 with the usage.

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
