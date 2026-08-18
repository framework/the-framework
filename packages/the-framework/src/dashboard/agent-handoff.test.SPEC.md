The tests cover the whole handoff story: reading a branch's work (empty, bookkeeping-only, gone, unpushed, and no-remote cases, against fakes and real repos), push and PR-opening with git's own reason on failure, the armed push/draft-PR/merge combinations including never opening a second PR, resolving an agent's PR across its candidate branch names and start time, merge authorization, and the human Merge action with its refusals.

## Before modifying/creating SPEC.md files

Always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
