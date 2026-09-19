The browser's typed stubs for the widget calls: which widgets [1] the registered projects bring (each package once, its module's URL, the projects that have it), and a widget running one of its own package's commands in one project, answering the command's JSON or the reason there is none. What each call accepts and refuses is the daemon's, in `src/dashboard-rpc/widgets.ts`. The stubs are addressed by the call's name over the dashboard's transport (`lib/rpc.ts`) and declared with the daemon's own signatures, imported for their types only.

## Glossary

[1] widget: a browser module one of a project's packages brings to the dashboard, named by the package's `exports["./dashboard"]`; it adds pages to the dashboard and reads its data through its own package's command.
