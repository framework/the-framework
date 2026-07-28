The header/sidebar theme control (#754): a dropdown over System/Light/Dark writing the one `preferences.theme` the rest of the app reads (LayoutDefault resolves it and toggles `dark` on `<html>`) — a second surface onto one setting, not a second setting.

## TLDR

- Moved out of the per-run options gear (#725 era), where an app-wide setting was filed under one run's options and absent on navbar-only screens — nobody found it.
- The trigger wears the current choice's icon (tooltip "Theme: X") so the header says which theme is on without opening; picks stay open (`closeOnClick={false}`) so the theme visibly changes underneath.
