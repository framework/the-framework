Renders the markdown agents [1] write — the project's surfaced `PLAN`/`TODO` docs, the views [2] an agent pushes, an agent's replies in the event log — as page elements built directly, never as injected HTML, so agent-written content cannot smuggle markup into the dashboard. It handles what that content actually uses (headings, bullet and task lists, code, bold and italic, links, pipe tables) and lets anything else through as plain paragraphs; a compact form shrinks everything a notch so a reply reads at the density of the log around it.

## Context

**Problem**: everything rendered here was written by a coding agent, not by the user; a renderer that turned it into HTML would let a prompt-injected reply run script or forge dashboard chrome. Building elements directly, and linking only to `http`/`https` targets, keeps the content inert.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends.
[2] view: a markdown document an agent pushes to the dashboard's right rail while it works.

## Business logic — TL;DR

- **Blocks** - headings, bullet lists, task lists with read-only checkboxes, fenced code blocks (also when the fence is never closed), pipe tables, and paragraphs for everything else.
- **Inline spans** - inline code, `[text](url)` links, bold, italic and bare URLs, applied left to right without overlap; code wins, so a URL inside backticks stays literal.
- **Only safe links** - a link renders only for an `http`/`https` target and opens in a new tab without a referrer; any other target stays plain text.
- **Compact** - the compact form uses smaller text and smaller headings.

## Business logic

### Blocks

#### Context

See `## Context`.

#### Business logic

Text is read line by line (Windows line endings count as plain newlines):

- A line of one to six `#` followed by text is a heading, shown as bold text whose size shrinks with the level.
- A line starting with `-` or `*` and a space is a bullet; consecutive bullets form one list.
- A bullet of the form `- [ ] text` or `- [x] text` is a task: a read-only checkbox, ticked for `x` or `X`, followed by the text.
- A line starting with ``` opens a fenced code block; every line until the closing ``` is shown verbatim in a monospace block. A document that ends without the closing fence still shows the block.
- Consecutive lines shaped `| … |` are a table candidate. They render as a real table only when the second row is a separator (every cell made of dashes, optionally with `:` at either end): the first row becomes the header, the rest the body, each body row padded with empty cells up to the header's width and cut at it. Pipe rows without such a separator are just prose with pipes and render as paragraphs.
- A blank line renders nothing; any other line is a paragraph.

### Inline spans

#### Context

See `## Context`.

#### Business logic

Within a heading, bullet, task, table cell or paragraph, the spans are found left to right and never overlap: `` `code` `` (shown as inline code), `[text](http…)` (a link), `**bold**`, `*italic*`, and a bare `http://` or `https://` URL (linked as its own text). Inline code wins over everything inside it, so a URL between backticks stays literal code. Raw HTML in the text is shown as the text it is.

### Only safe links

#### Context

See `## Context`.

#### Business logic

A link renders only when its target starts with `http://` or `https://`; a `[text](url)` with any other target (such as `javascript:`) is left as plain text. Every link opens in a new tab and sends no referrer.

### Compact

#### Context

**User story**: an agent's reply inside the event log should read at the log's density, not as a full document.

#### Business logic

The compact form renders the body in the smaller text size with tighter spacing, and its headings one notch smaller than the full-size ones.
