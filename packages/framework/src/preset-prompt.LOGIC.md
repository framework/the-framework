Defines how a preset is declared and rendered: from a name, a prompt, a label, an optional tooltip, an optional mark for "always a new agent [1]", and optionally what its one blank means. A preset with a blank renders the user's target into the prompt, falling back to a default target that is the launching agent's session name [2] or else "entire codebase"; a preset without a blank is its prompt verbatim. Beyond its blank, a preset can read the launching agent's session name and the on-disk path of each materialized preset.

## Context

**User story**: the user clicks a preset on the launcher [3] and the prompt already names its target: "entire codebase" from project home, where no agent exists yet, or the agent's own session name from an agent view [4]. The CLI's log title for the agent says the same target the prompt does.

**Problem**: every preset has the identical shape and differs only in two or three values, so the shape is defined once here and the fifteen rows in `preset-catalog.ts` supply the values. The default target is itself a placeholder expression rather than fixed text, so that it can depend on the agent the preset is launched from.

## Glossary

[1] agent: The unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends. Started from the dashboard by the user, or by the daemon.
[2] session name: The name an agent gives its own work (`[a-z0-9-]+`); its branch is renamed to `agent-<session name>` and the dashboard labels the agent by it.
[3] launcher: The Start form on project home, a project's own page.
[4] agent view: One agent's page in the dashboard.

## Business logic — TL;DR

- **The default target** - the launching agent's session name when one has been set, otherwise "entire codebase"; the same rendered text is available to whoever labels the agent, so the label and the prompt agree.
- **What a preset can read beyond its blank** - the launching agent's session name, if any, and a map from each materialized preset's file stem to its path under `.the-framework/presets/`, so one preset can point at another; both are optional, and before any agent exists there is simply no session name.
- **A preset with a blank** - declares one blank, "what", with its meaning and the default target; rendering trims the given target, falls back to the default when it is blank or omitted, and fills the prompt's placeholders against the same context.
- **A preset without a blank** - scopes itself, so it declares no blank and its prompt is used exactly as written, with nothing evaluated.

## Business logic

### The default target

#### Context

**User story**: from an agent view [4] the user starts "Readability" on the agent's own work without typing anything; from the launcher [3] the same click reviews the whole codebase.

#### Business logic

The default target is the placeholder expression "the launching agent's session name [2], or else `entire codebase`". It is evaluated against the same context as the preset's prompt, so an agent's name reaches it when the preset is launched from that agent and the codebase-wide wording is used when no agent exists yet, as in the launcher's prompt preview. The rendered default is exposed on its own, so a caller that labels an agent [1] (the CLI's log title) says the same thing the prompt targets instead of keeping a copy of the wording.

### What a preset can read beyond its blank

#### Context

**Problem**: the "Maintenance" preset queues entries that tell a later agent [1] to apply the "Maintainability" and "Security audit" presets, so a prompt must be able to name where another preset lives on disk.

#### Business logic

A preset renders against two optional facts: the launching agent's session name [2], once one has been set, and a map from each materialized preset's file stem to its path, which defaults to the registry in `preset-registry.ts` (`.the-framework/presets/<stem>.md`). The map always has a value, so a prompt that names another preset never fails to render. The session name may be absent, which is what makes the default target fall through to "entire codebase".

### A preset with a blank

#### Context

**User story**: the user types a target, or leaves the prefilled one, and the prompt reads "Refactor <target> to make it …" with no placeholder left behind.

#### Business logic

Declaring a preset with a description of its blank, such as "What to refactor for readability", gives it exactly one blank named "what" whose default is the default target and whose meaning is that description. Rendering takes an optional target and optional context: the target is trimmed; a blank or omitted target falls back to the default target, rendered against the same context, so a dashboard button runs with zero input. The prompt's placeholders are then evaluated by the rules in `prompt-template.ts` with the target, the session name [2] and the presets map in scope. The default target can read the session name but not the blank itself, since it is what fills the blank.

### A preset without a blank

#### Context

**Business logic story**: the triage and product-management presets read the repository's own tickets, plans or queue, so there is no blank for the user to fill.

#### Business logic

Declaring a preset without a description of a blank gives it no blank at all, and rendering it yields its prompt exactly as written, whatever target or context is passed: nothing in it is evaluated, so such a prompt must contain no placeholder.
