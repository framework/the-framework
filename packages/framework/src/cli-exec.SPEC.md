One configurable runner for the CLI binaries The Framework shells out to itself (`gh`; git runs through the branch-management package's own runner): run the binary with arguments in a directory, resolve its output, reject on a non-zero exit. Each binary is configured with a time budget (`gh` runs its reads and its writes on two budgets) and with whether a failure is reported with the tool's own error text rather than a generic failure line (`gh` puts the useful part — "not logged in" — there, and that is what the dashboard should show).

A process killed for outrunning its budget rejects as a recognizable timeout that names the command and the budget it outran, distinct from a failure the tool itself reported: a killed process usually writes no error of its own, and without the distinction it reads as the tool refusing. The timeout recognition still works on a value that crossed a module boundary.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
