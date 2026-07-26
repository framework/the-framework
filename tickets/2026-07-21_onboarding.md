Priority: 8
GitHub: [#958](https://github.com/gemstack-land/the-framework/issues/958)

# Onboarding

## TLDR

Add an `## Onboarding` section to the overview page: a checklist of integrations — add a project (explicit `add {cwd}` button when CWD is a Git repo, plus `select directory`), populate the AI task queue (done when `TODO_AGENTS.md` isn't empty, with a short explanation of the mechanism), populate `tickets/` (done when non-empty, with an "Import tickets from GitHub" button), add the Discord bot (with description, repeated inside the bot modal), browser notifications, Discord notification webhook. The section is dismissible ("Remove, you can resume the onboarding [in] the settings page"), and a new settings page lists *all* settings plus the onboarding checklist.

## Why it matters

High priority: onboarding is the first-run experience that turns an empty dashboard into a working setup, and each checklist item doubles as discovery for a core mechanism (queue, tickets, bot, notifications). Decision refined in-thread: don't add the CWD implicitly — the user explicitly clicks to add it, for clarity and sense of control (issue re-opened for this).

## Source

Imported from GitHub issue [gemstack-land/the-framework#958](https://github.com/gemstack-land/the-framework/issues/958), created 2026-07-21, label: `priority: high`, 2 comments.

### Original description

New section `## Onboarding` on the overview page:
- Checklist of integrations
  - `<button>Add {process.cwd()} as project</button> or <button>Select & add project directory</button>`
  - Populate the queue of AI tasks (state: done if `TODO_AGENTS.md` isn't empty)
    - Add little description explainaing the `TODO_AGENTS.md` mechanism
  - Populate `tickets/` (state: done if `tickets/` isn't empty)
    - Button "Import tickets from GitHub"
  - Add Discord bot
    - Add little description explainaing what the Discord bot does
    - In the Discord bot modal, show the description a second time (for when the modal isn't accessed via the onboarding checklist)
  - Add Browser notification
  - Add Discord notification (state: done if webhook is set)
  - More?
- Button (or just a cross icon) to remove the `## Onboarding` section from the overview page
  - Button/icon label: "Remove, you can resume the onboarding the settings page"
  - Let's create a new settings page that lists *all* settings, and the Onboarding checklist

### Notes from the GitHub thread

- The CWD is currently added implicitly; changed to explicit user action ("for improved clarity and sense of control" — issue re-opened): show `<button>Add {process.cwd()}</button>` only if CWD is a Git repo, plus `<button>Select directory</button>`.
