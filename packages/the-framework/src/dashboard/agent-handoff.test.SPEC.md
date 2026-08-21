The tests cover the whole handoff story: reading a branch's work (empty, bookkeeping-only, gone, unpushed, and no-remote cases, against fakes and real repos), push and PR-opening with git's own reason on failure, the push-free draft PR for a remote-only branch with gh's refusal reported rather than thrown, the armed push/draft-PR/merge combinations including never opening a second PR, the recorded branch and PR winning over re-derivation, merge authorization, and the human Merge action with its refusals.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
