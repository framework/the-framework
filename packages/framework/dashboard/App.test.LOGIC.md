Tests of the dashboard shell (`App.tsx`) with widget pages, the whole transport stubbed at its one seam and each widget a real module the loader imports.

Covered:
- A widget's page gets a sidebar row; clicking it moves the address to `/<segment>`, renders the page with the projects that have its package, marks the row as the current one, and makes no project read with the page's segment as a project id.
- An address with a page segment no loaded widget claims shows "No such page".
- A widget page's `runCommand` asks the daemon to run its own package's command in the named project with the given arguments.
- A package's card is drawn on the Overview, given the projects that have the package, inside a host bound to the package.
- Cards come out by their order, then by package name; a card that throws shows only its own error line, and the other cards still render.
- A card's `startRun` with `land: false` starts the run and leaves the address on the Overview; without it the dashboard lands on the run.
