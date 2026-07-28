Top navigation bar (logo + Discord/GitHub buttons), shared by all pages.

## TLDR

- Logo click: on `/` it prevents navigation, clears the hash (`history.replaceState`) and smooth-scrolls to top; on subpages it navigates home.
- Right-clicking the logo (`onContextMenu`) opens `/press` — where logo downloads live.
- Below 480px the button labels hide, leaving icons (`styles.css`).

## Facts

- Deliberately no Dashboard button: the dashboard is a local daemon, and a public page can neither reach nor detect one (#1135); the button waits until opening it from here actually works (#1137).
