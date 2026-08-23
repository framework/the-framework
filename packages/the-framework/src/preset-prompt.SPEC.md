How a single preset is declared and rendered: a preset is its name, its prompt template, its launcher label, and — for the quality presets — the meaning of its one target blank. Everything presets have in common lives here once; only what differs between them is declared per preset.

## Business logic — TL;DR

- **One optional target** - a preset either takes a single target ("what to run against") or scopes itself, in which case its template is the prompt, rendered verbatim.
- **The default target follows the session** - a blank or omitted target falls back to the session the preset was launched from, or to "entire codebase" when no session exists yet; an explicit target wins, trimmed.
- **Own-agent flag** - a preset can declare that it always runs in an agent of its own, even when picked from inside a live one.

## Business logic

### The default target follows the session

#### User story

The user clicks a quality preset from inside a running agent's page: the pass should target that session's changes. The same click from the launcher, before any session exists, should target the whole codebase. Either way, a dashboard button must work with zero typing.

#### Business logic

The default target is itself a template, evaluated at render time against the same context as the preset body: it reads the launching session's name and falls back to "entire codebase" when there is none. A blank or omitted target uses this default; an explicit target is trimmed and wins. The rendered default is also available on its own, so a surface that labels an agent (a log title) says the same target the prompt runs against instead of keeping its own copy. Render context additionally carries the materialized presets' file paths, so one preset's prompt can point at another preset's on-disk file.

#### Rationale

The default used to be the one string that never went through the template evaluator, so a template expression inside it reached the prompt as literal text. Evaluating it like everything else is what lets the default depend on the launching session.

### Own-agent flag

#### Business logic

A preset marked as always running in its own agent opens a fresh agent even when picked from inside a live one. The flag sits on the preset, not on the surface that fires it, because it is a property of the work: work about the repo rather than about the conversation gains nothing from the current transcript and would otherwise land on that session's branch, behind its context.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
