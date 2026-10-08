What the tests cover, with a fake dashboard host whose `status` answers a scheduler that ticked once with two scheduled commands:

- **No project, no section** - given no project the section draws nothing.
- **The spend offset alone** - with two projects, the section holds "Spend offset" with "One number, saved to every project" and the line "What each project starts by itself is on the Automations page."; it names no scheduled command and has no checkbox and no menu.
- **The spend offset** - with two projects holding different cushions the box shows the loosest, to one decimal; typing a minus sign, then a number, then one far out of range, shows −50 once the box loses the focus and saves `offset -- -50` once in each project, only the resting value.
- **A refused offset** - shows "The spend offset was not saved: <project>: <why>" and the box shows the saved value again.
- **Projects holding different cushions** - the "Spend offset" Settings row names the project that is not at the loosest with its own cushion; with every project agreeing it says nothing of the kind.
- **A project that cannot be read** - shows "The scheduler of <project> could not be read: <why>" while the box still shows the cushion of the project that was read; with no project readable, only the alert shows and there is no "Spend offset" Settings row.
