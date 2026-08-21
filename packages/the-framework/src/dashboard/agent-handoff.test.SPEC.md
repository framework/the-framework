The tests cover the whole handoff story: reading a branch's work (empty, bookkeeping-only, gone, unpushed, and no-remote cases, against fakes and real repos), push and PR-opening with git's own reason on failure, the push-free draft PR for a remote-only branch with gh's refusal reported rather than thrown, the armed push/draft-PR/merge combinations including never opening a second PR, the recorded branch and PR winning over re-derivation, the PR body carrying the agent's own description of the work and falling back to what was asked for when the agent wrote none, the PR title taken from the agent's own name for the work and falling back to the session's id — never to the prompt it was given — with the ticket's issue reference riding along either way, merge authorization, and the human Merge action with its refusals.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
