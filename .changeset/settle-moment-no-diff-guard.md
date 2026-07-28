---
'@gemstack/the-framework': minor
'@gemstack/framework-dashboard': patch
---

The settle moment now follows the #1173 maintainer decisions to the end. A branch with no diff never offers `Open PR` — GitHub would refuse it with "No commits between main and \<branch\>" — and when the session left work uncommitted, that work is named right in the bar (`Nothing committed — index.html left uncommitted.`), with the full list behind the bar's disclosure. The handoff read now carries the pending paths (`RunHandoff.pendingFiles`) instead of a bare count to make that possible. Unattended runs keep committing their work automatically on the way out, so for them the guard is a rare sight; an attended session parked in the chat can be told to commit right below the message.

The push setting the launcher gear no longer shows (one `Open PR` row since #1181) is now really available where the thread said it stays: `the-framework.yml` accepts `autoPushBranch` and `autoOpenPr` beside the other booleans, resolving through the usual layers (flag > yml > default on), narrated like the rest, and feeding the launcher's repo tier. The CLI pair became tri-state to let the file decide when the run says nothing. The postponed `Auto commit` / `Auto push` settings split is deliberately not added.
