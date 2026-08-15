Turns the user's saved preferences into the options a run starts with, so an unattended run honours exactly the same settings as one started from the dashboard.

## TLDR

- One shared mapping because two things start runs — the dashboard and the automatic project manager — and the second used to pass nothing, ignoring every setting.
- The repo's committed config file becomes a preference layer of its own, sitting under the project's overrides and over the user's global choices.
- Settled answers travel explicitly, "off" included, so a repo file or a run-side default can never turn back on what the launcher just showed as off.
- Publishing is one ordinal, not a set of switches: each rung includes the ones below it, so nothing has to remember that a pull request implies a push. Unset means open a pull request — the zero-config handoff — and merging is the rung above, because landing on the main branch has to be asked for.
- Options that would mean nothing are dropped: the browser only goes to the agent that can use it, and the model, agent, and run target travel only when they differ from the default.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
