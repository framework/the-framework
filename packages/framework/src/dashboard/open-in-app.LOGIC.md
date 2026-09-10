The project panel's actions to open the project in an editor or reveal its folder in the operating system's file manager: the daemon launches a local command on the project's own registered path, and it detects which known editors are installed so the editor picker in Settings can offer them. The path opened is always the project's registered path, never anything the browser sent, and the whole feature is for a daemon on the user's own machine: a daemon reached over the network has no local folder of the user's to open.

## Glossary

[1] preferences: the user's dashboard settings, kept in the registry (`~/.the-framework.json`, which also lists the projects).

## Business logic — TL;DR

- **Which editors the picker offers** - a fixed list of known editors, each offered when its launcher is found on the `PATH`, in a fixed display order, without running anything.
- **Which command opens the project** - for the editor, the stored preference, else `$FRAMEWORK_EDITOR`, else VS Code's `code`; for the folder, the operating system's own opener.
- **Launching, and what a failure says** - the command counts as opened the moment it launches, and a launcher missing from the `PATH` or failing to start is reported as a message, never as a crash.

## Business logic

### Which editors the picker offers

#### Context

**User story**: in Settings the user picks the editor the project panel opens projects in, from the editors actually installed on the machine, or types one by hand.

#### Business logic

The known editors, in the order the picker shows them, are VS Code (`code`), VS Code Insiders (`code-insiders`), Cursor (`cursor`), Windsurf (`windsurf`), Zed (`zed`), Sublime Text (`subl`), WebStorm (`webstorm`), IntelliJ IDEA (`idea`), Neovim (`nvim`), Vim (`vim`) and Emacs (`emacs`). An editor is offered when its launcher exists as an executable in one of the directories on the `PATH`; on Windows the launcher may carry any of the `PATHEXT` suffixes (`.EXE`, `.CMD`, `.BAT`, `.COM` when `PATHEXT` is unset) and only has to exist. Detection is a lookup and starts no program. The list only bounds auto-detection: `$FRAMEWORK_EDITOR` and a value the user typed stay valid beyond it.

### Which command opens the project

#### Context

See the section above.

#### Business logic

To open the project in an editor, the launcher is the editor stored in the preferences [1] when there is one, else `$FRAMEWORK_EDITOR` when it is set and not blank, else `code`, run with the project's path as its one argument. To reveal the folder, the launcher is `open` on macOS, `explorer` on Windows and `xdg-open` elsewhere, with the path as its one argument.

### Launching, and what a failure says

#### Context

**Problem**: an editor lives as long as the user keeps it open, and Windows' `explorer` exits with a failure status even when it succeeded, so waiting for the command to exit would either block or misreport.

#### Business logic

The command is launched detached from the daemon and the action succeeds as soon as the command has started, not when it exits. When the launcher is not on the `PATH`, the action fails with the message `"<command>" was not found on PATH`; when it fails to start for another reason, with that reason's message, or "failed to open" when there is none. A failure is a result the dashboard shows, never an exception.
