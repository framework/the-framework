What the tests cover, for the dashboard's right rail:

- **One stable width** - the rail keeps the same fixed width.
- **No project, no rail** - with no project selected the rail is not drawn.
- **Tabs explain themselves** - hovering a tab shows what that panel holds, for example that "Docs" holds the `PLAN`/`TODO` files.
- **The launcher's documents are not repeated** - while the project home [1] shows the `PLAN`/`TODO` documents in its main column, the "Docs" tab is withheld and the documents are not even read; the "Files" tab is unaffected, and when documents were the only thing left to show, no rail is drawn at all. On an agent's page the tab is there as usual.
- **Every panel is earned by its content** - a project with no documents has no "Docs" tab, and with nothing else to show has no rail; a project with files keeps the rail, on its "Files" tab, even when the documents read comes back empty.
- **A first read still out is not an empty panel** - the tab stays while the first read is in flight, so changing project does not blink the rail out and back in.
- **A panel that loses its content hands over** - when the "Files" tab the user picked by hand stops existing because the files are gone, the rail selects "Docs" instead of showing an empty panel.

## Glossary

[1] project home: a project's own page with the launcher (the Start form) and its composer (the prompt editor, also used to say something to an agent).
