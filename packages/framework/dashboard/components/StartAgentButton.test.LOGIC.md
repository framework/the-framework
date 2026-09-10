What the tests cover, for the dashboard's shared start button:

- **The two halves do different things** - pressing the button half starts the agent [1] and hands the launcher [2] nothing; choosing "Configure first, then run" from the chevron opens the launcher and starts nothing.
- **The prompt survives the trip** - the launcher opens with the button's own prompt verbatim, carried across the navigation, so the user never lands on an empty editor.
- **A start in flight does not lock the way to the settings** - the button half is out while a start is in flight, and the chevron stays open and still opens the launcher.
- **Nothing to act on shuts both halves** - with no project to act on, neither the button nor the chevron can be pressed.
- **Busy is per button** - only the button whose own start is in flight shows the busy label "Starting…" in place of its own.
- **The menu entry speaks for its surface** - the second line under "Configure first, then run" is the offering surface's own description of the trip, for example that the launcher starts one agent rather than the whole fan-out [3].
- **An icon-only button still has a name** - on the dense rows, where there is no room for a label, the button half and the chevron each keep an accessible name, and the hover still says what the press costs.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends.
[2] launcher: the Start form on a project home — a project's own page with the launcher and its composer (the prompt editor, also used for live chat).
[3] fan-out: starting several agents at once, one per queue entry or one per ticket to plan.
