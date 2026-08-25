What the tests cover: exactly the three steps nothing breaks without carry the Optional mark, while adding a project and filling the agent queue do not; and an unfinished step is presented as a checkbox rather than a radio button, since the steps are independent things to tick rather than alternatives to choose between.

The "Update from GitHub" step: it starts an agent on the target project with the `update_tickets` preset and runs it unattended, then hands the dashboard the project and the started agent so the user lands on the import in progress. When the start returns no agent identifier, the project is still handed up so the dashboard can adopt the running agent itself. A refused start reports the reason in place and navigates nowhere. Its "Configure first, then run" opens the target project's launcher carrying the same preset and starts nothing; with no project registered, both halves of the button are disabled.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
