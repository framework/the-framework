Effort: 4
Uncertainty: 3

# [Plan] The Files tab shows a run's changes for as long as they exist, and says so once they are gone

How to make the agent page's Files tab read a run's checkout, then its branch, then its merge commit, and say "gone" when none is left.

## TLDR

Add one run-scoped read, `onAgentTree(projectId, agentId)`. It answers where the run's files come from and what it changed: `{ source: 'checkout' | 'branch' | 'merge', ref?, files, changes }`, or `{ source: 'gone' }`. The Files tab uses it when a run is selected. Reads by ref are plain local git in the project root (`ls-tree`, `diff --name-status`, `show <ref>:<path>`), like the framework's other checkout reads already are. The merge commit comes from the git host provider: `GitHostRequest` gains `mergeCommit`, and skill-github adds `mergeCommit` to its `gh pr list --json` fields. Nothing is fetched and nothing is copied.

## What is there today

- `App.tsx:99` polls `onProjectFiles(projectId, agentId)`. `FileTree.tsx:131` polls `onProjectFileStatus(projectId, agentId)`. Both go through `withAgentPath` → `resolveAgentCheckout` (`src/store/agent-checkout.ts:31`). That falls back to the project root once the checkout is reclaimed. This fallback is the bug.
- The statuses come from `git status --porcelain` (`src/dashboard/file-status.ts`), so only uncommitted changes are marked, even while the checkout exists. Committed work is unmarked today too.
- The hover card reads `onFileDiff` / `onFileContent` against the same resolved checkout (`reads.ts:299`, `reads.ts:338`).
- `RightRail.tsx:96` hides the Files tab when `files` is empty.
- The `#` context picker shares `onProjectFiles`'s list (`App.tsx:99`).
- `onAgentHandoff` (`reads.ts:393`) already resolves the run's branch from its record (`findAgent` + `agentBranchFor`). `resolveAgentPr` (`agent-handoff.ts:160`) already resolves the run's recorded pull request.
- `GitHostRequest` (`src/store/git-host.ts`) has `head` and no merge commit. skill-github asks `gh` for `number,url,state,title,isDraft,headRefName,headRefOid,createdAt,mergedAt` (`skill-github/src/requests.ts:36`).
- The branches provider's `show` reads `refs/heads/<branch>` only (`skill-branches/src/branch-state.ts:79`). A branch that only origin holds answers `exists: false`.

## Decisions

- **A new read, not a changed `onProjectFiles`.** `onProjectFiles` stays the project's list for the `#` picker. Context is for the *next* run, which works from the project, not from a finished run's ref. The tab gets `onAgentTree`, which returns the file list and the changes in one answer. Two polls that can disagree (the list from one source, the marks from another) become one. Rejected: overloading `onProjectFiles` with a union return, which every picker caller would then have to unpack.
- **Ref reads are the framework's own git, in the project root.** The framework already runs git itself for the dashboard's checkout reads (`crawlRepoFiles`, `file-status.ts`, `file-diff.ts`, `file-read.ts`). A read by ref is the same kind of read. Rejected: a new branches-provider verb (`tree <branch>`). It would move the tab's reads into skill-branches for one surface, and the merge commit is not a branch fact anyway.
- **Ref resolution, in order:** `refs/heads/<branch>`, then `refs/remotes/origin/<branch>`, then the merge commit. Each is checked with `git rev-parse --verify --quiet <ref>^{commit}`. The merge commit counts only when it exists locally. The framework never fetches: it polls, and a fetch on a poll is a network call.
- **The merge commit comes from the recorded pull request, by number.** Ask the git host provider for `requests --branch <b> --state merged` and take the one whose number equals the record's `pr.number`. Its new `mergeCommit` gives the SHA. Without a git host, or without a recorded pull request, there is no merge source.
- **Changed paths:**
  - checkout: committed = `git diff --name-status <base>...HEAD` in the checkout. Uncommitted = today's `git status --porcelain`. When a path is in both, uncommitted wins, because that is what is on disk now.
  - branch: `git diff --name-status <base>...<ref>` in the project root.
  - merge: `git diff --name-status <sha>^1 <sha>`. The first parent works for a squash commit and for a true merge commit alike.
  - base: `origin/HEAD`, else local `main`/`master`. This is the same rule as skill-branches' `detectBase`. It gets a small local copy in the framework, because the provider does not expose it.
