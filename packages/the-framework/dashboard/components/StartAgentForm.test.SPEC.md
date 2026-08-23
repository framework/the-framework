What the tests cover: how the launcher starts an agent, and the warnings it raises before the start.

**How the agent ends.** A preset is started unattended, so it ends when its work settles and its armed handoff fires; a prompt the user typed is started attended, keeping the agent open for chat.

**Whether the agent can start at all.** A coding-agent CLI that is not logged in is named in the launcher, together with the command that fixes it. A condition that merely risks the start — the daemon running as root, where the CLI looks for credentials in the wrong home — is raised as a warning rather than as a failure. A CLI that is ready shows nothing at all. The check is repeated whenever the picked driver changes, because one CLI being logged in says nothing about the other. It also asks about the GitHub CLI, but only while the handoff is armed to open or merge a pull request — a push-only handoff must not warn about a CLI its agent will never call. An agent on a GitHub Actions runner is never gated on a local CLI it does not use.

**The Haiku warning.** Picking Haiku warns that it skips the finish protocol and points at a stronger model, without blocking the start; any other model shows no such warning.

**The auto-merge notice.** With the merge handoff armed on a repository that refuses GitHub auto-merge, the launcher notes that the daemon merges the pull request on green, names the server-side setup, and does not block. A repository that allows auto-merge shows nothing — and so does one the GitHub CLI could not answer for, since "could not say" is not "off". With the merge handoff unarmed, the question is never asked.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
