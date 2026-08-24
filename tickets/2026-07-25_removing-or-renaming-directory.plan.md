Effort: 3
Uncertainty: 4

# [Plan] What happens when removing (or renaming) a directory

Concrete proposal for how the framework should behave when a registered project's directory no longer exists: surface it as a project error, stop background jobs from misreporting it, and add an explicit "remove project" action — never auto-drop.

## TLDR

Today a vanished project path is invisible-by-accident: the registry keeps the record forever (there is no `removeProject` anywhere — neither API nor UI), `summarizeProject()` swallows every read failure into `activated: false`, and the data-sync background job fails with a misleading git error. Proposal: (1) detect the missing path on the project-list read and surface it through the existing per-project error mechanism (#1500) as a new `path-missing` error code, (2) make the data-sync job skip (or report correctly for) missing paths, (3) add an explicit remove-project action (registry API + dashboard RPC + sidebar/banner affordance) so the user resolves the stale entry deliberately. Renaming is then just "remove the stale entry, add the new path" — the id is path-derived, so a rename is a new project by construction.

## Current behavior (verified in code)

- **Registry keeps the record forever.** `packages/framework/src/registry.ts` has `addProject` / `listProjects` but no removal function at all, and no dashboard surface offers one. A removed or renamed directory leaves a permanent stale entry.
- **The vanished path reads as a merely-inactive project.** `summarizeProject()` (`packages/framework/src/dashboard/projects.ts`) catches every failing read: `activated` → `false`, agents → `[]`, file config → `{}`. The sidebar shows a normal-looking project with no hint its directory is gone.
- **The data-sync job already trips over it, with the wrong words.** `syncProjectData()` (`packages/framework/src/daemon-services.ts`) runs `pullDataBranch` per project every tick; on a missing directory that fails and records a `data-sync` error whose message is a git spawn error — the user is told their data branch is broken when actually the whole directory is gone.
- **A URL naming a removed project is already handled** (`packages/framework/dashboard/App.tsx:301` shows "No project is registered as …"). Only the list itself lies.
- **Renaming = new identity.** A project's id is derived from its path (`registry.SPEC.md`), so the repo at its new path registers as a distinct project. The old entry can only become stale; it can never be "updated in place" without changing the id scheme.
- **Related but separate:** #1142 (`tickets/2026-07-25_bug-files-missing.md`) — the Files tab hides on empty (`RightRail.tsx:106`), which is how this bug cascades into the agent view. That rendering fix belongs to #1142; this ticket fixes the detection/registry side.

## Problems

1. **What is the intended behavior — drop, mark, or re-point?** The ticket explicitly says defining this is part of the fix. Uncertainty is mostly here, not in the implementation.
2. **Where to detect the missing path** — on the read path (a `stat` per project per list poll) vs. in the daemon's background tick (like data-sync).
3. **Is "remove project" a new user-facing feature?** `FEATURES-SPEC.md` forbids adding features without human approval, and the projects sidebar currently has no removal affordance.

## Solutions

### Problem 1 — intended behavior

- **A. Auto-drop the registry entry when the path is missing.** Simplest UX, but wrong: an unmounted volume, a slow network drive, or a transient fs error would silently forget the project (and its `addedAt`). The registry SPEC's whole stance is that reads are forgiving and destructive writes are deliberate. Rejected.
- **B. Mark it gone + explicit removal (recommended).** Keep the record; flag the state through the existing project-errors surface (red dot in sidebar + banner on the project page, already built and already listed in FEATURES-SPEC); let the user remove the entry with one click from the banner. Self-healing in both directions: if the directory comes back (volume remounted), the error clears on the next poll, exactly like `data-sync`.
- **C. Re-point automatically** (find the moved repo by git remote URL or similar). Magic, expensive, and ambiguous when several checkouts share a remote. Out of scope; the rename story is "add the new path, remove the stale entry", which B makes a two-click affair.

### Problem 2 — where to detect

- **A. In `summarizeProject()` (read path).** One `stat` per project per list poll — cheap, always current, works even before any background tick has run. But it would need a new `ProjectSummary` field, duplicating the error surface.
- **B. In the daemon's background services, writing a `path-missing` `ProjectErrorCode` (recommended).** Reuses #1500 end-to-end: `ProjectErrors` store, the list annotation in `onProjects()`, the sidebar dot and banner — zero new wiring to the browser. Cadence: either its own cheap `stat` check at the start of each project's data-sync turn (natural, since that job must skip missing paths anyway — fixing the misleading `data-sync` error in the same move), or a dedicated check on the same tick. In-memory-store staleness (daemon restart) is a non-issue: it re-learns within one tick, by design.
- Verdict: B, with the check folded into `syncProjectData` (or a small wrapper running before it): `stat` first → missing ⇒ set `path-missing`, clear `data-sync`, skip the pull; present ⇒ clear `path-missing`, sync as today.

### Problem 3 — removal affordance

- **A. Banner-only action** ("This project's directory is gone — Remove it from the list"): minimal, appears exactly when relevant. Recommended first step.
- **B. General "Remove project" in project settings/sidebar context menu**: more complete (also covers "I just don't want this listed anymore") but is a broader feature decision.
- Either way it needs: `removeProject(path|id)` in `registry.ts` (run-modify-write mutator, serialized like the others), a dashboard RPC (`sendRemoveProject`), and the FEATURES-SPEC.md update — which per that file's header needs human approval. Recommend asking for approval of A (and optionally B) when implementation starts.

## Considerations

- **Removal must only touch the registry.** No filesystem deletion of any kind — the directory is gone (or, for B in problem 3, belongs to the user).
- **Per-project preferences / routine-project fallback:** `routine project` already "simply falls back" when its id no longer resolves (registry.SPEC.md), so removal needs no cleanup there; verify nothing else stores project ids that would dangle (grep for `projectId` consumers during implementation).
- **Race with a running agent:** removing a project that has live agents should be refused (the daemon knows its `activeAgentSlots`) or at least confirmed — a missing directory can't have live local agents, but a general remove action (3B) could.
- **Symlinks / case-only renames:** detection should `stat` the stored path as-is; `addProject` already dedupes by resolved path, so re-adding after a case-only rename on a case-insensitive fs is idempotent — acceptable.
- **`registerHomeProject` on daemon start** only ever adds; no interaction with removal.
- **Background jobs other than data-sync** (worktree sweep, orphan reconcile at boot) already `.catch(() => …)` on missing paths; optional polish is to skip them for a project flagged `path-missing`, but nothing breaks without it.
- **SPEC updates required** (per SDD): `registry.SPEC.md` (the new mutator), `dashboard-rpc/projects.SPEC.md` (the new RPC + the new error kind riding the list), `project-errors` docs (`ProjectErrorCode` union grows), FEATURES-SPEC.md (the error flag wording already covers data-sync only; the removal action is a new feature → human approval).
- **Tests:** registry mutator (remove, remove-unknown is a no-op, serialization), `syncProjectData` missing-path branch (sets `path-missing`, clears on reappearance, no `data-sync` misfire), RPC-level list annotation, and a UI-level banner/action test alongside the existing project-error rendering tests.

## Implementation

1. **`ProjectErrorCode`**: add `'path-missing'` to `project-errors.ts`; dashboard wording: "The project's directory no longer exists (moved, renamed, or deleted)." with the stored path in the message.
2. **Detection**: in `daemon-services.ts`, before each project's data-sync turn, `stat` the project path. Missing ⇒ `errors.set(path, 'path-missing', …)`, `errors.clear(path, 'data-sync')`, skip the pull. Present ⇒ `errors.clear(path, 'path-missing')` and proceed. (Detection lands even if step 4 waits for approval — the dashboard already renders any project error.)
3. **`removeProject` in `registry.ts`**: run-modify-write mutator, same serialization queue; removes the record by id (id, not path — the dashboard addresses by id); unknown id is a no-op success.
4. **Dashboard**: RPC `sendRemoveProject(projectId)` in `dashboard-rpc/projects.ts` (daemon-wired like `sendAddProject`), and a "Remove from list" action on the `path-missing` banner. Blocked on FEATURES-SPEC approval (problem 3).
5. **SPECs + FEATURES-SPEC.md + tests** as listed under Considerations.
6. Out of scope, tracked elsewhere: the Files-tab hide-on-empty rendering (#1142); any auto-re-pointing of renamed directories.
