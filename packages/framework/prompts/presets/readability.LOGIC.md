The "Readability" preset of the launcher: a refactoring pass whose only measure is how easy the code is for a human to read top to bottom. The agent [1] judges where each unit of logic sits and whether each boundary is drawn on the right side, reads every entry point as prose to keep it at one altitude, rates every file and every unit of logic before touching anything and proves it skipped none, makes one commit per refactor, works until the result is exceptionally good, and ends with the old and new ratings side by side with links to the commits. The target is the preset's one parameter, "What to refactor for readability"; left blank, it is the name the agent the preset was launched from gave its work, or the "entire codebase" when there is none.

## Context

**User story**: the user clicks "Readability" in a project's launcher, optionally naming what to refactor, and gets back a series of small commits, each one refactor, with a before-and-after rating of every file and function explaining what changed and why.

**Business logic story**: the preset's parameter is filled by the rule in `src/preset-prompt.ts`; the built-in system prompt's own steps, including the alternatives gate and the ready-for-merge signal, apply to the agent [1] as well. The prompt defines "FUNCTION" as any unit of logic: an actual function, a class, a procedure, and so on.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent under The Framework's control, in its own checkout, on its own branch, streaming events, handed off when it ends.

## Business logic — TL;DR

- **Judge the split and its seams** - each file and each unit of logic must be a sensible, natural abstraction, and each call site must put the responsibility on the right side of the boundary: well-factored is not well-located.
- **Read as a human reads, top to bottom** - callers above callees, and every entry point read as prose at one altitude, with any low-level mechanism moved down into the callee.
- **Rate everything first, and prove nothing was skipped** - before any change, rate every file and every unit of logic from 0 to 10 with a reason, then write a second list ticking every entry off to confirm none was forgotten.
- **One commit per refactor, and no laziness** - each refactor is its own commit; mostly-perfect ratings are a sign of laziness, and the agent keeps going on its own until the work is exceptionally good.
- **Summarize old rating to new rating** - the closing summary repeats the lists with the old and new rating per entry and links to the commits.

## Business logic

### Judge the split and its seams

#### Context

See `## Context`.

#### Business logic

The agent [1] reviews what the prompt calls the "pinnacle architectural split": whether each file and each unit of logic represents a sensible and natural abstraction. It rates the seams, not only the boxes: for each call site it asks whether the responsibility sits on the right side of the boundary, whether a caller's wrapper should move down into the callee or the other way round. A unit of logic can be clean, free of duplication and well tested in isolation and still be in the wrong place.

### Read as a human reads, top to bottom

#### Context

**Problem**: a human reads a file linearly and thinks high-level first; a caller placed below its callees, or a high-level narrative interrupted by a flag, a thunk, a log verb or error plumbing, makes the reader hold implementation details before knowing what the code is for.

#### Business logic

The agent [1] puts itself in the shoes of a human reading everything linearly:

- Top to bottom: callers are placed above callees, so the reader meets high-level logic before implementation details.
- Altitude pass: for each entry point or orchestrating unit of logic, the agent reads it top to bottom as prose and flags every line that drops the reader into a lower-level mechanism in the middle of what should be a high-level narrative. For each such line it asks whether the mechanism can move down into the callee, so the caller reads at one consistent altitude. The reading path a reader hits first is treated first.

### Rate everything first, and prove nothing was skipped

#### Context

**Problem**: a rating list that quietly omits the hardest files is worthless; a second, mechanical checklist is what makes an omission visible.

#### Business logic

Before starting to work, the agent [1] lists all files and all units of logic of the target in the chat and rates every one of them, from 0 (a convoluted abstraction, hard to read, in the wrong place) to 10 (perfect), giving a reason for each rating. It skips nothing: it writes a second, separate list of all files and all units of logic with a tick on each entry, to double-check that nothing was left unrated. Two lists: the ratings with their explanations, and the confirmation list.

### One commit per refactor, and no laziness

#### Context

**User story**: the user reviews the work refactor by refactor, one commit each, and expects an expert-level pass that needed no second prompting.

#### Business logic

Each refactor is a separate commit. The agent [1] works until the result is exceptionally good, knowing an expert team will check every little detail; mostly 10-out-of-10 ratings are read as a sign it has been lazy, so it scrutinizes everything and spends a substantial amount of time, striving for quality on its own rather than waiting to be prompted again.

### Summarize old rating to new rating

#### Context

See `## Context`.

#### Business logic

The agent [1] closes with a summary of what it worked on: the lists printed again, each entry with its old rating and its new rating, and links to the commit or commits that changed it.
