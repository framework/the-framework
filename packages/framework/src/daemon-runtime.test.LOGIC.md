Tests of a Start as the daemon does it (`daemon-runtime.ts`), with real hook lines run through the shell in throwaway projects. The relay half has its own loopback test (`dashboard/remote-run.integration.test.ts`).

Covered:
- A Start runs the start hook of the project addressed, the home project or a registered one, hands it the prompt and the picks (neither pick variable is set when no pick was made), and answers the id the hook answered.
- A Start is refused in words: an unknown project, a project with no start line, and a line that fails (its last stderr line is the reason).
