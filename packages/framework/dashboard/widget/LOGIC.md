What the dashboard shares with a widget [1]: the `framework/widget` module (`index.ts`, the contract and the running services) and the Tailwind half of the dashboard's theme (`theme.css`: the dark variant, the fonts, and the colour utilities that read the page's own tokens), which the dashboard's stylesheet and a widget's stylesheet both import, so a widget's colours follow the dashboard's theme and its light/dark toggle.

## Glossary

[1] widget: a browser module one of a project's packages brings to the dashboard, named by the package's `exports["./dashboard"]`; it adds pages to the dashboard and reads its data through its own package's command.

The framework package publishes both for widget authors outside this repository: `framework/widget` as types (its code is always the running dashboard's), and `framework/widget.css` as the theme file.
