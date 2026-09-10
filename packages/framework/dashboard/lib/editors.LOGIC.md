Supplies the list of code editors installed on the daemon's machine, which is what the "Preferred editor" picker offers on the Settings page, in a project's action bar and in an agent's [1] actions menu. The list is asked for once when the dashboard loads, and is empty until the daemon answers. A dashboard served by a machine with no checkout [2] of its own to open reports no editors at all, so the picker offers only its "Default" row. What the picker does with the list, including keeping a row for an editor the user set by hand, is in `PreferredEditorItems.tsx`.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent under The Framework's control, in its own checkout, on its own branch, streaming events, handed off when it ends.
[2] checkout: an agent's own working copy of the project, or the user's own working copy of it.
