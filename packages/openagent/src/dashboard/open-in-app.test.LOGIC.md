What the tests cover:

- **Which command reveals the folder** - `open` on macOS, `explorer` on Windows, `xdg-open` elsewhere, each with the project's path as its one argument.
- **Which command opens the editor** - `code` when no editor is set and when the setting is blank; a set editor, such as `subl`, is used as given; the editor preference passed in wins, with the project's path as the one argument.
- **Where the editor setting is read** - the editor is taken from `$OPENAGENT_EDITOR` in the environment, and is `code` when it is unset.
- **A successful launch** - opening the folder runs exactly one command on the project's path and succeeds.
- **A missing launcher** - a command that is not on the `PATH` yields a failed result with a readable "not found" message, not an exception.
- **Editor detection** - only the editors whose launcher is found are offered, in the known list's own order; when none is found the list is empty, and the picker then shows only "Default".
