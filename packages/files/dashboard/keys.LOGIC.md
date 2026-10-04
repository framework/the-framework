The names the Files module's reads are remembered under, so a tab shows at once what was read last while it is read again.

## Context

**User story**: the user has the side panel open on an agent and goes from the Changes tab to the Files tab and back. Each tab shows its content at once.

**Problem**: a tab that is opened starts with nothing read. Until its first read answered, about a tenth of a second, it said "Looking for this run’s changes…", on every switch of tab and every return to an agent seen before.

**Business logic story**: the dashboard's polled read can remember its last answer under a name and show it at once the next time something reads under the same name. The two tabs read the same things, so they share the names.

## Business logic

One name per thing read:

- the project's own files: `files:project:<project id>`;
- an agent's files: `files:tree:<project id>:<agent id>`;
- an agent's commits: `files:commits:<project id>:<agent id>`;
- what one commit of an agent changed: `files:commit:<project id>:<agent id>:<commit id>`.

The Changes tab and the Files tab read an agent's files, and the project's files, under the same name: what one tab read is what the other shows first. A remembered answer is only shown while the read is made again; the new answer replaces it.
