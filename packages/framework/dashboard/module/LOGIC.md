What the dashboard shares with a module [1]: the `framework/module` module (`index.ts`, the contract and the running services) and the Tailwind half of the dashboard's theme (`theme.css`: the dark variant, the fonts, and the colour utilities that read the page's own tokens), which the dashboard's stylesheet and a module's stylesheet both import, so a module's colours follow the dashboard's theme and its light/dark toggle.

## Glossary

[1] module: one of a project's packages that adds to the dashboard, its browser part named by the package's `exports["./dashboard"]`; it adds pages to the dashboard and reads its data through its own package's command.

The framework package publishes both for module authors outside this repository: `framework/module` as types (its code is always the running dashboard's), and `framework/module.css` as the theme file.
