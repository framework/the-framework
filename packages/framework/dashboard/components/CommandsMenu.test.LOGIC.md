What the tests cover, for the "Commands" button beside the composer:

- **Commands** - the project's commands [1] are listed as `/<name>`, and picking one loads its slash line with a trailing space, so an argument can follow; a project with no commands says "This project has no commands.".
- **Saved prompts** - one of the user's saved prompts [2] loads verbatim under its name, and so does one of the project's; the delete button deletes without loading, and a project's saved prompt is deleted through its own handler, not the user's.
- **Sections that come and go** - the "Project saved prompts" section is absent when the project has none.
- **"Save prompt…"** - the item opens the save dialog, and is absent on a surface that has no dialog.

## Glossary

[1] command: one of the project's skills, typed as `/<name>`, optionally followed by an argument.
[2] saved prompt: a prompt the user saved under a name, for themselves or for the project, loaded back into the editor verbatim.
