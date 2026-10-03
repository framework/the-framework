The browser's typed stubs behind Settings → Subagents: reading the subagent settings [1] in force, with how many projects have the subagents hook [2], and saving them whole. Each is addressed by the call's name over the dashboard's transport (`lib/rpc.ts`) and declared with the daemon's own signature for it, taken from `src/dashboard-rpc/subagents.ts`; a call the daemon renames, or whose answer changes shape, therefore fails the dashboard's type check instead of breaking the page at runtime. The stub adds no rule of its own: what the call answers is the daemon's logic in `src/dashboard-rpc/subagents.ts`; only the call's name and types cross into the dashboard, and none of the daemon's code reaches the browser bundle.

## Glossary

[1] subagent settings: a person's choice, on one machine, of the coding agent and model a main agent's subagents run on, one for a task the main agent calls simple and one for a task it calls hard, and how many of one main agent's subagents run at once; the project's `orchestration` command keeps them.
[2] subagents hook: the one shell line under `subagents` in a project's `.the-framework/hooks.yml`, which saves the subagent settings.

## Business logic — TL;DR

- **Typed against the daemon** - the stub's answer is the daemon's own for that call, so a call renamed or re-shaped on the daemon's side is a type error in the dashboard's build, never a page that fails in the browser; the daemon's implementation is imported for its types only and stays out of the bundle.
- **Reading the settings** - the subagent settings [1] in force and how many projects have the subagents hook [2].
- **Saving the settings** - the settings the user picked, sent whole to the daemon, which runs every project's subagents hook with them; the answer is success, or an error in words the page shows.
