Compiles every prompt the product ships — the system prompt and all built-in presets — from the markdown files they are authored in into plain importable strings, so the prompting is written and reviewed as markdown while the product consumes it as text.

## Business logic — TL;DR

- **Every prompt markdown file becomes one importable string** - all markdown under the prompts folder, at any depth, is compiled; `README.md` and `SPEC.md` are documentation for humans and are left out.
- **The compiled text is exactly the prompt** - the single newline that ends a well-formed file on disk is not part of the prompt and is dropped.
- **The markdown is the only source of truth** - the compiled result is never edited or committed; it is rebuilt before every build, test run, and type check, so it cannot drift from the markdown.

## Business logic

### Every prompt markdown file becomes one importable string

#### User story

The user opens a preset in the dashboard and reads the exact prompt that will be sent, before starting an agent with it. Whoever maintains the prompting edits ordinary markdown files and reviews changes to them as prose.

#### Business logic

Each prompt file is compiled to one named string, the name derived from the file's path under the prompts folder, so a prompt is identified by where it lives rather than by a separate registration step: adding a markdown file is all it takes for a new prompt to exist. Files are processed in a fixed order so that recompiling unchanged prompts always produces an identical result. The prompt's own text is preserved verbatim, including markdown fences, backticks, and placeholder syntax that other tooling would try to interpret.

#### Rationale

The prompts are compiled ahead of time rather than read from disk when they are needed, because the dashboard displays them in the browser, where there is no file system to read them from. Compiling them into strings lets the same prompt text serve both the daemon and the browser, and lets the published package ship only its build output. It also removes the older arrangement where prompt text was copied by hand into the code and could silently fall out of sync with the markdown it came from.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
