One configurable runner for every CLI binary The Framework shells out to (`git`, `gh`): run the binary with arguments in a directory, resolve its output, reject on a non-zero exit. Each binary is configured with a time budget — flat, or derived from the arguments, because one binary is not one operation (`git push` talks to a remote while `git rev-parse` reads a file, and a single number is too short for one or too long for the other) — an optional larger output cap for commands whose output can be big (a repo crawl), and whether a failure is reported with the tool's own error text rather than a generic failure line (`gh` puts the useful part — "not logged in" — there, and that is what the dashboard should show).

A process killed for outrunning its budget rejects as a recognizable timeout that names the command and the budget it outran, distinct from a failure the tool itself reported: a killed `git push` usually writes no error of its own, and without the distinction it reads as a rejected push. The timeout recognition still works on a value that crossed a module boundary.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
