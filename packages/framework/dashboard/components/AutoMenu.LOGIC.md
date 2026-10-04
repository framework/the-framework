The launcher's [1] "Auto" menu: one dropdown under the launcher's box through which the user says what the next agent [2] does by itself when it finishes — how far it publishes its work, and whether a post-merge cleanup follows it — and whose button reads those picks back without being opened.

## Context

**User story**: before pressing Start the user glances under the box and reads "Auto: Open PR · cleanup": this agent will open a pull request when it is done, and a cleanup agent will follow it. To change that, they open the menu and pick "Nothing", or untick the cleanup.

**Problem**: what an agent does unasked at its end (push a branch, open a pull request, merge it) is the part of a Start the user most needs to see before pressing it. A control that showed only a name, with the pick inside, would hide it.

## Glossary

[1] launcher: the Start form on a project's own page.
[2] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch, started through the project's start hook.
[3] publish option: one of "Nothing", "Publish branch", "Open PR" and "Merge on green": how far an agent publishes its work when it finishes (`../../src/publish-levels.ts`). The launcher decides which of them the project is offered and which one is in force (`StartAgentForm.tsx`).
[4] "Post-merge cleanup" box: the tick that follows an agent with a fresh one running the project's `post-merge-cleanup` command on its branch. The launcher decides whether the project is offered it (`StartAgentForm.tsx`).

## Business logic — TL;DR

- **What the button reads** - "Auto: " and the publish option [3] in force, then " · cleanup" when the "Post-merge cleanup" box [4] is ticked; "Auto" alone in place of the first part when no publish option is offered; no menu at all when neither is offered.
- **What the menu lists** - the heading "When the agent finishes", the offered publish options with one line each saying what the agent does and a check on the one in force, then the "Post-merge cleanup" box where it is offered.
- **Picking** - a publish option is reported and the menu closes; the box is toggled and the menu stays open.

## Business logic

### What the button reads

#### Context

See `## Context`.

#### Business logic

The menu is given the publish option [3] in force, the publish options the project is offered (none for a project that can publish nothing), and whether the "Post-merge cleanup" box [4] is ticked, or that the project is not offered it.

The button is small, muted text followed by a chevron. It reads:

- with publish options offered: "Auto: " and the label of the option in force, for example "Auto: Nothing" or "Auto: Open PR";
- with no publish option offered and the box offered: "Auto";
- in both cases, " · cleanup" at the end when the box is ticked: "Auto: Open PR · cleanup", "Auto · cleanup".

With no publish option and no box offered, nothing is drawn: no button and no menu.

The button's name for assistive technology is "Auto", and its tooltip reads "What the agent does by itself when it finishes." A label too long for the space it is given is cut short with an ellipsis. The button is disabled while the launcher is busy starting an agent.

### What the menu lists

#### Context

See `## Context`.

#### Business logic

The menu opens under the button. From the top:

- the heading "When the agent finishes", in muted text;
- one row per offered publish option [3], in the order given, each with its label and one line under it:
  - "Nothing": "It publishes nothing. You decide after."
  - "Publish branch": "It pushes its branch."
  - "Open PR": "It pushes its branch and opens a pull request."
  - "Merge on green": "It opens a pull request set to merge once its checks pass."
- where the "Post-merge cleanup" box [4] is offered, a separator (only when publish options are listed above it) and a checkbox row "Post-merge cleanup", with under it: "Once the agent ends done with a pull request, a fresh agent runs /post-merge-cleanup on its branch; the merge waits for it."

The option in force carries a check mark and is marked as the current one for assistive technology; the other options carry none. The checkbox row is ticked when the box is ticked.

### Picking

#### Context

See `## Context`.

#### Business logic

Clicking a publish option [3] reports that option to the launcher and closes the menu. Clicking the "Post-merge cleanup" row reports the opposite of its current state to the launcher and leaves the menu open. The menu keeps no state of its own: the launcher saves what is reported and hands the new picks back (`StartAgentForm.tsx`).
