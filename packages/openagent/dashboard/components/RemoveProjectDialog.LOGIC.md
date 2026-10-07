The dialog behind "Remove project…" in the project's "⋮" menu (`AgentActionsMenu.tsx`). It asks before the project leaves the dashboard's list, offers one box, "Also delete OpenAgent's files in this folder", and, when the box was ticked, stays open after the removal to list what was deleted and what was kept.

## Context

**User story**: the user removes a project. Most of the time they only want it off the list, and nothing in the folder changes. Sometimes they also want the folder as it was before OpenAgent: then they tick one box, read at once what will be deleted and what never is, confirm, and read the list of what went and what stayed.

**Problem**: deleting OpenAgent's files [1] deletes the agents' conversations, which may have no other copy. So the box is never ticked for the user, what it deletes is said the moment it is ticked and not after, and the result is not a silent close: the page moves on only once the user has seen the report [2].

## Glossary

[1] OpenAgent's files: what the product and its tools left in a project's folder: the directories `.openagent`, `.branches` and `.agent-runner`, the local branch `agent-data` with the agents' records, and what a tool the project has installed keeps there (the scheduler's `.agent-scheduler`, the subagent settings in `.orchestration`).
[2] report: the daemon's answer to a removal with files, three lists in words for a person: what was removed, what was kept with the reason, and what could not be done (`src/remove-files.ts`).

## Business logic — TL;DR

- **The question** - "Remove this project?", with the text that says nothing in the folder is deleted, and "Cancel" and "Remove".
- **The box** - "Also delete OpenAgent's files in this folder", unticked each time the dialog opens; ticked, the body no longer says nothing is deleted, a panel says what is deleted, that the agents' conversations go, and what is never touched, and the button reads "Remove and delete".
- **Removing** - the daemon is asked to remove the project by its id, with the box's state; nothing closes the dialog meanwhile; a refusal stays in the dialog.
- **The report** - after a removal with files the dialog shows "Project removed" with "Deleted", "Kept" and "Could not be cleaned"; only "Done" closes it.
- **The page is told last** - the page learns the project is removed only after the dialog has closed.

## Business logic

### The question

#### Context

See `## Context`. The menu opens and closes the dialog; the dialog is a modal box that holds keyboard focus and ignores clicks outside it, like the dashboard's other confirmations (`ui/confirm-dialog.tsx`).

#### Business logic

The title reads "Remove this project?". While the box below is unticked, the body reads "It leaves the dashboard's list, and its scheduler stops unless you set it to keep running. Nothing in the folder is deleted: your files and your commits stay, and so do OpenAgent's own files there (.openagent, .branches, .agent-runner and the branch agent-data with the agents' records). Add the folder again to bring the project back." Two buttons sit at the bottom right: "Cancel" and, in the destructive style, "Remove". While idle the dialog closes through "Cancel" or the Escape key, and nothing is removed.

### The box

#### Context

**User story**: the user reads what a ticked box will do before they confirm, not in a second dialog after.

#### Business logic

Under the body is one checkbox, "Also delete OpenAgent's files in this folder". It is unticked each time the dialog opens: a box ticked and then cancelled is unticked the next time, and an earlier refusal's message is gone too. While it is unticked, nothing about deleting is said.

Ticked, the body no longer says that nothing is deleted. It reads "It leaves the dashboard's list, and its scheduler stops unless you set it to keep running. Your files and your commits stay. Add the folder again to bring the project back."

A panel appears under the box with three paragraphs:

- "This deletes, on this machine: the agents' checkouts in .branches, the folders .openagent (with hooks.yml, the project's start lines) and .agent-runner, and the local branch agent-data. A tool the project has installed removes its own files too: the scheduler's state, the subagent settings."
- "The agents' conversations go with that branch. If you never shared the records, this is their only copy. If you did, what has not reached the remote yet is lost. An agent that waits for your answer cannot be continued after this." The first sentence is in the stronger text color.
- "It never touches the remote, your files, your commits, a branch with work on it, or a file git tracks. A checkout with uncommitted work stays, and so does .agent-runner/config.yml if you wrote one. A scheduler you set to keep running is not stopped: its files, the records and .openagent then stay. Stop it, add the folder again and remove it once more to delete them. You see the list of what went and what stayed right after."

The confirm button then reads "Remove and delete" in place of "Remove". Unticking the box hides the panel and restores the first body and "Remove".

### Removing

#### Context

**Business logic story**: removing is the daemon's, and so is deleting OpenAgent's files [1] (`src/dashboard-rpc/projects.ts`, `src/daemon-runtime.ts`). The dialog only sends the project's id and whether the box is ticked.

#### Business logic

The confirm button asks the daemon to remove the project by its id, with the files when the box is ticked and without them when it is not. While the request runs, the confirm button reads "Removing…" with a progress cursor, both buttons and the box are disabled, and no keystroke or click closes the dialog.

When the daemon refuses, the dialog stays open and shows the daemon's reason in red, for instance "An agent is working in this project. Stop it, then remove the project.", or "Could not remove the project." when the failure carries no message. The page is not told. The user may confirm again or cancel.

When the daemon answers a removal with no report [2] (the box was unticked, or the project's folder is gone), the dialog closes and the page is told.

### The report

#### Context

**Problem**: the project is already off the list when the report arrives. A dialog that could be dismissed by Escape would take the only account of what was deleted with it.

#### Business logic

When the daemon's answer carries a report [2], the dialog stays open and changes to it. The title reads "Project removed" and the text under it "It left the dashboard's list. This is what happened to OpenAgent's files in the folder."

Then up to three lists, one line per entry:

- "Deleted": every removed path. With nothing removed it reads "Nothing: there was nothing of OpenAgent's to delete."
- "Kept", shown only when something was kept: each line is `<path>: <reason>`, for instance ".branches/agent-1: agent-1 has uncommitted work; the checkout was kept".
- "Could not be cleaned", shown only when something failed, with its title in red: each line as the daemon said it.

The one button is "Done". Escape and every other way of closing do nothing while the report is shown.

### The page is told last

#### Context

**Problem**: the page leaves the removed project once it is told. Leaving while the dialog is still closing would tear it down mid-close.

#### Business logic

After a removal with no report, and after "Done" on the report, the dialog closes first and only then is the page told that the project is removed. The page is told once.
