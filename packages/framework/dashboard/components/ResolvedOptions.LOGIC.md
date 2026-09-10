The strip under the launcher [1] that names, without opening anything, the agent options the next agent [2] will actually start with, and marks the ones the user did not choose. Only the options that are on and in force are named; each is a small chip, and a chip whose value comes from the project's committed `the-framework.yml` rather than from the user's own preferences [3] is drawn apart and labeled "repo".

## Context

**User story**: the user is about to start an agent [2] and wants to see what it will run with — publishing armed, browser on, the built-in system prompt dropped — without opening the options gear and reading seven checkboxes.

**Problem**: an option can be in force that the user never chose and cannot change from the dashboard, because a project's committed `the-framework.yml` is a configuration layer of its own and wins over the user's own preferences [3]. "Not yours" is the part worth seeing, so the strip says which chips came from the repository. The line the strip belongs to also carries the system prompt preview, so one glance answers both "what will it run with" and "what will it be told".

## Glossary

[1] launcher: the Start form on a project home — a project's own page with the launcher and its composer (the prompt editor, also used for live chat).
[2] agent: the unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends.
[3] preferences: the user's dashboard settings, kept in the registry (`~/.the-framework.json`, which also lists the projects).

## Business logic — TL;DR

- **Only what is on and in force** - the strip lists the options that are switched on and that a rule has not turned off; an option a rule overrides is left out, because it is not what the agent [2] will do.
- **One chip each, behind the word "Settings:"** - the row starts with "Settings:" and then names each option with the same label the options gear uses, so the strip and the gear can never disagree about what an option is called.
- **The repository's own values are marked** - a chip whose value comes from the project's committed `the-framework.yml` carries the word "repo" and a dashed outline, and says on hover "From this repo’s the-framework.yml, committed for everyone who clones it"; any other chip says "Your setting, from the options gear".
- **Nothing on means nothing shown** - with no option on, the strip is absent rather than an empty "Settings:" label.
