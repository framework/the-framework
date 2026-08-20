The single doorway to the dashboard's call surface: everything the browser can ask of the server is exported here.

## Flows

- The table of callable names is built from the modules' own exports, so a call that exists but was never registered — a 400 with nothing to go on — is not a state this can be in: the name *is* the export name.
- It inherits nothing. The name is a path segment off an unauthenticated request, and a table with the usual object behind it answers to `constructor` and its siblings, which are not RPCs.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
