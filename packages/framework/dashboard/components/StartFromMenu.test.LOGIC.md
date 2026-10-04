What the tests cover, for the launcher's "start from" chip:

- **The chip's words** - with the main branch picked the chip reads its name (`main`) and carries an icon; with the local branch picked it reads the local branch's name and " (local)" (`my/work (local)`), also when both branches have the same name (`master (local)`).
- **What the menu lists** - the heading "The agent starts from", then the main branch's name with "The project's main branch, fetched fresh.", then "My local branch my/work" with "Your branch as committed on this machine; uncommitted edits are not carried. If the agent publishes, your commits that are not pushed go up with its branch."; only the option in force is marked as the current one and shows the check mark, for either pick.
- **A folder on the main branch** - the second option is still listed, and reads "My local branch main".
- **Picking an option** - clicking "My local branch …" reports the local pick, and clicking the main branch's name reports the main pick.
- **Tooltip and busy** - the chip's tooltip reads "The agent starts from my/work (local)", and the chip is disabled while the launcher is busy.
