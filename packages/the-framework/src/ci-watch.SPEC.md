Watches the pull requests the framework is waiting to land and acts on what their checks say: merge the green ones, start an unattended fix agent for the red ones.

## TLDR

- Merge-on-green everywhere: the sweep polls a watched PR's checks about once a minute and merges once they pass — repos without GitHub's native auto-merge used to be merged seconds after opening, before their first check ran.
- Red checks start one fix agent per failing head commit, told to land the fix on the PR's own branch; at most two attempts per PR, then the failure is evidently not one an agent can fix and it is left to a human.
- Conservative when unclear: a closed PR is left alone (an unmerged close is a human's rejection), pending checks wait, and "no checks" only counts as green once the PR has outlived the time a check suite takes to attach.
- A PR stays watched for a week; a refused merge is remembered per head commit, so a new push earns exactly one more try.

## Rationales

- Polling rather than webhooks: a local daemon has no public address GitHub could call, and every decision starts from a fresh read, so a hosted deployment could later swap the trigger without changing the handlers.

## Before modifying/creating SPEC.md files

Always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
