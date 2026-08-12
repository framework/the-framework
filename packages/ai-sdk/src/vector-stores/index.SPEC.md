Lets an application manage document stores hosted by an AI provider — create, list, fetch, and delete stores, and attach, remove, and list the files inside one.

## TLDR

- Every operation dispatches to the chosen provider's own store implementation; naming no provider falls back to the registered default, and a provider without hosted stores fails with advice to use local similarity search instead.
- Attaching a file accepts either a file the provider already holds or a local one (uploaded first), and by default waits until the provider has finished indexing it.
- Deleting a store or removing a file leaves the underlying uploads in the provider's file storage — cleaning those up is a separate, deliberate step.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
