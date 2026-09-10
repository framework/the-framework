Gives every panel in the dashboard the same behavior when it reads something from the daemon: read once, or read on a repeating interval, hold the answer, and never show one selection's answer under another.

## Glossary

[1] project: a repository the user registered in the dashboard, identified by an id derived from its path.
[2] agent: the unit of work: one task worked by a coding agent under The Framework's control, in its own checkout, on its own branch, streaming events, handed off when it ends.

## Business logic — TL;DR

- **Reading once, and again when the subject changes** - a panel reads when it is shown and re-reads whenever what it is about changes, such as another project [1] or another agent [2] being selected.
- **Reading on an interval** - a panel that must stay current re-reads on its own cadence, and stops as soon as it is no longer on screen.
- **Nothing to read yet reads nothing** - a panel with no subject, such as an agent view with no agent selected, makes no request at all and shows its empty state.
- **A failed read keeps the last answer** - the panel is never blanked by a daemon hiccup and the next read usually recovers; an empty bar that means "no answer" would read as "nothing used".
- **A switch clears the previous answer** - by default a panel shows nothing while the next subject loads, rather than the previous subject's data. A panel may opt out of this and keep the previous answer visible, which is what keeps a header from blanking and popping as the user moves between agents.
- **A late answer is dropped** - a read still in flight when the subject changes, or when the panel is gone, never writes its answer.
- **Refreshing on demand** - a panel can re-read immediately after an action of its own, instead of waiting for the next interval, and that refresh is dropped under the same rules.
- **"Not read yet" is distinguishable from "not there"** - a panel can tell whether a successful read has landed for the current subject, which is what lets a link to something that no longer exists say so instead of flashing "gone" while its first read is still out.