- **The tree shown is the ref's tree.** For branch and merge, that is `git ls-tree -r --name-only -z <ref>`. A path the run deleted is not in the tree, so it is added to the list and marked deleted, the same way today's tree shows a deleted file. For checkout, it stays `crawlRepoFiles(checkout)`.
- **Marks:** the change type widens from `untracked | modified | deleted` to also carry where the change is. The shape becomes `{ status: 'added' | 'modified' | 'deleted' | 'untracked', committed: boolean }`. The tree draws committed and uncommitted apart: the same letters, with a solid dot for committed and a hollow ring for uncommitted. For branch and merge, everything is committed.
- **Gone:** when there is no checkout, no ref and no merge commit, the answer is `{ source: 'gone' }`. The tab stays visible and shows one line: "This run's changes are gone: its checkout was reclaimed and it left no branch or merged pull request." The tab is not hidden. A hidden tab reads the same as "nothing to see".
- **A run that never recorded a branch** (no `agentBranchFor`) and has no checkout is gone as well.
- **The project scope is unchanged:** no run selected means the project root, via `onProjectFiles` / `onProjectFileStatus`, as today.

## Implementation

1. `src/store/git-host.ts`: add `mergeCommit?: string` to `GitHostRequest` and parse it. `skill-github/src/requests.ts`: add `mergeCommit` to `FIELDS` and map `row.mergeCommit?.oid`. Update both LOGIC.md files and skill-github's SKILL/DECISIONS text if they list the fields.
2. `src/dashboard/agent-tree.ts` (new): `readAgentTree(root, checkout | undefined, agent, gitHost)` → `AgentTree`. It holds the ref resolution, the base detection, the `ls-tree`/`diff --name-status` parsing, and the deleted-path merge. Take a `GitRunner` parameter as `crawlRepoFiles` does, for tests.
3. `src/dashboard-rpc/reads.ts`: `onAgentTree(projectId, agentId)`, forwarded over the relay like its siblings (`relayOr`, and add it to `relay-dispatch.ts` and `index.ts`). The checkout comes from the branches provider's `list` (`findCheckout`), not from `resolveAgentCheckout`, so that no root fallback can happen.
4. Hover reads by ref: `onFileDiff` and `onFileContent` take the tree's `source`/`ref`. With a ref, the diff is `git diff <base>...<ref> -- <path>` (or `<sha>^1 <sha>` for merge) and the content is `git show <ref>:<path>`, both behind the existing `safeRepoPath` guard and 500-line cap. With a checkout, they work as today.
5. Dashboard: `FileTree` takes the tree from `onAgentTree` when `agentId` is set (one poll, 8 s). `RightRail` shows the Files tab for a selected run in every case, and renders the gone line for `source: 'gone'`. A small caption names the source: "From the run's checkout", "From branch `<b>`", "From the merge of #N". Committed and uncommitted marks are drawn apart as described above.
6. Tests:
   - `agent-tree.test.ts` over a real temp repo, one case per source: live checkout with committed and uncommitted changes, local branch, origin-only branch, merge commit (squash and true merge), and gone.
   - Break each case on purpose once to prove it bites.
   - `FileTree.test.tsx` for the gone line and the two mark styles.
7. Docs: update `reads.LOGIC.md` (the "No checkout … answers an empty list" paragraph, `reads.LOGIC.md:141`), `project.LOGIC.md`'s user story, `file-status.LOGIC.md`, `git-host.LOGIC.md` and the new `agent-tree.LOGIC.md`, following the ldd skill. Add or update the Files tab line in FEATURES-SPEC.md if the file exists at that point.

## Considerations

- **Merge commit not fetched yet:** the pull request merged on GitHub, but this machine's `origin/main` is older. The SHA is known, and `rev-parse` fails. Treat it as gone for now. The next poll after any fetch finds it. The gone line should not claim anything beyond "not on this machine". Wording: "…gone from this machine".
- **A branch that was reused (pinned branch):** the branch's tip may hold a later run's commits. The record's branch is still the best ref there is. The since-filter (#1255) applies only to pull requests, and the merge source already matches by the recorded number.
- **A running run** always has a checkout, so nothing changes for it except the new committed marks.
- **Cost:** `ls-tree -r` on a large repo is one git call per poll, the same order as `ls-files` today. The git host `requests` call is a network read. Use the cached lookup that `resolveAgentPr` already goes through (`cachedPrView`), or cache the SHA per run once found: a merge commit never changes.
- **Relay:** a relayed run's tree is read on its device, like every sibling read.
- **Binary files and renames:** read `--name-status` with `-z`. A rename (`R`) marks the new path as added and the old one as deleted, which matches how the tree shows paths that exist.
- **Out of scope:** the Changes section (`onAgentChanges`) has the same root-fallback problem. It should move to the same source in a follow-up, or in this PR if it is cheap: it is the same resolution with numstat.
