What the tests cover: CI watch — merging the pull requests The Framework is waiting to land, and fixing the ones that go red.

- **Merging on green**: a watched pull request whose checks pass is merged and reported with its address; a pull request GitHub's own auto-merge is armed on is left for GitHub; pending checks produce neither a merge nor a fix.
- **No checks at all**: a pull request younger than the attach grace is not merged, one older than it is, and one whose age cannot be established never is.
- **What is not a candidate**: a pull request that is merged or closed, an agent still running, an agent with no pending merge, an agent already merged directly, and an agent older than the watch window. Two agents pointing at the same pull request cost one check read and at most one merge.
- **Refused merges**: recorded once and not retried while the head commit is unchanged; a new head commit re-arms exactly one more attempt.
- **Starting a fix**: failing checks start one fix agent, told the pull request, its branch, its failing head commit and which checks failed; an auto-armed pull request going red gets a fix too.
- **Fix restraint**: an attempt already recorded for the same head commit stands down; a fix still running holds the next one back whatever commit it was for; the attempts cap stands the sweep down for good and says so; attempts recorded for one pull request never count against another whose number merely starts with the same digits; a checks read with no head commit or branch stands down rather than guessing; a declined start is reported as declined rather than as started; with no fix wiring at all a red pull request is simply left alone.
- **The fix instructions**: they open with the durable attempt marker, land the fix on the pull request's own branch, name the failing checks, and forbid opening a new pull request.
- **The sweep loop**: it sweeps immediately, logs each merge, and says a repeated refusal only once.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
