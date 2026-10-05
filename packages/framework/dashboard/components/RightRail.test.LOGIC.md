What the tests cover, for the dashboard's right rail, with a stand-in for the Files module's tab installed for one project unless a test installs none:

- **One stable width** - the open rail is half the page wide, and keeps the same width whatever panel is open, including when a view [1] the agent [2] pushed is on screen and after switching away from it.
- **No project, no rail** - with no project selected the rail is not drawn.
- **Tabs explain themselves** - hovering a tab shows what that panel holds, for example that "Docs" holds the `PLAN`/`TODO` files.
- **The documents on the project home [4]** - with no agent [2] selected, the project's `PLAN`/`TODO` documents are read and the open rail offers the "Docs" tab: with no module installed it is the open tab and shows the document, and beside a module's tab a click on it shows the document; with no document and no module installed, no rail is drawn.
- **The rail's own panels are earned by their content** - a project with no documents has no "Docs" tab, and with no module installed and nothing else to show has no rail; a surface with a pushed view [1] keeps the rail even when every read comes back empty; a module's "Files" tab is offered even with no documents.
- **A first read still out** - with no other tab, the "Docs" tab holds the rail while the first read is in flight, so changing project does not blink the rail out and back in; beside a module's tab it is not shown until the read answers, and not at all when the answer is empty; a project read before shows its "Docs" tab from the first frame, while it is read again.
- **A panel that loses its content hands over** - when the tab the user picked by hand stops existing, the rail selects the first tab that still has content (the module's "Files" tab) instead of showing an empty panel.

- **A module's tab** - comes first and is open by default; it is given the project, the agent [2] whose page this is, and the Context's files only, without a project path the launcher put in the Context, and its label counts those files; a project that does not have the module shows no tab of it; a tab that throws shows its own error line while the rest of the rail stays.
- **Open and closed** - with nothing remembered the rail is one button, with no tab and no panel, and its module's tab is not drawn at all; the button opens the rail and the browser remembers it for that agent, so that agent's page shows it open from the start the next time; another agent's page starts closed, and closing the rail there leaves the first agent's open; the "New agent" page has its own answer, apart from every agent's; open, the same button closes it and that is remembered too; with no tab to show there is no button. The other tests run on an open rail.

## Glossary

[1] view: a markdown document an agent pushes to the dashboard's right rail while it works.
[2] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch, started through the project's start hook and shown in the dashboard from the files its tool keeps.
[4] project home: a project's own page with the launcher (the Start form) and its composer (the prompt editor, also used to say something to an agent).
- **A changed file asked for from the chat** - an ask opens a closed rail on the tab that lists changes, which is handed the file, and another tab opened afterwards is handed none; a tab picked by hand after the ask stays, and a second ask for the same file shows the tab that lists changes again; an ask made on another agent's page is not this page's: the tab that lists changes is handed no file. An ask moves the rail once: met again on coming back to its page, it does not undo a tab picked by hand.
