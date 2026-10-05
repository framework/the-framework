Tests of the dashboard shell (`App.tsx`) with module pages, the whole transport stubbed at its one seam and each module a real module the loader imports.

Covered:
- A module's page gets a sidebar row; clicking it moves the address to `/<segment>`, renders the page with the projects that have its package, marks the row as the current one, and makes no project read with the page's segment as a project id.
- An address with a page segment no loaded module claims shows "No such page".
- A module page's `runCommand` asks the daemon to run its own package's command in the named project with the given arguments.
- A package's card is drawn on the Overview, given the projects that have the package, inside a host bound to the package.
- Cards come out by their order, then by package name; a card that throws shows only its own error line, and the other cards still render.
- A card's `startRun` with `land: false` starts the run and leaves the address on the Overview; without it the dashboard lands on the run.
- With no project picked, the Overview's cards, "Human Queue" and working agents and the sidebar's agents are every project's; picking a project in the project select moves the address to `/?project=<id>` and each of them, and the tab title, shows that project's only.
- The pick stays in the address when a module's page or Settings opens, the module's page is given the picked project alone, and a row of the sidebar's list opens that project's agent.
- With a project picked, "New agent" opens its launcher; picking another project there opens that project's launcher, and picking "All projects" keeps the page.
- With no project picked the sidebar lists every project's agents on an agent's page too; picking another project on an agent's page goes to the Overview; on a module's page it drops the segments after the page's word, and keeps the page's own query parameters when there are no such segments, as "All projects" does.
- A `?project=` naming no registered project picks nothing.
- A jump from the all-projects list to another project's agent: the agent's page names the agent at once, from the row that was clicked, while that project's agents are still being read.
