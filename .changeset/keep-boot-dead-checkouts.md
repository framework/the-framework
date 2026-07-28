---
'@gemstack/the-framework': patch
---

The startup sweep no longer deletes the checkout of a run that never booted (#1325). A run whose child died before it committed anything leaves a branch with no commits, which `git branch --merged` lists like any landed work, so the sweep removed the checkout and reported the session as merged into the base. That checkout is the evidence of what went wrong, and it was being destroyed for looking like the success it is the opposite of. The local ancestor signal now reclaims a checkout only for a run that finished cleanly; a failed or stopped run, or one whose meta is missing, needs a merged PR to say the work landed. A merged PR still reclaims either way, so nothing that really landed is kept on disk.
