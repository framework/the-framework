Tests of a project's commands (`project-commands.ts`), against throwaway project directories on disk.

Covered:
- The commands are the skills of both folders whose front matter says `disable-model-invocation: true`, each once, sorted by name, with the description the front matter gives; the first folder's copy decides, so a later copy marked as a command does not make a skill one; a skill the agent may pick up on its own, one marked `user-invocable: false`, one with no front matter and one whose front matter does not parse are left out; a folder without a `SKILL.md` and a folder whose name no slash command could have are skipped.
- A project with no skills folder has no commands.
