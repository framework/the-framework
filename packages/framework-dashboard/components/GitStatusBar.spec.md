The checkout status row (#491/#809, part of #488): active branch, clean/dirty dot, linked PR — one component for both the project home and a session, polled so it tracks commits and branching.

## TLDR

- With `runId` reads `onRunWorktree` (adds worktree path, `own`, on-disk size); without, `onGitStatus` for the project checkout. Same shape either way, so one render path — a session used to have its own differently-styled chip and either could drift with an edit to the other (#809).
- Polls at 10s, dropping to 1s while `status.prPending` (#1028): the in-flight PR lookup answers in under a second, not worth a ten-second gap.
- Polls with keep-previous so the left cluster (branch/dirty/PR/chevron) updates in place on session switch instead of vanishing to null and popping back.
- `label`/`projectName` render a `project / session` breadcrumb identity (#1030); the branch then drops to muted context with its `the-framework/` prefix stripped (tooltip and copy keep the real name).
- `summary`, `runState`, `expanded`/`onToggle` make this row the one place a session's branch is spoken about (#1023): the facts become a disclosure expanding caller-rendered detail below, instead of a second card repeating the branch.
- Renders null with no status (no git repo, or the relay with no local checkout); PR renders as an external link with a state pill and title tooltip.

## Decisions

- Clean is a neutral dot, not green: green means "added/new/done" everywhere else, and a green "nothing changed" sat one pane from the file tree's green "has changes" folder dot — same colour, opposite facts.
- One flat row where exactly one element gives up width (the label; with no label, the branch); everything else is shrink-0 and drops out at container breakpoints (@2xl/@4xl/@5xl) instead of squeezing to mush (#1026). `projectName` and the beside-a-label branch use `shrink-[999]` so they truncate before the session name does.
- The session name leads as the identity (#1030): the rail calls the run by it and it doesn't change under you, unlike the branch, which the agent renames near the end (#736).
- The disclosure `<button>` wraps only the facts: the PR link and copy control are interactive in their own right and can't sit inside a button.
- Dirty wording tracks ownership: a session's worktree is the agent's tree ("Uncommitted changes in this session"), the project checkout is the user's.
- `overflow-hidden` on the inline wrapper: on a too-narrow pane the branch is cut off rather than painted over the buttons beside it (#1026).

## Facts

- Worktree vs project status discriminated by `'path' in status`.
- Size renders only when the server priced it (`sizeBytes` set — omitted for a live session still being written, #798), and only at @4xl+.
