Hovering a file in the tree shows what is in it — a changed file's diff, an unchanged file's contents — read from the selected agent's worktree.

## TLDR

- Nothing is read until a card actually opens, so the tree's many hover targets cost nothing for files never pointed at.
- An open card re-reads every few seconds, keeping up with an agent that is still editing instead of freezing at hover time.
- The status the tree already holds decides diff-versus-contents, so the server is not asked the same question twice; binary, empty, cut-off, and unreadable files are named as such rather than shown raw or left on a spinner.

## Before modifying/creating SPEC.md files

Always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
