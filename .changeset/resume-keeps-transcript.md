---
'@gemstack/framework-dashboard': patch
---

Resuming an ended session no longer blanks its transcript, and a stopped session offers a Resume button (#1391). The flicker had two layers: the continuation bumped the new-run feed reset even though a resume appends to the same journal (nothing truncates, so nothing re-replays), and `currentRunEvents` sliced the live feed at the resume's second `session` boundary, hiding the pre-resume transcript until the run ended again. The Resume button is the composer's own continuation with a stock prompt — same run, same branch, same agent conversation — offered when the run ended stopped and reported a session id.
