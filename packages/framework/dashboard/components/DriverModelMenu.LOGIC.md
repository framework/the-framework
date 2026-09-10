Offers the driver [1] and model for the next agent [2] as one menu: a tree whose top level lists the drivers and whose submenus list each driver's own models, so picking a model always sets its driver with it and an incompatible pair, such as Codex with a Claude model, cannot be chosen. The menu's button shows the current driver's logo followed by the current model's name. Which drivers and models are offered is the caller's decision: the composer [3] builds the list (its rules in `Composer.tsx`) from the model catalog in `lib/agent-settings.ts`.

## Glossary

[1] driver: a coding agent wrapped as a black box: start it in a directory, prompt it for one turn, stream what it does, resume it later. The user's driver choice is `claude` or `codex`.
[2] agent: the unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends.
[3] composer: the prompt editor on a project's own page, also used for live chat.
[4] coding agent: the CLI doing the actual work: Claude Code or Codex.

## Business logic — TL;DR

- **Choosing a model chooses its driver** - the menu is a tree of drivers with each driver's own models beneath it; picking a model reports both together, so a Claude model can never be paired with Codex.
- **The button names only what is really set** - the button shows the current driver's logo and the current model's name; with no model pinned, or a model pinned on another driver, it names no model rather than the first one listed.
- **Spelled out for the tooltip and assistive technology** - the button's tooltip and its accessible name read "Driver: <driver> · Model: <model>", where an unpinned model reads "the CLI's own default".
- **Disabled while busy** - the button is disabled while the caller reports a start in flight, so the driver and model cannot change under it.

## Business logic

### Choosing a model chooses its driver

#### Context

**User story**: the user opens the model menu in the composer [3], sees the drivers [1] ("Claude Code", "Codex") and, under each, the models that driver can run; they pick one, and the next agent [2] starts with that driver and that model.

**Problem**: a driver can only run its own models; a menu that let the driver and the model be chosen separately would allow a pair the coding agent [4] cannot start.

#### Business logic

The top level of the menu lists the drivers in the order given, each with its logo (when it has one) and its label; the current driver carries a check mark. Each driver opens a submenu of only its own models, in the order given, and within the current driver the current model carries a check mark. Choosing a model reports the driver and the model together as one change. Every model entry is a real model: the menu offers no "default" or unset entry. Choosing "Haiku" is allowed like any other model; the warning that choice earns lives in the launcher (`StartAgentForm.tsx`) and never blocks.

### The button names only what is really set

#### Context

**Problem**: naming a model the agent [2] will not actually be passed is worse than naming none: a model pinned while the other driver [1] was selected, or never pinned at all, must not read as whichever model happens to be listed first.

#### Business logic

The button shows the current driver's logo, or its label when it has no logo, then the current model's label, then a chevron. The model's label is looked up only within the current driver's own list: when the pinned model is empty, or belongs to another driver, the button shows no model name at all. When the current driver is not among the drivers offered, the first driver offered stands in as current for what the button shows.

### Spelled out for the tooltip and assistive technology

#### Context

**Problem**: with nothing pinned the button is a logo and a chevron, which names nothing to a screen reader; and even with a model shown, the logo alone does not spell out the driver [1] to a sighted user.

#### Business logic

The button's tooltip and its accessible name both read "Driver: <driver label> · Model: <model label>". When no model name is shown, the model part reads "the CLI's own default" (the wording in `lib/agent-settings.ts`), meaning the coding agent [4] picks its own model.

### Disabled while busy

#### Context

See "Choosing a model chooses its driver".

#### Business logic

The button is disabled while the caller reports it busy, which is while an agent [2] is being started, so the driver and model cannot change under a start in flight.
