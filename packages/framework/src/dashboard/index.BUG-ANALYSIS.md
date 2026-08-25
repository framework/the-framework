# Bug analysis: packages/framework/src/dashboard/index.ts

## Business logic (high-level)

The barrel for the whole `dashboard/` directory: the one import site the rest of the daemon uses
instead of reaching into individual modules. No logic, no side effects beyond the re-exported
modules' own top-level initialisation.

Two things worth checking in a file like this, and both hold:

**1. Does importing the barrel pull in something that should not be loaded?** Every module here is a
daemon-side module (they read the store, spawn `git`/`gh`, and open HTTP handlers), so there is no
browser-bundle concern — that is what `keys.ts` and `client.ts` exist for, and neither is re-exported
here. Two of the re-exported modules do hold process-wide mutable state that is created on import:
`bridge-starts.ts` (`bridgeStarts`) and `bridge-store.ts` (`bridgeQuestions`), both of which also
export a `reset*` function for tests. Importing the barrel therefore constructs those singletons.
Since the daemon imports them anyway, and the test suites import the modules directly, this costs
nothing.

**2. Do the names actually exist?** The re-exports are all named (no `export *`), so a renamed or
removed export is a compile error rather than a silent `undefined` at runtime. Two aliases are written
as no-op renames — `type ActiveAgent as ActiveAgent` and `type RecentAgent as RecentAgent` (L17) —
which are legal and mean exactly the same as writing the name once. Redundant, not wrong.

**3. `safeRepoPath` has two homes.** It is defined in `file-read.ts` and re-exported from
`file-diff.ts` (which that file's comment explains: `file-diff.ts` was the original import site).
The barrel re-exports it from `file-diff.js` (L21) rather than from `file-read.js` (L22). Both resolve
to the identical function object, so there is no divergence — the only cost is that a reader has to
follow one extra hop. Not a defect.

**Coverage of the directory.** A handful of modules are deliberately absent from the barrel:
`cache.ts`, `content-type.ts`, `keys.ts`, `interventions`' Discord internals beyond what is listed,
`relay-endpoints.ts`, `remote-run.ts`, `open-in-app.ts`, `projects.ts`' internals, and so on. Those
are either imported directly by their one consumer or are browser-shared leaves. Nothing here claims
to be exhaustive, so an omission is a design choice rather than a bug — and a *wrong* omission would
show up as an import error at the consumer, not as silent misbehaviour.

## Functions (low-level)

None — the file contains only `export { … } from '…'` statements. Each line is a re-export of a value
and/or type from a sibling module:

- **Server and transport** (L1, L11-13, L48-51): `startDashboard`, the RPC mount and its same-origin /
  expected-host guards, the static bundle server, the bridge and web-start endpoint mounts.
- **Projections** (L4-10, L14-19, L36-46): projects, docs, tickets, queue, overview, dashboard,
  git status, interventions, activity, open questions.
- **Reads and actions** (L20-22, L23-35): the `gh` surface, file diff/contents, and the handoff engine
  (push, open PR, merge).
- **Types only** (L2): the RPC-facing option and result shapes.

Each is a pure re-export, so there is no input, output or edge case to analyse beyond existence, which
the type checker enforces.

*Verdict:* correct.

## Bugs found

None found.
