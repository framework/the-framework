What the tests cover, for the menu that picks the driver [1] and model together:

- **The button shows what is set** - the button carries the current driver's logo and the current model's name, and hovering it spells the driver out ("Claude Code") since the logo alone does not.
- **A model pick sets its driver** - choosing a model inside a driver's submenu reports that driver and that model together.
- **A submenu holds only its own models** - a driver's submenu lists its own models and never another driver's.
- **Nothing pinned names nothing** - with no model pinned the button shows no model name instead of the first one listed, and its tooltip reads "Model: the CLI's own default".
- **An unlisted model is named by its id** - a pinned model the driver's list does not hold (`fable`) shows on the button and in the tooltip as "Model: fable", since the run is still given it.
- **A driver with no models says why** - a driver with an empty list and a note shows the note ("Asking Claude Code…") in its submenu.
- **Named for assistive technology** - even when the button shows only a logo and a chevron, its accessible name reads "Driver: Claude Code · Model: the CLI's own default".

## Glossary

[1] driver: a coding agent wrapped as a black box: start it in a directory, prompt it for one turn, stream what it does, resume it later.
