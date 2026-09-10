Maps what the user set to the options an agent [1] starts with: the repo file [2]'s keys become the preferences [3] they speak for, the handoff [4] defaults to `pr` when nobody said, and a settled set of preferences becomes the agent's options, some always stated explicitly and others sent only when they differ from the default. One mapping shared by the launcher [5], the dashboard's queue and routine surfaces, and the daemon's own starts, so an unattended [6] agent honors the same driver [7], model and per-project settings as one started by hand.

## Context

**User story**: the user sets the driver, the model, the handoff, the browser, vanilla and transparent in Settings (per machine) or in `the-framework.yml` (per repository, traveling with the code). Every agent started on the project, by the user or by the daemon, honors them.

**Business logic story**: two tiers, resolved before this mapping runs: the user's own preferences, and the repo file's keys on top, key by key, so an explicit `false` in the repo file wins over a `true` of the user's and a key the file leaves unset leaves the user's answer alone. Merging the tiers is the caller's job (`daemon-services.ts` for the daemon, `dashboard/lib/preferences.ts` for the browser); this file maps one settled answer.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends.
[2] the repo file: `the-framework.yml` at a project's root: per-repo defaults that travel with the code.
[3] preferences: the user's dashboard settings, kept in the registry (`~/.the-framework.json`, which also lists the projects).
[4] handoff: what happens to an agent's work when the agent ends, as one ladder of four levels: `local` (keep the work in its checkout), `push` (push its branch), `pr` (also open a pull request — the default), `merge` (also merge it). "Handoff level" is a rung of that ladder.
[5] launcher: the Start form on the project home, a project's own page.
[6] unattended: said of an agent nobody is watching: its gates take the recommended option and it ends when its work settles.
[7] driver: a coding agent wrapped as a black box: start it in a directory, prompt it for one turn, stream what it does, resume it later. The user's driver choice is `claude` or `codex`.
[8] vanilla: an agent started without the built-in system prompt but with the signal protocols kept.
[9] transparent: an agent started with nothing of The Framework's — the raw coding agent.
[10] location: where an agent's turns run: `local` (this machine), `actions` (a GitHub Actions runner), or `web` (a Claude Code cloud session).

## Business logic — TL;DR

- **The repo file speaks for three preferences** - vanilla, transparent and the handoff level, each copied only when the file sets it, with the same name and polarity on both sides.
- **The handoff defaults to `pr`** - a set of preferences that says nothing about the handoff means push the branch and open a pull request.
- **What always travels** - vanilla, transparent and the handoff level are stated explicitly, `false` and `pr` included, so neither the agent's own defaults nor the repo file can re-arm what the launcher showed as off.
- **What travels only when it is not the default** - the model when non-empty, the driver when it is not `claude`, the location when it is not `local`, the in-context directories when there are any, the on-before-mergeable step only when it is on.
- **The browser is Claude-only** - a browser is requested only for the `claude` driver, since no other coding agent takes one.

## Business logic

### The repo file speaks for three preferences

#### Context

**Problem**: whether an agent publishes itself, and whether it runs vanilla [8] or transparent [9], are facts about the repository, so the committed file may say them. The file is also the one place where a push without a pull request stays reachable, since the launcher offers a single "Open PR" row.

#### Business logic

From the repo file [2], exactly three keys map onto preferences [3]: `vanilla`, `transparent` and `handoff`. Each is copied with the same name and the same polarity, and only when the file sets it, so an unset key leaves the tier below alone. The file's other keys have no preference counterpart and stay on the raw file for display.

### The handoff defaults to `pr`

#### Context

**User story**: an agent left alone pushes its branch and opens a draft pull request, so work never sits on a local branch nobody was told about. Merging has to be asked for.

#### Business logic

The handoff [4] level is the preferences' when set, else `pr`. The ladder is one ordinal (`local`, then `push`, then `pr`, then `merge`, each rung including the ones below it), so a pull request without a push cannot be expressed at all; the ladder itself is `handoff-level.ts`'s.

### What always travels

#### Context

**Problem**: the agent's process resolves its options over the same layers again, with what the caller sent as the nearest layer. A setting the launcher shows as off must therefore be sent as an explicit off, or the repo file underneath would turn it back on.

#### Business logic

Vanilla [8] and transparent [9] are sent as explicit booleans, `false` included; unset reads as `false`. The handoff level is sent explicitly at every rung, `pr` included, so the agent's own default can never publish more than the launcher [5] showed.

### What travels only when it is not the default

#### Context

See `## Context`.

#### Business logic

The model is sent when it is non-empty. The driver [7] is sent only when it is not `claude`, the default. The location [10] is sent only when it is not `local`, so a local agent's options are byte-identical to those of an agent for which no location exists. The in-context directories the caller passes are sent when there are any. The on-before-mergeable quality step is sent only when its preference is on.

### The browser is Claude-only

#### Context

**User story**: the browser checkbox in the launcher is disabled when the driver is not Claude Code.

#### Business logic

The browser is requested only when the preference is on and the driver is `claude`; for any other driver it is dropped, because another coding agent takes no browser and sending it would only earn a notice that it has no effect.
