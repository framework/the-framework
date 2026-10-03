What the dashboard shares with a module [1]: the `framework/module` module (`index.ts`, the contract and the running services) and the Tailwind half of the dashboard's theme (`theme.css`: the dark variant, the fonts, and the colour utilities that read the page's own tokens), which the dashboard's stylesheet and a module's stylesheet both import, so a module's colours follow the dashboard's theme and its light/dark toggle.

## Glossary

[1] module: a package that adds to the dashboard (pages, Overview cards, side-rail tabs, what an agent's page shows, actions on the links pages show, Settings sections): its browser part, named by the package's `exports["./dashboard"]`, reads its data through its own package's command, or through its own server part, named by `exports["./server"]`, which the daemon calls in its own process. A module comes from a project's dependencies, or is built into the dashboard and loaded for every project, as the Files module is.

The framework package publishes both for module authors outside this repository: `framework/module` as types (its code is always the running dashboard's), and `framework/module.css` as the theme file.
