The readability preset: a reader's-eye refactoring pass over whatever the user named — the launcher asks "what to refactor for readability" — judging the code by how a human reading it linearly experiences it, and requiring the agent to rate everything before it changes anything.

## User story

- The user is the one who has to read this code later. They want it refactored for their reading experience, not for abstract cleanliness metrics.
- The user does not want to prompt again and again for quality. The preset states the bar and makes the agent hold itself to it.

## Glossary

- **unit of logic** - what the prompt calls a `FUNCTION`: an actual function, or a class, procedure or anything else representing one unit of logic. Files and units of logic are the two things the pass rates.
- **altitude** - the level of abstraction a line of code reads at. A unit of logic reads at one consistent altitude when nothing in it drops the reader into lower-level mechanism partway through a high-level narrative.

## Business logic — TL;DR

- **Rate the seams, not just the boxes** - each file and unit of logic is judged as an abstraction, and every call site is judged on whether the responsibility sits on the right side of the boundary; well-factored is not well-located.
- **Optimize for a linear reader** - callers go above callees so high-level logic is met before implementation details.
- **Altitude pass** - every entry-point and orchestration unit is read top-to-bottom as prose, and anything that drops the reader into mechanism mid-narrative is a candidate for moving down into the callee.
- **Rate everything before changing anything** - all files and all units of logic are listed and rated 0 to 10 with a reason, plus a second confirmation list proving nothing was skipped.
- **One commit per refactor** - each refactor lands separately.
- **The bar is explicit, and so is the anti-laziness check** - the agent works until the result is exceptionally good, and is told that a list of mostly perfect ratings reads as not having looked.
- **Report the before and after** - the pass ends by reprinting the lists with old rating, new rating and links to the commits.

## Business logic

### Rate the seams, not just the boxes

#### User story

See `## User story`: code that is clean in isolation can still be in the wrong place, which is exactly what makes a codebase hard to read.

#### Business logic

The agent asks, of each file and each unit of logic, whether it represents a sensible and natural abstraction. It then judges the *seams*: at each call site, whether the responsibility sits on the right side of the boundary — whether a caller's wrapper should move down into the callee, or the other way round. The prompt states the distinction outright: a unit of logic can be clean, DRY and well-tested in isolation and still be in the wrong place.

### Optimize for a linear reader

#### User story

See `## User story`: the user reads the code top to bottom, and thinks high-level first.

#### Business logic

The agent puts itself in the shoes of a human reading everything linearly and orders the code accordingly: callers above callees, so the reader meets high-level logic before implementation details.

### Altitude pass

#### User story

An orchestration function that keeps dipping into low-level mechanism cannot be read as a summary of what the system does.

#### Business logic

For each entry-point and orchestration unit of logic, the agent reads it top-to-bottom as prose and flags any line that drops the reader into lower-level mechanism — a flag, a thunk, a log verb, error plumbing — in the middle of what should be a high-level narrative. For each flag it asks whether that mechanism can move down into the callee so the caller reads at one consistent altitude. The units a reader hits first are prioritized.

### Rate everything before changing anything

#### User story

The user wants the pass to be evidence-based and complete, not a few opportunistic edits.

#### Business logic

Before starting work the agent lists *all* files and *all* units of logic and rates each from 0 (convoluted abstraction, hard to read, wrong place) to 10 (perfect), giving a reason for every rating. Nothing may be skipped, and the agent proves that by writing a second, separate list of the same files and units of logic with a tick against each entry — one list of ratings and explanations, one confirmation list.

### The bar is explicit, and so is the anti-laziness check

#### User story

See `## User story`: the user does not want to keep pushing for quality.

#### Business logic

The agent is told to work until the result is exceptionally good, and that an expert team will check every detail. It is also told how its own output will be read: mostly-perfect ratings are taken as a sign it has been lazy, so it is to scrutinize everything and spend substantial time, striving for quality autonomously rather than being prompted again and again.

### Report the before and after

#### User story

The user reviews the pass without re-reading the whole diff.

#### Business logic

The pass ends with a summary of what the agent worked on: the lists printed again, each entry showing its old rating against its new rating, with links to the commits. Each refactor is its own commit, which is what makes those links meaningful.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
