What the tests cover, with a fake dashboard host whose `status` answers a scheduler that ticked once with two scheduled commands:

- **No project, no section** - given no project the section draws nothing.
- **A switch per scheduled command** - each command shows as its own checkbox, "Run /<command> on a schedule", checked as this machine's schedule switch says over its line (a command its line lists off, switched on here, is checked), with the pace and how far its runs publish in its description; unchecking one runs `switch <command> off` in its project.
- **The publish menu** - a command with this machine's pick shows the pick, one nobody picked for shows "As the file says"; the first entry names the line's level ("As the file says (Merge on green)", "As the file says (Nothing)") and is followed by Nothing, Publish branch, Open PR and Merge on green; the description says the level in force; picking Open PR runs `publish <command> pr`, and picking "As the file says" runs `publish <command> file`.
- **No git host package** - in a project without one the menu lists only "As the file says", Nothing and Publish branch.
- **Groups** - with two projects, the spend offset sits under "All projects" with "One number, saved to every project" and no command row; each project has its own group under its name, with its scheduler's status ("on", "off"), its model and the line "On this machine only; agent-schedule.md sets the defaults."; the same command in both projects is two rows, and checking one in the second project runs `switch` in that project only.
- **Projects holding different cushions** - the "All projects" row names the project that is not at the loosest with its own cushion; with every project agreeing it says nothing of the kind.
- **No schedule yet** - a project whose scheduler read no schedule says so under its name.
- **A refused save** - a switch the command refuses shows "The switch was not saved: /<command>: <why>".
- **The spend offset** - with two projects holding different cushions the box shows the loosest, to one decimal; typing a minus sign, then a number, then one far out of range, shows −50 once the box loses the focus and saves `offset -- -50` once in each project, only the resting value.
- **A refused offset** - shows "The spend offset was not saved: <project>: <why>" and the box shows the saved value again.
- **A project that cannot be read** - shows "The scheduler could not be read: <why>" in its group, "not readable" beside its name, and no "Spend offset" row.
