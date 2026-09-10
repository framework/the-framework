The "Preferred editor" group of menu rows, shared by the project home's [1] action bar and an agent's [2] "⋮" menu, that picks which editor "Open in editor" uses and stores the choice in the preferences [3]. The rows are "Default" ("$FRAMEWORK_EDITOR, or code": whatever the daemon's `FRAMEWORK_EDITOR` environment variable names, else `code`) and one row per editor detected on the daemon's machine, each showing the editor's label and its command; a stored editor that is not among the detected ones (a hand-set command) still gets its own row, so the current choice always has a row. A checkmark marks the stored choice, or "Default" when none is stored; picking a row writes it at once without closing the menu, so the pick is visibly confirmed. The rows are disabled while the surface is busy.

## Glossary

[1] project home: a project's own page with the launcher (the Start form) and its composer (the prompt editor, also used for live chat).
[2] agent: the unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends.
[3] preferences: the user's dashboard settings, kept in the registry (`~/.the-framework.json`, which also lists the projects).
