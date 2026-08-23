The row of actions for getting at a checkout outside the dashboard: open its repo on GitHub, open its folder in the operating system's file manager, or open it in the user's editor.

## User story

The user wants to look at, or work in, the code the dashboard is talking about — the project's own checkout, or one agent's worktree — using the tools on their machine rather than the dashboard.

## Business logic — TL;DR

- **The same bar acts on whichever checkout it is about** - on a project it acts on the project's checkout; on an agent it acts on that agent's own worktree, and its labels say so ("Open this agent's folder", "Open this agent's checkout").
- **Open on GitHub** - links the project's repository, and is offered only when the project has a known GitHub repository. It is the project's repository in both cases, because an agent's branch is a branch of that same repository and may not be pushed anywhere yet.
- **Open folder** - opens the checkout in Finder or Explorer.
- **Open in editor, with the choice beside it** - one item opens the checkout in the user's editor; the same menu holds which editor to remember, so the preference lives next to the action that uses it rather than in a settings screen.
- **A failure is shown, and is not carried over** - a failed open leaves its message beside the buttons, and switching to another project or another agent clears it, so one checkout's failure never sits next to another's actions.

## Business logic

### Open in editor, with the choice beside it

#### User story

The whole point of an agent having its own worktree is being able to open it in an editor; the user should not have to hunt through settings to say which editor that is.

#### Business logic

The editor menu opens with the action itself — open this checkout in your editor. Below it sits the preferred-editor choice: "Default", explained as `$FRAMEWORK_EDITOR` or `code`, followed by every editor detected on the machine, each named and showing the command behind it. The currently preferred one is ticked. Picking one stores it as the user's preference and leaves the menu open, so the choice can be corrected without reopening it.

An editor the user set by hand that the machine does not detect is still listed, so a stored choice always appears among the options rather than silently reading as "Default".

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
