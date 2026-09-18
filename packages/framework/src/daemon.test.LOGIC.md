What the tests cover, against a real daemon bound to a free port:

- **Process liveness** - the running process counts as alive and an unused process id as dead.
- **Serving and shutting down** - the dashboard comes up on `127.0.0.1` on the port asked for, reports its process id and URL, and serves the dashboard's shell at that URL; when the shutdown signal fires the daemon exits and the port is free again; a directory with no `.the-framework/` yet is enough to come up in.
- **The projects' hooks** - a project whose `.the-framework/hooks.yml` names open and close lines has every open line run in the project, in order, once the dashboard has reported its URL, a line that exits non-zero not stopping the next; its close line runs at shutdown; each line's outcome is logged with the project's name, the line and its exit code.
- **A Start runs the project's start hook** - a Start from the dashboard runs the project's own `start` line with the prompt and the user's picks in its environment and answers the id the line printed; an empty prompt and an unknown project are refused in words; a project whose hooks file has no `start` line answers "this project has no start hook".
- **Nesting** - a path counts as nested only when strictly inside another: not when equal, not the parent, not a sibling tree, not a name that merely shares a prefix.
- **Registering the home project** - an activated directory nested inside a project already registered is not added as a second project; an activated directory that is not nested is added.
