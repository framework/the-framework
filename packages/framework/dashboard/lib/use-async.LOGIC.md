Gives every panel in the dashboard the same behavior when it reads something from the daemon: read once, or read on a repeating interval, hold the answer, and never show one selection's answer under another.

## Glossary

[1] project: a repository the user registered in the dashboard, identified by an id derived from its path.
[2] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch, started through the project's start hook and shown in the dashboard from the files its tool keeps.

## Business logic — TL;DR

- **Reading once, and again when the subject changes** - a panel reads when it is shown and re-reads whenever what it is about changes, such as another project [1] or another agent [2] being selected.
- **Reading on an interval** - a panel that must stay current re-reads on its own cadence, and stops as soon as it is no longer on screen.
- **Nothing to read yet reads nothing** - a panel with no subject, such as an agent view with no agent selected, makes no request at all and shows its empty state.
- **A failed read keeps the last answer** - the panel is never blanked by a daemon hiccup and the next read usually recovers; an empty bar that means "no answer" would read as "nothing used".
- **A switch clears the previous answer** - by default a panel shows nothing while the next subject loads, rather than the previous subject's data. A panel may opt out in one of two ways: keep the previous answer, whatever subject it was for, where blanking would only flicker (the git host's page of a project); or remember answers per subject, described next. This holds from the very first frame after the switch: the answer for the new subject (the remembered one, or nothing) is chosen while that frame is drawn, not a frame later.
- **Remembering answers per subject** - a panel may name each subject with a key; every answer is then remembered under its key for as long as the page is open, or until the panel drops it because the subject is known to have changed. Going back to a subject shows its remembered answer from the first frame, counted as read, and the read is made again all the same, so the fresh answer replaces it the moment it lands. A subject never read shows nothing, never another subject's answer. A panel with nothing to read shows nothing remembered. At most 500 answers are remembered; past that the oldest is forgotten first. This is what lets a person switch back and forth between agents [2] and see each one's facts at once.
- **A late answer is dropped** - a read still in flight when the subject changes, or when the panel is gone, never writes its answer.
- **Refreshing on demand** - a panel can re-read immediately after an action of its own, instead of waiting for the next interval, and that refresh is dropped under the same rules. The panel is told when the refresh has answered.
- **"Not read yet" is distinguishable from "not there"** - a panel can tell whether a successful read has landed for the current subject, which is what lets a link to something that no longer exists say so instead of flashing "gone" while its first read is still out.
