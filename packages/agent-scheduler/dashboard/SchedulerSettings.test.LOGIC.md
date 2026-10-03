What the tests cover, with a fake dashboard host whose `status` answers a scheduler that ticked once with two scheduled commands:

- **No project, no section** - given no project the section draws nothing.
- **A switch per scheduled command** - each command shows as its own checkbox, "Run /<command> on a schedule", checked as this machine's schedule switch says over its line (a command its line lists off, switched on here, is checked), with the project, the pace and how far its runs publish in its description; unchecking one runs `switch <command> off` in its project.
- **The publish menu** - a command with this machine's pick shows the pick, one nobody picked for shows "As the file says"; the first entry names the line's level ("As the file says (Merge on green)", "As the file says (Nothing)") and is followed by Nothing, Publish branch, Open PR and Merge on green; the description says the level in force; picking Open PR runs `publish <command> pr`, and picking "As the file says" runs `publish <command> file`.
- **No git host package** - in a project without one the menu lists only "As the file says", Nothing and Publish branch.
- **A refused save** - a switch the command refuses shows "The switch was not saved: /<command>: <why>".
- **The spend offset** - with two projects holding different cushions the box shows the loosest, to one decimal; typing a minus sign, then a number, then one far out of range, shows −50 once the box loses the focus and saves `offset -- -50` once in each project, only the resting value.
- **A refused offset** - shows "The spend offset was not saved: <project>: <why>" and the box shows the saved value again.
- **A project that cannot be read** - shows "<project>: the scheduler could not be read: <why>" and no "Spend offset" row.
