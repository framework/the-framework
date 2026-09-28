The browser's typed stubs for the module calls: which modules [1] the registered projects bring (each package once, its module's URL, the projects that have it), and a module running one of its own package's commands in one project, answering the command's JSON or the reason there is none. What each call accepts and refuses is the daemon's, in `src/dashboard-rpc/modules.ts`. The stubs are addressed by the call's name over the dashboard's transport (`lib/rpc.ts`) and declared with the daemon's own signatures, imported for their types only.

## Glossary

[1] module: one of a project's packages that adds to the dashboard, its browser part named by the package's `exports["./dashboard"]`; it adds pages to the dashboard and reads its data through its own package's command.
