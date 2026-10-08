Draws on the Overview the cards the installed modules [1] declare, each only when one of the projects the Overview shows has the card's package.

## Context

**User story**: a registered project depends on the queue package, so with "All projects" in the project select the Overview shows that package's queue card under the agents at work. When no registered project depends on the queue package, the Overview shows no queue card, instead of an empty one saying "Nothing queued.". When the user picks a project that does not depend on the queue package, the Overview shows no queue card, even though another registered project depends on it.

## Glossary

[1] module: a package that adds to the dashboard (pages, Overview cards, side-rail tabs, what an agent's page shows, actions on the links pages show, Settings sections): its browser part, named by the package's `exports["./dashboard"]`, reads its data through its own package's command, or through its own server part, named by `exports["./server"]`, which the daemon calls in its own process. A module comes from a project's dependencies, or is built into the dashboard and loaded for every project, as the Files module is.

## Business logic

The Overview gives the projects it shows: every registered project, or, when a project is picked in the project select, that project alone. A card is drawn only when at least one of those projects has its package, so with a project picked the cards of the packages that project does not have are not drawn. Until the registered projects are first read the Overview gives none, so no card is drawn. Every card that is drawn, in the order the shell mounted the cards (`lib/use-modules.ts`: by the card's order, then its package), is rendered in its own slot (`ModulePageView.tsx`): given those of the projects the Overview gives that have its package, by id and name, each with whether it has a git host package; inside the host its `useModuleHost()` reads, bound to its package; and inside a boundary, so a card that throws shows "The `<id>` card failed: `<reason>`" in its place and the other cards and the rest of the Overview keep working. No card declared: nothing is drawn.
