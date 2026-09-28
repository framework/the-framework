Draws on the Overview the cards the installed modules [1] declare.

## Context

**User story**: a project depends on the queue package, so the Overview shows that package's queue card under the agents at work; a project with no such package sees no queue card at all, instead of an empty one saying "Nothing queued.".

## Glossary

[1] module: a package that adds to the dashboard (pages, Overview cards, side-rail tabs, what an agent's page shows, actions on the links pages show): its browser part, named by the package's `exports["./dashboard"]`, reads its data through its own package's command, or through its own server part, named by `exports["./server"]`, which the daemon calls in its own process. A module comes from a project's dependencies, or is built into the dashboard and loaded for every project, as the Files module is.

## Business logic

Every card the shell mounted (`lib/use-modules.ts`), in the order it mounted them (by the card's order, then its package), is rendered in its own slot (`ModulePageView.tsx`): given the registered projects that have its package, by id and name, leaving out any the dashboard does not currently list; inside the host its `useModuleHost()` reads, bound to its package; and inside a boundary, so a card that throws shows "The `<id>` card failed: `<reason>`" in its place and the other cards and the rest of the Overview keep working. No card declared: nothing is drawn.
