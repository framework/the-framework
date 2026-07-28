The mark + wordmark as the way home (#909): a real `<a href="/">` to the Overview that client-side-navigates on a plain left click.

## TLDR

- A real anchor, not a button, so cmd/middle-click opens a second Overview and "copy link address" works; any modified click (`meta/ctrl/shift/alt` or non-left button) is left to the browser.
- A plain click is `preventDefault`ed and routed through `onNavigate()` — the shell's own router `go` (#784).
- Below `sm` the wordmark folds away (`hidden sm:inline`, #980) so the nav fits narrow viewports; the mark stays and remains the link home.
- Forwards `working` to `Logo`, which animates while any session runs.
