What the tests cover: asking each OS for a folder without ever opening a real dialog.

- On macOS a picked folder comes back as its absolute path with the OS's trailing slash dropped, and the dialog asked for is the standard folder sheet.
- On Linux the GTK dialog helper is asked first; when it is not installed the KDE one is asked instead, and a Wayland session counts as a desktop session just as an X11 one does.
- On Windows the folder browser that ships with the OS is what opens, and the path it prints comes back with its line ending dropped.
- Dismissing the dialog is a normal "nothing picked" answer on every platform, not an error.
- On Windows a PowerShell failure is still reported as a failure, rather than mistaken for a dismissal.
- A dialog that failed to open surfaces its reason.
- A Linux machine with neither dialog helper installed answers by naming both, without attempting to open anything.
- A Linux daemon with no desktop session answers so directly, without attempting to open anything.
- A platform with no wired dialog answers so by name, without attempting to open anything.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
