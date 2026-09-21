Priority: 2
Topics: [dashboard, agent-page, files]

# The Files tab shows a run's changes for as long as they exist, and says so once they are gone

## TLDR

The agent page's Files tab lists the project tree with the run's changes marked. It reads the run's checkout, so once the checkout is reclaimed it falls back to the project root with nothing marked, which reads as "this run touched nothing", or as a bug. The tab should read the checkout while it exists, with committed and uncommitted changes marked apart, and the run's git ref after: the run's branch while it exists, else the merge commit on the default branch that the record's pull request names. Merged or not makes no difference; only whether a ref exists does. When neither a checkout nor a ref exists, the tab says the changes are gone instead of showing the project root.

## Why it matters

A reader opens a finished run to see what it changed. The changes are in git long after the worktree is gone, so the tab can keep showing them. Showing the project root unmarked hides them and looks broken.

## Design

- The source, in this order: the checkout (its commits and its working tree, marked apart) while it exists; the run's branch, local or on origin; the merge commit on the default branch that the run's pull request names. Every source is read through git by ref. Nothing is copied.
- What is shown: the project tree at the run's last commit, with the paths the run changed marked. The changed paths are the diff from the merge base with the default branch to the ref; once the branch is gone, the merge commit's own diff.
- Gone: a run that never pushed and whose checkout was reclaimed has no ref anywhere. The tab says so in one line.
- Low priority: the dashboard is secondary for now, and the panels that extend the agent page are a later concern.
