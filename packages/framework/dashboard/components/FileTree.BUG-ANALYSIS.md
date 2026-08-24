# Bug analysis: packages/framework/dashboard/components/FileTree.tsx

## Business logic (high-level)

The right-rail file tree (#492): builds a collapsible tree from the flat `files` list (git
ls-files, shared with the `#` picker), acts as the Context picker (click toggles `selected` via
`onToggle`), overlays per-file git status polled from the selected agent's worktree (#815, 8s),
rolls status up to folder dots (mixed → modified), previews every file on hover
(`FilePreviewHover`, diff vs contents picked by the tree's own status map), offers a filter box
with a match count and a "no files match" message, and renders nothing when `files` is empty.

Edge cases / invariants checked:

- Status keys are repo-relative slash paths, same vocabulary as `files` — the `status[path]`
  lookup and `foldersFromStatus` agree. One theoretical hazard: `status` is a parsed-JSON object,
  so `status[path]` for a root-level file named after an `Object.prototype` member (`constructor`,
  `toString`, …) returns the inherited function — truthy — making an unchanged file preview as a
  diff ("No change to show.") with no letter. Recorded as a reliance, not a bug: no real repo in
  this system produces such a filename, and `Object.entries` in `foldersFromStatus` only walks own
  properties.
- Untracked files: `files` (ls-files) may not contain a row for an untracked file the status map
  reports; `foldersFromStatus` still dots its ancestor folders, which matches the folder dot's
  weaker claim ("something under it changed"). Whether untracked files appear as rows is the
  files-RPC's concern, not this component's.
- Poll lifecycle: `usePolled` keyed on `[projectId, agentId]` retires in-flight reads and resets on
  agent switch (test-pinned); `EMPTY_STATUS` is module-stable so the `folderStatus` memo does not
  churn on the initial value.
- Hooks are called before the `files.length === 0` early return, so hook order is stable across
  renders where `files` empties.
- `<details>` open state is uncontrolled DOM state keyed by `dir.path`, so it survives status
  polls and filter re-renders for folders that remain visible.

Concern found (see Bugs): filtering narrows the *data* but folders default closed, so matches
nested in never-opened folders remain invisible.

## Functions (low-level)

- `STATUS_TEXT` / `STATUS_DOT` / `STATUS_LETTER`: one colour vocabulary (success/warning/danger ↔
  U/M/D). Correct.
- `Row({icon, gitStatus, badge, className, children})`: icon + name left, letter (file) or dot
  (folder) right, tinted by status. No `title` by design (#1149). Correct.
- `buildTree(paths)`: walks `a/b/c.ts` creating dir nodes for all but the last segment, pushes the
  *full path* into the leaf dir's `files`. Root files land in root.files. No empty-segment inputs
  occur (ls-files paths). Correct.
- `foldersFromStatus(status)`: for each changed file, marks every ancestor dir; a dir seeing two
  different statuses folds to `modified` and stays there (any later status differing from
  'modified' keeps it 'modified'). Matches SPEC "a folder whose changed files disagree reads as
  modified". Correct.
- `byName`: localeCompare on names for dirs; files sorted by full-path localeCompare — inside one
  folder every file shares the prefix, so this orders by name. Correct.
- `FileTree(props)`: status poll (above); `visible` memo filters case-insensitively on the full
  path; `tree` memo rebuilds from `visible`; `renderNode` renders dirs (closed/open icon swap via
  `group-open`) then files (Check icon when selected, letter when changed, hover preview with
  `changed={Boolean(git)}`); zero-hit query renders the "No files match" line instead of an empty
  pane; the tree body scrolls inside itself. Verdict: one suspicious behaviour (Bugs #1),
  otherwise correct.

## Bugs found

1. `L152` (the `<details>` without an `open` prop, interacting with the filter at L140-145): the
   filter narrows which files exist in the tree, but every folder still renders default-closed.
   Scenario: on a repo where everything lives under `src/`, typing `app` in the filter shows
   "1 of 500 files" — and a single collapsed `src` folder; the matched file itself is invisible
   until the user manually expands the chain of folders, so the filter appears to do nothing but
   count. Contradicts the SPEC's promise that the filter makes the tree "usable on a large repo"
   by "narrow[ing] the tree to matching files" (the matches should be findable, and on a deep repo
   they are hidden); product sense for every comparable tree filter is to reveal matches.
   Severity: minor. Confidence: low (the SPEC does not literally promise auto-expansion, so this
   may be accepted behaviour). Fix sketch: when `query.trim()` is non-empty, render each `details`
   with `open` (uncontrolled default-open per render key, e.g. `<details key={dir.path + (q ? '/q' : '')} open={Boolean(q) || undefined}>`),
   so a filtered tree expands the folders on the way to matches and an unfiltered tree keeps the
   user's own open state.

(Recorded reliance, not a bug: `status[path]` inherited-property lookup for pathological root
filenames — see Business logic.)
