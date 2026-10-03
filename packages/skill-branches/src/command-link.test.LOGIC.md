What the tests cover, with real git:

- **A project with nothing installed** - a checkout the package creates holds `node_modules/.bin/branches`, linked to this package's command; the checkout's git status is clean; the command run from there answers the checkout's own status; linking again changes nothing.
- **A project's own copy** - in a project that has its own `branches` command installed, the checkout's command is the project's, not this package's.
