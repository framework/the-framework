What the tests cover, against the real project [1] registry:

- **A project's recorded faults ride on the projects list** - a project the daemon's background work has recorded a fault against comes back with that fault, its code, its message and the time it was first seen; a project with nothing wrong carries no faults at all, rather than an empty list; the local only note rides the list the same way, present only while it is set.
- **The branches an agent can start from** - against a real repository: the launcher's read names origin's default branch and the branch the project's folder is on, the same name twice when the folder is on the default branch itself; it names neither when the repository has no remote, when the start line does not mention `BASE` (a line that mentions `BASELINE` does not count, a person's own line that mentions `$BASE` does), and when the folder is on no branch; a project with no hooks file answers no start hook and no branches, and an unknown project answers nothing.

## Glossary

[1] project: a repository the user registered in the dashboard, identified by an id derived from its path.
