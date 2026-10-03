What the tests cover, against the real project [1] registry:

- **A project's recorded faults ride on the projects list** - a project the daemon's background work has recorded a fault against comes back with that fault, its code, its message and the time it was first seen; a project with nothing wrong carries no faults at all, rather than an empty list.

## Glossary

[1] project: a repository the user registered in the dashboard, identified by an id derived from its path.
