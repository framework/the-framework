What the tests cover, against the real project [1] registry:

- **A project's recorded faults ride on the projects list** - a project the daemon's background work has recorded a fault against comes back with that fault, its code, its message and the time it was first seen; a project with nothing wrong carries no faults at all, rather than an empty list.
- **A schedule switch runs the project's switch hook** - with no hooks file the answer is "this project has no switch hook in .the-framework/hooks.yml"; with a `switch` line the line gets the command's name and `on`, and the answer is done; a project id that names no registered project is "unknown project".

## Glossary

[1] project: a repository the user registered in the dashboard, identified by an id derived from its path.
