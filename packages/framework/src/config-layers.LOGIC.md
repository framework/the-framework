Resolves an agent [1]'s three settings, vanilla [2], transparent [3] and the handoff [4] level, over an ordered list of configuration layers: the nearest layer that set a key wins, a layer that left a key unset does not take part, and a key no layer set falls to its default (off, off, `pr`). The result remembers which layer won each key, and can be summarized in one line for the agent's output.

## Context

**User story**: the user sets `transparent: true` in the repo file [5] and unticks it for one start; that start runs normally, because what the start said is nearer than what the file said. A start that says nothing inherits the file. An agent with no configuration anywhere runs with the defaults and narrates nothing about them.

**Problem**: combining layers with "on if any layer says on" lets a layer switch a mode on but never off, so a project could not override only what it sets; a nearest-wins resolution over explicit values lets an explicit `false` in a nearer layer win.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends.
[2] vanilla: an agent started without the built-in system prompt but with the signal protocols kept.
[3] transparent: an agent started with nothing of The Framework's — the raw coding agent.
[4] handoff: what happens to an agent's work when the agent ends, as one ladder of four levels: `local` (keep the work in its checkout), `push` (push its branch), `pr` (also open a pull request — the default), `merge` (also merge it).
[5] the repo file: `the-framework.yml` at a project's root: per-repo defaults that travel with the code.
[6] agent spec: the one JSON file the daemon hands a spawned agent process with its whole configuration.

## Business logic — TL;DR

- **Nearest layer wins, per key** - each of the three keys is taken from the first layer, in nearest-first order, that set it; an unset key in a layer is not a vote.
- **The layers in use** - two today: the agent's own start (labeled `flag`, the values from its agent spec) and the repo file (labeled `the-framework.yml`), in that order.
- **Defaults when nobody spoke** - vanilla off, transparent off, handoff `pr`; a key left to its default has no recorded source.
- **What the user is shown** - one line naming only the keys some layer set, as `<key>=<value> (<layer>)`, so an agent with no configuration narrates nothing.

## Business logic

### Nearest layer wins, per key

#### Context

See `## Context`.

#### Business logic

Layers are ordered nearest first. For each key, the layers are walked in that order and the first one whose value for the key is set wins, whatever that value is: an explicit off in a nearer layer beats an on in a farther one, and an explicit on beats an off. A layer that left the key unset is skipped, so it neither turns the key on nor off. The three keys resolve independently: a layer may win one key and lose another.

### The layers in use

#### Context

**Business logic story**: the agent [1]'s own process builds the list (`cli.ts`): the values its agent spec [6] carried for vanilla [2], transparent [3] and the handoff [4], then the repo file [5]'s values (`config.ts`).

#### Business logic

Today the list has two layers. The nearest is the start's own values, labeled `flag`: whatever the agent spec [6] said about the three keys, with a key the spec did not mention left unset. The next is the repo file [5], labeled `the-framework.yml`, carrying only the keys the file actually set. The mechanism accepts any number of layers in any order, so further tiers can be slotted in without changing the rule.

### Defaults when nobody spoke

#### Context

**Problem**: the zero-configuration handoff [4] is what makes an agent left alone hand its work back; merging is the rung above the default, because landing work on the default branch is not reversible the way pushing a branch is.

#### Business logic

A key no layer set resolves to its default: vanilla [2] off, transparent [3] off, and handoff `pr`, so an agent nobody configured pushes its branch and opens a pull request when it ends. The resolved configuration records, per key, the name of the layer that won it; a key that fell to its default has no source recorded, so "was this configured or defaulted" is always answerable.

### What the user is shown

#### Context

**User story**: the agent [1]'s output opens with a "◆ config:" line that tells the user which of their settings are in force and where each came from, and no such line when nothing was configured.

#### Business logic

The summary lists, in the order vanilla, transparent, handoff, only the keys that have a recorded source, each as `<key>=<value> (<layer>)` with the two modes shown as `on` or `off` and the handoff as its rung name, joined by commas: for example `vanilla=off (flag), handoff=local (the-framework.yml)`. Keys left to their default are omitted, so the summary is empty for an agent with no configuration anywhere, and the agent's process prints nothing in that case.
