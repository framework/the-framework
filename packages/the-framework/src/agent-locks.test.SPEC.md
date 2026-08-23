What the tests cover: actions against one checkout run one at a time and in arrival order, with a waiting action held back for as long as the one ahead of it is still running; actions against different checkouts run independently and never wait on each other; a failed action reports its own failure and neither cancels nor blocks the action queued behind it; two different spellings of the same checkout path are recognised as one checkout and contend with each other.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
