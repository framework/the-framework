The checkout action buttons: open on GitHub (#489), in the file manager or an editor (#490), and Serve (#475) — one component for both the project home and a session (#809).

## TLDR

- `runId` absent acts on the project's tree; present, every action addresses that session's worktree via `sendOpenInApp(projectId, target, runId)` — opening a session in your editor is the whole point of a worktree, and the session page was the one place you couldn't.
- GitHub link is the project's either way (a session is a branch of the same repo; its branch may not be pushed yet — the PR shows in git status); read with `keepPrevious` so the icon doesn't pop out and shove the row on project switch.
- Editor button is a dropdown (#727): "Open" plus a Preferred-editor picker persisted via `updatePreferences({editor})`; a stored editor not in `useDetectedEditors` (a hand-set `$FRAMEWORK_EDITOR`) is appended as a custom row so the choice always appears; "Default" clears to `$FRAMEWORK_EDITOR`, or code.
- `PreviewBar` (Serve) targets the same checkout (#797); action errors are reset on project/run switch (the last checkout's failure must not sit next to the new one's actions).

## Facts

- Largely superseded in the session bar by `SessionActionsMenu` (which folded these actions into the ⋮ menu); this row form remains for the project home.
