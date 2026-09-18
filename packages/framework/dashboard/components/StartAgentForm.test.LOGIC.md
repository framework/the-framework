What the tests cover, for the launcher on a project home [1]:

- **No command buttons** - a project's command [2] shows as no `/<name>` button on the form, and nothing is started.
- **Start carries the picks** - a Start sends the text with the coding agent [3] and the model the user picked, and the shell is told the id the start hook [4] answered.
- **No pick, nothing sent** - with no coding agent and no model picked, neither is sent, so the start hook decides.
- **No start hook** - a project read as having no start hook shows the alert naming `npx agent-scheduler init`, the `start:` line and `.the-framework/hooks.yml`, and the submit stays disabled with text in the editor.
- **No false alarm** - before the project is read, and for a project that has a start hook, no message shows and the submit is on.
- **A picked device** - the start carries the device's [5] URL, token and label, a project with no start hook of its own does not block it, and the check hook [6] is not asked.
- **What would stop the agent** - the check hook [6] is asked with the project and the picked coding agent; its problem shows in red and its warning in amber, in the answer's words, and Start stays on.
- **The "Post-merge cleanup" box** - a project with the `post-merge-cleanup` command shows the box, ticked from the saved setting; the Start then carries `/post-merge-cleanup` as the follow-up; clicking the box writes the setting off. Without the command there is no box and a saved setting on sends no follow-up; with the command and the setting never made, the box is unticked and the Start carries no follow-up.
- **The Context [7] rides the prompt** - with another project's path and a file picked, the Start sends the typed text followed by a blank line and `Context: <project path>, <file>` at its end.

## Glossary

[1] project home: a project's own page with the launcher (the Start form) and its composer (the prompt editor, also used to say something to an agent).
[2] command: one of the project's skills written to be run by a person, never picked up by the coding agent on its own (its front matter says `disable-model-invocation: true`), read off the folders the coding agents read them from (`.claude/skills/`, `.agents/skills/`); typed as `/<name>`, optionally followed by an argument.
[3] coding agent: the CLI doing the actual work: Claude Code or Codex.
[4] start hook: the one shell line under `start:` in the project's `.the-framework/hooks.yml`, which starts an agent and answers its id.
[5] device: another machine's daemon the user saved by URL and token, to run agents on it from this dashboard.
[6] check hook: the one shell line under `check:` in the project's `.the-framework/hooks.yml`, which answers what would stop an agent (problems) and what is only worth knowing (warnings).
[7] Context: the set of paths the user picked to focus an agent on: other registered projects, by their absolute path, and files of the current project, by their path relative to the repository's root.
