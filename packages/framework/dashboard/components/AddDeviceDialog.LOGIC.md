The "Add a device" dialog, opened from the settings gear: the user pastes the one URL another machine's daemon prints when it binds to the network, of the form `http://host:port/?token=…`, optionally names it, and the device [1] is saved for this browser. A device is any reachable daemon, on a LAN address, a tailnet name or a tunnel URL, so the input is the whole printed URL rather than an address field: the daemon's origin and its token are parsed out of the one paste (the rule in `lib/profiles.ts`), and the token, a per-browser secret, is kept in the browser's own storage and never in a file on any daemon.

## Glossary

[1] device: another machine's daemon the user saved by URL and token, to run agents on it from this dashboard.

## Business logic — TL;DR

- **What is asked** - one line of help, "Paste the URL the box printed on its network bind (it looks like `http://host:port/?token=…`).", a URL field with that placeholder and focused on open, and a name field, "Name (optional)", whose placeholder becomes "Name (optional) — defaults to <host:port>" once a URL parses; the name is capped at 60 characters.
- **What is refused** - while the URL field is not blank and the paste is not savable, a warning says why: "That is not a valid URL." when it cannot be parsed as an `http` or `https` URL (a scheme-less paste does not count), or "This URL has no token, so the box could not authenticate you." when it parses but carries no `?token=`; the "Add device" button stays disabled until the paste is savable.
- **Saving** - "Add device", or Ctrl+Enter / Cmd+Enter anywhere in the dialog, saves the device with the parsed origin as its URL and id, the parsed token, and the trimmed name when one was typed (otherwise the device is named by its host and port); pasting the same daemon again refreshes its saved token instead of adding a duplicate (the rule in `lib/profiles.ts`). The caller is told a device was added, and the dialog closes.
- **Cancel** - "Cancel", or closing the dialog, saves nothing.
