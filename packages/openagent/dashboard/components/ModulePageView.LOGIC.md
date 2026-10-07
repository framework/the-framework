Renders one module's [1] page in the dashboard's main pane, through the slot every module piece renders in: the host the piece reads, and the boundary that keeps its failure its own. The Overview's cards (`ModuleCards.tsx`) and the Settings page's module sections (`ModuleSettingsSections.tsx`) render through the same slot.

## Glossary

[1] module: a package that adds to the dashboard (pages, Overview cards, side-rail tabs, what an agent's page shows, actions on the links pages show, Settings sections): its browser part, named by the package's `exports["./dashboard"]`, reads its data through its own package's command, or through its own server part, named by `exports["./server"]`, which the daemon calls in its own process. A module comes from a project's dependencies, or is built into the dashboard and loaded for every project, as the Files module is.

## Business logic

The page component is given the registered projects that have its package (by id and name, each with whether one of its packages provides a git host, in the registry's order, leaving out any the dashboard does not currently list) and the URL segments after its own. Around it, the view provides what `useModuleHost()` reads: the module's package, so the page's commands run in that package only, and the shell's services (`lib/host-services.ts`): opening an agent or a page, starting or configuring a run, a project's runs. A page that throws while rendering shows "The `<label>` page failed: `<reason>`" in its place (a card, "The `<id>` card failed: `<reason>`"; a Settings section, "The `<id>` settings failed: `<reason>`"), and the rest of the dashboard keeps working; moving to another module page starts it fresh.
