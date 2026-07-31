The ⋮ overflow menu for everything you can DO to a session (#toolbar-menu): GitHub, folder, editor, session link, resume-command copy, Serve, Stop, Merge, Remove worktree, Delete.

## TLDR

- Folds in the old WorkspaceActions row (GitHub / folder / editor / Serve) plus Stop, Remove worktree, Open session and Delete — replacing five-plus icon buttons that came and went with run state; the handoff's Push/Open PR stay outside in the bar.
- Folder item is named for what it actually opens (#1195): `hasOwnFolder = active || retainedWorktree`; once the worktree is gone `resolveRunCheckout` falls back to the project root, so the label flips "Open session's folder" → "Open project folder" rather than lie.
- "Copy resume command" (#1195): `buildResumeCommand(info)` — `mkdir -p <workspace> && cd <workspace> && <driver> --resume <sessionId>` — because the CLI finds a session by the cwd it ran in and the dir is usually gone; recreating it empty suffices to read the conversation back. Menu stays open (`closeOnClick={false}`) so the 1.5s "Copied" flash is visible; without a workspace it degrades to "Copy session id".
- Serve (#475, same as PreviewBar): rehydrates a daemon-side preview via `onPreviewStatus`, lists `onServeTargets`; live URL → Open preview + Stop serving; >1 target → picker submenu; else one-click Serve.
- Stop stays "Stopping…" (`stopRequested && active`) until the end event flips `active`, so it can't be re-fired; reset when `runId` changes. Stop is a pause (#1391): the run ends `stopped` but its conversation resumes from the composer via `--resume` — cancel is just a pause never resumed.
- Merge (#1391, live sessions only): sends `sendMerge` — the human authorization the merge gate (#1363) otherwise collects from the agent's signal; a pre-commitment, so a landed click stays "Merge armed" (`mergeRequested`, reset when `runId` changes). An ended session's merge lives in the bar (`HandoffActions`' Merge PR), not here.
- Remove worktree / Delete only for inactive runs; Delete opens a controlled `ConfirmDialog` (a menu item cannot also be the dialog's trigger) warning history is unrecoverable while branch/PR stay in git; `onDeleted` absent = no delete offered.
- Editor submenu: open in editor + a preferred-editor picker from `useDetectedEditors`, persisted via `updatePreferences({editor})`; a preferred editor not in the detected list is appended as its own row; "Default" = `$FRAMEWORK_EDITOR`, or code.

## Facts

- Serve picker items must sit inside `DropdownMenuGroup`: group parts without `Menu.Group` throw Base UI error #31 and the page error boundary eats the whole view.
- `onGithubUrl` is read with `keepPrevious` so switching projects doesn't flicker the item.
- Session-derived state (`isRunActive`, `sessionInfo`, `describeSessionLink`) comes from folding `events`, not extra reads.
