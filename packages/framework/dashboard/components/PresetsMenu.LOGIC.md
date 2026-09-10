The "Presets" button beside the composer [1]: one dropdown that lists every built-in preset, the user's own custom presets [2] and the open project's shared custom presets, loads the picked one into the editor, deletes a custom preset from its row, and opens the panel that saves the current prompt as a new preset. It is the visible face of what typing `/` in the editor does.

## Context

**User story**: a first-time user with an empty composer sees a button that reveals the catalog of presets and clicks one to load it; a returning user deletes a preset they no longer use from the same menu. Typing `/` in the editor stays the fast path for those who know it.

## Glossary

[1] composer: the prompt editor on a project's own page, also used for live chat.
[2] custom preset: a preset the user saved.
[3] agent: the unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends.
[4] live chat: the user's own messages to a running agent, each continuing the same driver session.

## Business logic — TL;DR

- **The button** - a slash icon named "Presets", disabled while the surface is busy, with the tooltip "Load a preset prompt — also available by typing / in the editor".
- **Three groups** - "Presets" lists the built-ins; "Your presets" and "Project presets" appear only when there is at least one custom preset [2] of that kind.
- **Loading** - clicking a built-in loads the prompt it renders for this surface; clicking a custom preset loads its saved prompt verbatim; a built-in marked as always starting an agent [3] of its own says so to the surface.
- **Deleting** - every custom preset row has an X that deletes that preset without loading it; the user's and the project's presets are deleted through separate paths.
- **"New preset…"** - the last item opens the create panel, and is absent on surfaces that have no such panel.

## Business logic

### The button

#### Context

See `## Context`.

#### Business logic

The trigger is a small button with a slash-in-a-square icon, named "Presets", whose tooltip reads "Load a preset prompt — also available by typing / in the editor". It is disabled while the surface is busy. The menu opens aligned to the button's left edge.

### Three groups

#### Context

**User story**: the user tells at a glance which presets ship with the product, which they saved for themselves on this machine, and which the project's repository carries for everyone who clones it.

#### Business logic

- The first group, titled "Presets", lists every built-in preset the composer [1] offers, in the catalog's order: each row shows the preset's label and, under it, its slash command (`/research`, `/maintenance`, …). A built-in that carries a tooltip shows it on hover; the catalog of built-ins and their tooltips lives in `src/preset-catalog.ts`.
- The second group, titled "Your presets", lists the user's custom presets [2] by label; it exists only when there is at least one.
- The third group, titled "Project presets", lists the open project's shared custom presets by label; it exists only when there is at least one.
- Every row is disabled while the surface is busy.

### Loading

#### Context

**Problem**: some built-ins are repository work rather than a reply, so loading one from inside a running agent's [3] live chat [4] must still start an agent of its own instead of continuing that conversation.

#### Business logic

- Clicking a built-in preset hands the surface the prompt the preset renders for this surface, the preset's label, and whether the preset always runs as an agent of its own (a rule the catalog sets per preset; "Update from GitHub" is such a preset).
- Clicking a custom preset [2], the user's or the project's, hands the surface the saved prompt text verbatim and the preset's label; a custom preset never carries the "agent of its own" rule.
- What loading does to a typed draft is the editor's rule (`PromptEditor.tsx`).

### Deleting

#### Context

See `## Context`.

#### Business logic

Each custom preset [2] row ends with an X button named "Delete preset <label>" (tooltip "Delete "<label>""). Clicking it deletes that preset and does not load it; the row's own click stays out of it. A preset under "Your presets" is deleted from the user's own presets; a preset under "Project presets" is deleted from the project's shared presets. Where each kind is stored is the panel's rule (`PresetCreatePanel.tsx`). The X is disabled while the surface is busy.

### "New preset…"

#### Context

See `## Context`.

#### Business logic

After the groups, a final item "New preset…" opens the create panel that saves the current prompt. It exists only on surfaces that render such a panel (the full composer [1]); the navbar's compact launch offers no create item. It is disabled while the surface is busy.
