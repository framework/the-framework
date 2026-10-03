Tests of a Start as the daemon does it (`daemon-runtime.ts`), with real hook lines run through the shell in throwaway projects. The relay half has its own loopback test (`dashboard/remote-run.integration.test.ts`).

Covered:
- A Start runs the start hook of the project addressed, the home project or a registered one, hands it the prompt and the picks (neither pick variable is set when no pick was made), and answers the id the hook answered.
- A Start is refused in words: an unknown project, a project with no start line, and a line that fails (its last stderr line is the reason).
- Adding a project writes the runner's lines: adding an empty folder leaves `start`, `resume` and `check` lines for `agent-runner` in its hooks file; a `start` line the person wrote is kept, and adding the project again fills only the missing lines.
- A Start publishes no further than the project can: with no remote the start line is given no publish level whatever pick the Start carried, and with a remote and no git host package a pull request pick is given as the branch.
