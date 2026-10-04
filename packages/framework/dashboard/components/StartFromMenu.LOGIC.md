The launcher's [1] "start from" chip: one chip in the row above the launcher's box that says, in words, which branch the next agent [2] starts from, and whose menu lets the user pick between the project's main branch and their own local branch [3].

## Context

**User story**: the user is working on a branch of their own, with commits they have not pushed, and wants an agent to continue from that work. Above the box they read `main`: the agent would start from the project's main branch. They open the chip, pick "My local branch my/work", and the chip reads `my/work (local)`. The next time they open this project the chip still reads so.

**Problem**: every agent used to start from the project's main branch, and nothing on the page said so. Where an agent starts decides what it sees and what its branch holds, so the page must say it before the Start, with the menu shut.

## Glossary

[1] launcher: the Start form on a project's own page.
[2] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch, started through the project's start hook.
[3] local branch: the branch the project's folder has checked out, as this machine has it: its commits that are not pushed are included, and edits that are not committed are not.
[4] main branch: the default branch of the project's remote (`main` for `origin/main`). An agent that starts from it starts from the remote's copy, fetched first.

## Business logic — TL;DR

- **What the chip reads** - a branch icon and the name of the branch the agent starts from: the main branch's [4] name, or the local branch's [3] name followed by " (local)".
- **What the menu lists** - the heading "The agent starts from", then two options with one line each: the main branch by its name, and "My local branch <name>"; a check on the one in force.
- **Picking** - the option is reported to the launcher and the menu closes.

## Business logic

### What the chip reads

#### Context

See `## Context`.

#### Business logic

The chip is drawn in the look of the row's other chips (`ui/chip.tsx`): a branch icon, the words, and a small chevron, since it opens a menu. Its words are the name of the main branch [4] (`main`) when that is the pick, and the name of the local branch [3] followed by " (local)" (`my/work (local)`) when the local branch is the pick. A folder that is on the main branch itself reads `main (local)` for the local pick: the two are told apart by the mark. Words too long for the row are cut short with an ellipsis. Hovering the chip shows "The agent starts from <the chip's words>". The chip is off while the launcher is busy starting an agent.

Whether there is a chip at all, which pick is in force, and the two names are the launcher's (`StartAgentForm.tsx`).

### What the menu lists

#### Context

**Problem**: the two options differ in what the agent sees, and the local one has two effects a user would not guess. Edits that are not committed are not carried. And the agent's branch holds the user's commits that are not pushed, so an agent that publishes its work (its branch pushed, or its pull request opened) publishes those commits with it. Both are said in the option's own line, so neither is hidden.

#### Business logic

A click on the chip opens a menu under it, aligned to the chip's left edge. It holds the heading "The agent starts from" and two options, in this order:

1. the main branch's [4] name, with the line "The project's main branch, fetched fresh.";
2. "My local branch <the local branch's name>", with the line "Your branch as committed on this machine; uncommitted edits are not carried. If the agent publishes, your commits that are not pushed go up with its branch."

The second option is listed even when the local branch has the main branch's name (the folder is on `main`): it then reads "My local branch main", since the local `main` may hold commits that are not pushed. The option in force carries a check mark and is marked as the current one for a screen reader.

### Picking

#### Context

See `## Context`.

#### Business logic

Clicking an option reports it to the launcher, `main` or `local`, and closes the menu. The menu keeps no state of its own: the launcher saves what is reported and hands the pick back (`StartAgentForm.tsx`).
