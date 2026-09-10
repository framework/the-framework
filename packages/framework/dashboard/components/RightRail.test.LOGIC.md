What the tests cover, for the dashboard's right rail:

- **One stable width** - the rail keeps the same width whatever panel is open, including when a view [1] the agent [2] pushed is on screen and after switching away from it.
- **No project, no rail** - with no project selected the rail is not drawn.
- **The browser panel is only offered where a browser exists** - an agent [2] running on this machine with a browser gets the "Browser" tab; an agent whose location [3] is `actions` never gets it, even when the agent is otherwise marked as having a browser.
- **Tabs explain themselves** - hovering a tab shows what that panel holds, for example that "Docs" holds the `PLAN`/`TODO` files.
- **The launcher's documents are not repeated** - while the project home [4] shows the `PLAN`/`TODO` documents in its main column, the "Docs" tab is withheld and the documents are not even read; every other tab is unaffected, and when documents were the only thing left to show, no rail is drawn at all. On an agent's page the tab is there as usual.
- **Every panel is earned by its content** - a project with no documents has no "Docs" tab, and with nothing else to show has no rail; a surface with a pushed view [1] keeps the rail even when every read comes back empty.
- **A first read still out is not an empty panel** - the tab stays while the first read is in flight, so changing project does not blink the rail out and back in.
- **A panel that loses its content hands over** - when the tab the user picked by hand stops existing, the rail selects the first tab that still has content instead of showing an empty panel.

## Glossary

[1] view: a markdown document an agent pushes to the dashboard's right rail while it works.
[2] agent: the unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends.
[3] location: where an agent's turns run: `local` (this machine), `actions` (a GitHub Actions runner), or `web` (a Claude Code cloud session).
[4] project home: a project's own page with the launcher (the Start form) and its composer (the prompt editor, also used for live chat).
