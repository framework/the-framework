The menus of a page's top bar, split as Claude Code on the web splits them. An agent's [1] action bar has two. The agent's menu [7] opens from the agent's name and holds everything the user can do to the agent other than its next step [2]: show or hide its details, open the agent's folder, open it in an editor, open its driver session [3], copy the command that resumes that driver session in a terminal, stop [4] the agent, remove its kept checkout [5], and delete it after a confirmation. The project's menu [8], the "⋮" at the end of the bar, holds what belongs to the agent's project: its page on its git host. Each item is offered only when it can honestly do what it says. The project home's action bar shows one "⋮" menu for no agent: the items that open the project itself.

## Context

**User story**: the user wants to act on an agent without a row of icon buttons that come and go with the agent's state: one menu behind the agent's name, always in the same place, whose items say exactly what they will do. What belongs to the project and not to this agent is apart, behind the "⋮" at the end of the bar.

**Problem**: several of these actions address the agent's checkout, and a finished agent usually has none: a clean agent's checkout is removed when it ends, so an "open the agent's folder" would silently open the project root instead. The menu names what it will actually open.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch, started through the project's start hook and shown in the dashboard from the files its tool keeps.
[2] next step: what a person can do with an ended agent's work from the dashboard: open a pull request for its branch, or merge the pull request it has.
[3] driver session: the coding agent's own conversation for one agent, which the driver can resume by its session id.
[4] stop: ending an agent before it finishes: the Stop button or Ctrl-C.
[5] checkout: an agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch.
[6] preferences: the user's dashboard settings, kept in the registry (`~/.the-framework.json`, which also lists the projects).
[7] agent's menu: the menu that opens from the agent's name in the action bar, holding what belongs to the agent.
[8] project's menu: the "⋮" menu at the end of an agent's action bar, holding what belongs to the agent's project.

## Business logic — TL;DR

- **The two menus of an agent's page** - the agent's menu [7] opens from the agent's name with a small "⌄", a grey bar while the name is not known; the project's menu [8] is the "⋮" holding "Open on <git host name>" alone, and a project with no such page has no "⋮", its place kept.
- **Showing and hiding the details** - when the agent's page has a details strip, the agent's menu starts with "Show details", or "Hide details" while the strip is shown.
- **Opening the agent somewhere** - a folder item named for what it will open; an "Open in editor" submenu with the preferred-editor picker; "Open session (<id>)" when the driver session has a real link.
- **Copying the resume command** - when the driver session id is known, one item copies the terminal command that reopens the conversation, or just the id when the directory it ran in is unknown, and confirms with "Copied".
- **The menu for no agent** - on the project home one "⋮" menu, named "Project actions", holds only the items that open the project, "Open on <git host name>" among them when the project's git host names a page, and, for a project that lives on this machine only and is offered one, "Create a repository on <host>…": a confirmation names the private repository and says the code leaves the machine, "Create and push" creates it, a refusal stays in the dialog, and the project's git host page and the offer are asked again afterwards.
- **Stop, while the agent works** - "Stop agent", which reads "Stopping…" until the agent's end arrives. There is no merge here: an agent that is working is still writing its branch.
- **Remove and delete, once the agent has ended** - "Remove worktree" only while the agent's checkout is kept, with the checkout's size on disk beside it; "Delete session" only for a finished agent, behind a confirmation that says the history is gone for good while the branch and pull request stay in git.
- **Failures are said in the menu** - a failed action's reason is shown at the bottom of the menu instead of nothing happening.

## Business logic

### The two menus of an agent's page

#### Context

**User story**: the user looks for what they can do to this agent behind the agent's name, and for the project's own page behind the "⋮", as in Claude Code on the web.

**Problem**: the project's page on its git host is read from the daemon, so for a moment the page does not know whether there is one. A "⋮" that appeared or went when the answer landed would move the error count beside it.

#### Business logic

The agent's menu [7] opens from a button that is the agent's [1] name followed by a small "⌄", named "Session actions". The name is cut short when the bar is tight, and the whole name shows on hover. While the name is not known yet a grey bar holds its place, and the menu opens all the same. The menu holds the items of the sections below, from "Showing and hiding the details" to "Remove and delete, once the agent has ended". It does not hold the project's page on its git host, and asks the daemon neither for that page nor whether a repository is offered.

The project's menu [8] opens from a "⋮" icon button whose hover reads "Project actions". It holds one item: "Open on <git host name>" ("Open on GitHub" for a GitHub project), opening the project's repository page in a new tab. The last known page stays while another project's loads, so the item does not flicker. When the project's git host provider names no page, and until the daemon has answered, there is no button: a blank of the button's width is in its place.

### Showing and hiding the details

#### Context

**User story**: the user wants the facts about this agent [1] (which coding agent ran it, which model, what it cost) on request, not always on the page.

#### Business logic

