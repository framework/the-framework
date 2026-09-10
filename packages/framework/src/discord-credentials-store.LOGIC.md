Keeps the Discord webhook the user saves from the dashboard in the registry [1], next to the daemon token, under the rules in `discord-credentials.ts`: it reports which credential exists and where it came from, refuses to save what the daemon's environment already sets or what cannot work, and makes a successful save take effect on the running daemon at once rather than at its next restart.

## Context

**User story**: the user pastes a webhook URL into the dashboard's Discord dialog and notifications start flowing immediately; the user clicks "Remove" and they stop. When the daemon's environment sets `DISCORD_WEBHOOK`, the dialog says so and offers no edit.

**Problem**: a value written to the file while the environment sets the same credential would be shadowed on the next read, so the write must be refused rather than accepted and ignored; and a reload of the daemon's Discord services must never read the value it is replacing.

## Glossary

[1] registry: `~/.the-framework.json`, where the user's dashboard settings (their preferences) are kept; it also lists the projects.

## Business logic — TL;DR

- **Status from the environment and the file** - the reported origin follows the precedence rule; a registry that cannot be read counts as holding no credential.
- **A credential the environment sets is not editable** - the save is refused with "DISCORD_WEBHOOK is set on the daemon, so this is not editable here." and nothing is written.
- **Invalid values are refused before anything is written** - a value that fails validation returns its error; a clearing needs no validation.
- **A save that mentions nothing succeeds without writing** - an empty patch is a success with no write.
- **A write that fails says "failed to save"** - the file is untouched and the user sees that one sentence.
- **The running daemon is told after the write** - the daemon's Discord services are rebuilt against the saved value only once it is on disk; a rebuild that fails does not fail the save.

## Business logic

### Status from the environment and the file

#### Context

See `## Context`.

#### Business logic

The status is computed from the daemon's environment and the secrets section of the registry [1], by the precedence rule in `discord-credentials.ts`: `env` when `DISCORD_WEBHOOK` is set, `stored` when only the file holds a webhook, absent otherwise. A registry that is missing or cannot be read counts as holding no credential, so the status still answers.

### A credential the environment sets is not editable

#### Context

**Problem**: the write would land in the file and be shadowed by the environment on the next read, which is worse than saying no.

#### Business logic

When the patch sets or clears a credential whose environment variable holds a non-blank value, the whole save is refused with "DISCORD_WEBHOOK is set on the daemon, so this is not editable here." and nothing is written to the file.

### Invalid values are refused before anything is written

#### Context

See `## Context`.

#### Business logic

A value in the patch is validated as `discord-credentials.ts` prescribes before any write; the first failing credential's error is the save's answer, and the file is untouched. An explicit null (a clearing) is not validated: clearing is always legal.

### A save that mentions nothing succeeds without writing

#### Context

See `## Context`.

#### Business logic

A patch that mentions no credential is a success and touches neither the file nor the running daemon.

### A write that fails says "failed to save"

#### Context

See `## Context`.

#### Business logic

When writing the registry [1] fails for any reason, the save answers "failed to save" and nothing else changes.

### The running daemon is told after the write

#### Context

**User story**: a pasted webhook starts the daemon's Discord services on the spot instead of at the next restart, which is what makes enabling Discord finishable from the dashboard.

#### Business logic

After a successful write, the daemon's Discord services are asked to rebuild against the credentials as they are now (the daemon passes its reload; see `daemon-services.ts`). The reload runs strictly after the write, so it can never read the value it is replacing. A reload that fails or throws does not fail the save: the credential is stored, the answer is success, and the next daemon start uses it.
