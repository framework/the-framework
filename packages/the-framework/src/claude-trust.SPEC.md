Reads and grants Claude Code's own per-folder trust, so that a `web`-target agent never dies on the CLI's interactive "do you trust this folder?" question.

## User story

The user starts an agent on a Claude Code cloud session and expects it to just work. The CLI would otherwise ask a one-time trust question that nobody can answer, because the daemon starts it without a person at the terminal — dooming the agent before it began.

## Business logic — TL;DR

- **Grant trust before the hand-off** - The Framework writes the very trust record the CLI writes when a user accepts its dialog, so the dialog never fires.
- **Reading fails quiet, writing fails loud** - a missing or unreadable trust record simply answers "unknown"; an existing config that cannot be understood is refused rather than overwritten, and the caller falls back to telling the user to accept the dialog themselves.
- **Nothing else in the CLI's config is touched** - other projects, top-level settings and the folder's own other fields are preserved, and a missing config is created carrying only the trust record.

## Business logic

### Granting trust

#### User story

See `## User story`.

#### Business logic

Before handing a task to a cloud session, the project's folder is recorded as trusted in the Claude Code CLI's own configuration, exactly as the CLI records it when a user accepts the dialog.

#### Rationale

Trust was read-only at first: the dashboard warned about it and named the one-time manual step. Any manual setup step breaks the "click and it works" promise for a cloud session, so the framework writes it instead. Starting a cloud-session agent on a project is itself the user's trust decision — the write automates consent already given rather than inventing it.

The configuration file belongs to the CLI, not to The Framework: an existing one that does not parse is left exactly as it is, because destroying a user's CLI configuration is far worse than falling back to asking them to accept the dialog once.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
