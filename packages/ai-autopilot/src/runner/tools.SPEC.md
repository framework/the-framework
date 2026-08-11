The bridge from workspace to agent: turns a booted session into the tools an agent calls to read, write, and delete files, run commands, start a dev server, and fetch its preview URL.

## TLDR

- The tools mirror what the workspace can actually do: the preview and server-start tools appear only when the session supports them — capability is detected, never assumed.
- The surface can be narrowed to read-only by switching off writing and command execution (which also drops server-starting), and tool names can be prefixed to avoid clashes with a persona's own tools.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
