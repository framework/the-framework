Opens the operating system's own choose-a-folder dialog on the daemon's machine, behind the dashboard's "Add project", and hands back the absolute path the user picked: a browser page cannot learn the absolute path of anything picked inside it, while the daemon runs on the machine the user sits at. Dismissing the dialog is a normal outcome, not an error, and a machine that cannot show a dialog says why instead of trying.

## Context

**User story**: the user clicks "Add project" and the operating system's folder dialog opens, titled "Choose a git repository to add as a project"; the chosen folder's path lands in the form, and cancelling leaves the form as it was. On a daemon reached over SSH or in a container, the user is told that no dialog can open there rather than left waiting. What follows the pick, the confirmation "Do you trust this repository?" before the folder is added as a project, is the dashboard's own step in `dashboard/components/AddProjectPanel.tsx`.

## Business logic — TL;DR

- **One dialog per operating system** - macOS shows the standard folder sheet; Windows shows the folder browser that ships with the system, with its "new folder" button hidden and the user's shell startup script kept from printing into the answer; Linux shows the desktop's own helper, `zenity` on GTK desktops or `kdialog` on KDE, whichever is installed, opening in the home directory.
- **When no dialog can open** - a Linux daemon with no display session answers "The machine running The Framework has no desktop session, so no folder dialog can open there."; a Linux machine with neither helper installed answers "The folder dialog needs zenity or kdialog, which the machine running The Framework does not have installed."; any other platform answers "The system folder picker is not available on <platform>.".
- **Reading the answer** - a dismissed dialog is a pick of nothing; the picked path is what the dialog printed, without macOS's trailing slash, since the registry stores paths without one; an empty answer is "The folder dialog returned no path."; any other failure surfaces the dialog's own error text, or "The folder dialog could not be opened." when it said nothing.

## Business logic

### One dialog per operating system

#### Context

See `## Context`.

#### Business logic

The dialog is chosen by the platform the daemon runs on. On macOS it is the standard folder sheet, driven through AppleScript. On Windows it is the system's folder browser driven through PowerShell, started without the user's profile so a startup script cannot print into the path read back, and with the "new folder" button hidden: the user picks an existing repository. On Linux, a dialog needs a screen, so the daemon first checks for a display session; with one, it tries `zenity` and then `kdialog`, each opened in the user's home directory, and a helper that is not installed simply passes the turn to the next. Every dialog asks the same thing: "Choose a git repository to add as a project".

### When no dialog can open

#### Context

**Problem**: a daemon started over SSH or inside a container has no screen to draw on, and spawning a helper there can only fail with an unhelpful message.

#### Business logic

On Linux without a display session, the answer is the reason "The machine running The Framework has no desktop session, so no folder dialog can open there." and nothing is spawned. On Linux with a display but neither helper installed, the answer is "The folder dialog needs zenity or kdialog, which the machine running The Framework does not have installed.". On any platform other than macOS, Windows and Linux, the answer is "The system folder picker is not available on <platform>.".

### Reading the answer

#### Context

**Problem**: each dialog reports a cancellation in its own way, and a cancellation must reach the dashboard as "nothing picked", never as an error to show.

#### Business logic

A dismissed dialog is a successful pick of nothing: on macOS the dialog's cancellation error; on Windows a dedicated exit code of the script, kept apart from PowerShell's own failure exit; on Linux exit code 1, which is read as a cancellation even though a helper that cannot reach the display exits the same way, because the no-display case has already been ruled out and mistaking that rarity is better than showing every user who cancels the harmless warnings these helpers print on startup. Any other failing exit surfaces the dialog's error output, trimmed, or "The folder dialog could not be opened." when there is none. A successful dialog's answer is its printed path, trimmed, with a trailing slash removed because macOS prints one and the registry stores paths without it; a successful dialog that printed nothing answers "The folder dialog returned no path.". A command that cannot be started at all counts as not installed, so the next candidate dialog is tried.
