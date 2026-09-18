One "⋮" menu at the end of an agent's [1] action bar, holding everything the user can do to the agent other than its next step [2]: open the project on GitHub, open the agent's folder, open it in an editor, open its driver session [3], copy the command that resumes that driver session in a terminal, stop [4] the agent, remove its kept checkout [5], and delete it after a confirmation. Each item is offered only when it can honestly do what it says.

## Context

**User story**: the user wants to act on an agent without a row of icon buttons that come and go with the agent's state: one menu, always in the same place, whose items say exactly what they will do.

**Problem**: several of these actions address the agent's checkout, and a finished agent usually has none: a clean agent's checkout is removed when it ends, so an "open the agent's folder" would silently open the project root instead. The menu names what it will actually open.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch, started through the project's start hook and shown in the dashboard from the files its tool keeps.
[2] next step: what a person can do with an ended agent's work from the dashboard: open a pull request for its branch, or merge the pull request it has.
[3] driver session: the coding agent's own conversation for one agent, which the driver can resume by its session id.
[4] stop: ending an agent before it finishes: the Stop button or Ctrl-C.
[5] checkout: an agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch.
[6] preferences: the user's dashboard settings, kept in the registry (`~/.the-framework.json`, which also lists the projects).

## Business logic — TL;DR

- **Opening the agent somewhere** - "Open on GitHub" when the project has a GitHub URL; a folder item named for what it will open; an "Open in editor" submenu with the preferred-editor picker; "Open session (<id>)" when the driver session has a real link.
- **Copying the resume command** - when the driver session id is known, one item copies the terminal command that reopens the conversation, or just the id when the directory it ran in is unknown, and confirms with "Copied".
- **Stop, while the agent works** - "Stop agent", which reads "Stopping…" until the agent's end arrives. There is no merge here: an agent that is working publishes its own work.
- **Remove and delete, once the agent has ended** - "Remove worktree" only while the agent's checkout is kept; "Delete session" only for a finished agent, behind a confirmation that says the history is gone for good while the branch and pull request stay in git.
- **Failures are said in the menu** - a failed action's reason is shown at the bottom of the menu instead of nothing happening.

## Business logic

### Opening the agent somewhere

#### Context

See `## Context`.

#### Business logic

The menu opens from an icon button whose hover reads "Session actions". Its first items, in order:

- "Open on GitHub", opening the project's repository page in a new tab. Offered only when the project has a GitHub URL; the last known URL stays while another project's loads, so the item does not flicker.
- The folder item, which asks the daemon to open the agent's [1] folder in the OS file manager. It is named for what it will open: "Open session's folder" when the agent still has a checkout [5] of its own, which is the case while it runs and, once finished, while its checkout was kept; "Open project folder" when the agent's checkout is gone, since the open then resolves to the project root, with the hover "This session no longer has its own checkout"; and "Open folder" when the menu serves no particular agent.
- "Open in editor", a submenu: "Open this session's checkout" (or "Open in your editor" without an agent) asks the daemon to open it in the user's editor, and below a separator the "Preferred editor" picker (`PreferredEditorItems.tsx`) stores the editor choice in the preferences [6] without closing the menu.
- "Open session (<session id>)", opening the driver session [3] in a new tab. Offered only when the driver session's link genuinely opens this session, which is when the link contains the session id (the rule in `lib/session-link.ts`); a generic product page is not worth an action.

Opening the folder or the editor is disabled while another action is in flight; when the daemon cannot open it, the menu says "Failed to open." or the daemon's own reason.

### Copying the resume command

#### Context

**Problem**: the driver session [3] id is the only handle on the conversation once the user leaves the dashboard, and an id on its own is not actionable. The coding agent finds a conversation by the directory it ran in, and that directory is usually gone by the time the user wants it, so the copied command recreates the path first.

#### Business logic

Offered only when the agent's [1] events carry a driver session id. The item shows the first 8 characters of the session id at its end and the full command on hover. It reads "Copy resume command" when the directory the agent ran in is known, and copies `mkdir -p '<directory>' && cd '<directory>' && claude --resume <session id>` (built by the rule in `lib/resume-command.ts`, which sets no permission mode on purpose); otherwise it reads "Copy session id" and copies the id alone. The menu stays open on the click, and the item reads "Copied" for a moment so a click that only fills the clipboard shows something for itself.

### Stop, while the agent works

#### Context

**User story**: the user wants to end an agent [1] that is working.

**Problem**: the daemon runs no agent itself, so a stop is a signal to the process the agent's own record names. And a merge decided ahead of time has no place here: an agent that is working publishes its own work, and merging its pull request is offered once it has ended, as the bar's next step [2].

#### Business logic

"Stop agent" appears, after a separator, only while the agent is working: its events have started and its current segment carries no end. It sends a stop [4] to the agent by its id. From the click until the agent's end event arrives it reads "Stopping…" and is disabled, so a landed stop cannot be fired again. Failure: "Could not stop the session.".

Switching to another agent clears "Stopping…" so one agent's state never paints another's menu.

### Remove and delete, once the agent has ended

#### Context

**User story**: a finished agent [1] that failed or was stopped kept its checkout [5] for the user to inspect; once done, the user removes it. A finished agent the user no longer wants at all is deleted from the dashboard.

**Problem**: deleting an agent throws its history away for good, so it is the one action that asks first.

#### Business logic

Both appear, after a separator, only once the agent has ended and its id is known:

- "Remove worktree", only while the agent's checkout is still kept. It asks the daemon to remove it and, once removed, tells the bar so the item disappears. Failure: "Could not remove the worktree.".
- "Delete session", in the danger color, only when the caller gave the menu somewhere to go after the deletion, which is the case for a finished agent. It opens a confirmation, "Delete this agent?", whose body reads "Deleting <name> removes it from the dashboard for good — its history can't be recovered. Its branch and any pull request stay in git.", naming the agent by its label or, when the label is blank, by its id. The confirm button reads "Delete", then "Deleting…" while in flight. When the daemon refuses, the dialog shows the daemon's reason or "Could not delete the agent."; on success the caller leaves the deleted agent's page.

### Failures are said in the menu

#### Context

See `## Context`.

#### Business logic

When opening, stopping or removing the checkout fails, the reason is shown in the danger color at the bottom of the menu: the daemon's message when it gave one, otherwise the item's own fallback sentence quoted above.
