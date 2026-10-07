What the tests cover, for the launcher's "Context" picker:

- **The other projects** - the menu lists every other registered project as a checkbox by name, checked for the ones already in the Context [1]; toggling one reports the project's path.
- **The trigger's summary** - the "Context" trigger carries the launcher's summary text ("2 projects") when something is picked.
- **Picked files** - a picked file is listed and its remove cross reports the file's path; with nothing picked the "Files" group shows the "None yet" hint.

## Glossary

[1] Context: the set of paths the user picked to focus an agent on: other registered projects, by their absolute path, and files of the current project, by their path relative to the repository's root.
