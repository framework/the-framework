Draws on the Settings page the sections the installed modules [1] declare, after the page's own.

## Context

**User story**: a project depends on the orchestration package, so the Settings page shows that package's Subagents section after "Claude web"; a dashboard where no project has such a package shows nothing there.

## Glossary

[1] module: a package that adds to the dashboard (pages, Overview cards, side-rail tabs, what an agent's page shows, actions on the links pages show, Settings sections): its browser part, named by the package's `exports["./dashboard"]`, reads its data through its own package's command, or through its own server part, named by `exports["./server"]`, which the daemon calls in its own process. A module comes from a project's dependencies, or is built into the dashboard and loaded for every project, as the Files module is.

## Business logic

Every Settings section the shell mounted (`lib/use-modules.ts`), in the order it mounted them (by the section's order, then its package), is rendered in its own slot (`ModulePageView.tsx`): given the registered projects that have its package, by id and name, each with whether it has a git host package, leaving out any the Settings page was not given; inside the host its `useModuleHost()` reads, bound to its package; and inside a boundary, so a section that throws shows "The `<id>` settings failed: `<reason>`" in its place and the other sections and the rest of the page keep working. No section declared: nothing is drawn.