When the agent's page renders a details strip under the action bar (see `AgentView.tsx`), the first item of the agent's menu [7] reads "Show details" while the strip is hidden and "Hide details" while it is shown, and a click tells the page to toggle it. A page with no such strip gets no such item.

### Opening the agent somewhere

#### Context

See `## Context`.

#### Business logic

The next items of the agent's menu [7], in order:

- The folder item, which asks the daemon to open the agent's [1] folder in the OS file manager. It is named for what it will open: "Open session's folder" when the agent still has a checkout [5] of its own, which is the case while it runs and, once finished, while its checkout was kept; "Open project folder" when the agent's checkout is gone, since the open then resolves to the project root, with the hover "This session no longer has its own checkout"; and "Open folder" when the menu serves no particular agent.
- "Open in editor", a submenu: "Open this session's checkout" (or "Open in your editor" without an agent) asks the daemon to open it in the user's editor, and below a separator the "Preferred editor" picker (`PreferredEditorItems.tsx`) stores the editor choice in the preferences [6] without closing the menu.
- "Open session (<session id>)", opening the driver session [3] in a new tab. Offered only when the driver session's link genuinely opens this session, which is when the link contains the session id (the rule in `lib/session-link.ts`); a generic product page is not worth an action.

Opening the folder or the editor is disabled while another action is in flight; when the daemon cannot open it, the menu says "Failed to open." or the daemon's own reason.

### Copying the resume command

#### Context

**Problem**: the driver session [3] id is the only handle on the conversation once the user leaves the dashboard, and an id on its own is not actionable. The coding agent finds a conversation by the directory it ran in, and that directory is usually gone by the time the user wants it, so the copied command recreates the path first.

#### Business logic

Offered only when the agent's [1] events carry a driver session id. The item shows the first 8 characters of the session id at its end and the full command on hover. It reads "Copy resume command" when the directory the agent ran in is known, and copies `mkdir -p '<directory>' && cd '<directory>' && claude --resume <session id>` (built by the rule in `lib/resume-command.ts`, which sets no permission mode on purpose); otherwise it reads "Copy session id" and copies the id alone. The menu stays open on the click, and the item reads "Copied" for a moment so a click that only fills the clipboard shows something for itself.

### The menu for no agent

#### Context

**User story**: on the project home there is no agent, so the user opens the project on its git host, in the file manager or in an editor from one "⋮" menu, in the same corner as the "⋮" of an agent's page.

#### Business logic

Given no agent, one menu opens from a "⋮" icon button whose hover reads "Project actions" and holds only the items that open something: "Open on <git host name>" (offered only when the project's git host provider names a page), "Open folder" and "Open in editor" with "Open in your editor" and the preferred-editor picker. Each acts on the project's own checkout. Nothing is offered to stop, remove or delete, and no rule is drawn under the last item: the rule that separates the opening items from the rest is drawn only when one of those follows.

### Stop, while the agent works

#### Context

**User story**: the user wants to end an agent [1] that is working.

**Problem**: the daemon runs no agent itself, so a stop is a signal to the process the agent's own record names. And a merge decided ahead of time has no place here: an agent that is working is still writing its branch, and merging its pull request is offered once it has ended, as the next step [2] in the bar above the message box (`AgentWorkBar.tsx`).

#### Business logic

"Stop agent" appears, after a separator, only while the agent is working: its events have started and its current segment carries no end. It sends a stop [4] to the agent by its id. From the click until the agent's end event arrives it reads "Stopping…" and is disabled, so a landed stop cannot be fired again. Failure: "Could not stop the session.".

Switching to another agent clears "Stopping…" so one agent's state never paints another's menu.

### Remove and delete, once the agent has ended

#### Context

**User story**: a finished agent [1] that failed or was stopped kept its checkout [5] for the user to inspect; once done, the user removes it. A finished agent the user no longer wants at all is deleted from the dashboard.

**Problem**: deleting an agent throws its history away for good, so it is the one action that asks first.

#### Business logic

Both appear, after a separator, only once the agent has ended and its id is known:

- "Remove worktree", only while the agent's checkout is still kept, with the checkout's size on disk at the end of the item when the action bar handed one. It asks the daemon to remove it and, once removed, tells the bar so the item disappears. Failure: "Could not remove the worktree.".
- "Delete session", in the danger color, only when the caller gave the menu somewhere to go after the deletion, which is the case for a finished agent. It opens a confirmation, "Delete this agent?", whose body reads "Deleting <name> removes it from the dashboard for good — its history can't be recovered. Its branch and any pull request stay in git.", naming the agent by its label or, when the label is blank, by its id. The confirm button reads "Delete", then "Deleting…" while in flight. When the daemon refuses, the dialog shows the daemon's reason or "Could not delete the agent."; on success the caller leaves the deleted agent's page.

### Failures are said in the menu

#### Context

See `## Context`.

#### Business logic

When opening, stopping or removing the checkout fails, the reason is shown in the danger color at the bottom of the menu: the daemon's message when it gave one, otherwise the item's own fallback sentence quoted above.
