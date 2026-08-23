What the tests cover: nothing reachable from the dashboard's browser-safe entry imports a Node built-in — the entry's whole contract, since a single leaked import breaks the browser bundle. The check walks the real import graph of the compiled output that actually ships, so a type-only reference (erased at compile time) never reads as a false leak, and a real leak is reported with the file and the import that caused it.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
