The single doorway to the dashboard's call surface: everything the browser can ask of the server is exported here.

## Flows

- The table of callable names is built from the modules' own exports, so a call that exists but was never registered — a 400 with nothing to go on — is not a state this can be in: the name *is* the export name.
- A name that is not an RPC gets a 404 — `constructor` and its prototype siblings included. The table inherits nothing, because the name is a path segment off an unauthenticated request, and a table with the usual object behind it would answer those inherited names as if they were calls.
- The live event stream rides beside the table as a subscription rather than a call.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
