The "Settings:" strip under the agent launcher: the options an agent started right now would actually run with, shown without opening the options gear.

## Business logic — TL;DR

- **Only what is on** - every option currently switched on and available is listed as a chip; options that are off, or that cannot apply here, are not. When nothing is on, the strip is absent entirely.
- **Whose setting it is** - a chip set by the repo's committed `the-framework.yml` is drawn differently and tagged "repo", with a tooltip saying it is committed for everyone who clones the repo; every other chip's tooltip says it is the user's own setting from the options gear.
- **The strip and the gear cannot disagree** - the strip lists exactly the same options the gear offers, so the two always describe the same agent.

## Business logic

### Whose setting it is

#### User story

The user opens the launcher and wants to see what the agent will run with. Some of those values were never chosen by this user: a repo carries its own committed configuration, which the options gear can neither show nor change. Being told which values are not the user's own is the point.

#### Business logic

Each chip's origin is either the repo's `the-framework.yml` or the user's own preferences. Repo-sourced chips carry a dashed outline and the word "repo"; the rest are drawn as plain filled chips. Hovering a chip states its origin in words.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
