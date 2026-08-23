The "Add a device" dialog: the user pastes the URL another machine's daemon printed when it bound to the network — origin plus `?token=` in one string — optionally names it, and saves it as a device this dashboard can reach.

## Business logic — TL;DR

- **One paste, not a form** - the origin and the token are read out of the single pasted URL, so the user never transcribes a token by hand.
- **A tokenless URL cannot be saved** - Add device stays disabled until the pasted text is a valid URL that carries a token.
- **The name is optional** - left blank, the device is identified by the pasted URL's host.
- **The device is remembered per browser** - it is stored in this browser only, never written to the daemon.

## Business logic

### One paste, not a form

#### User story

The user wants this dashboard to be able to start an agent on another machine. A device is any daemon this browser can reach — a LAN address, a tailnet name, a tunnel URL — so there is no single shape to fill in.

#### Business logic

The dialog asks for the URL the other daemon printed on its network bind, of the form `http://host:port/?token=…`, and splits it into the daemon's origin and its token. A second, optional field names the device; the placeholder shows the host that will be used instead when it is left empty. Saving adds the device and closes the dialog; Cancel closes it without saving. Ctrl-Enter (or Cmd-Enter) saves from anywhere in the dialog.

### A tokenless URL cannot be saved

#### User story

A daemon bound to the network refuses unauthenticated callers, so a URL without a token would produce a device that can never connect.

#### Business logic

Add device is disabled until the pasted text parses as a URL *and* carries a token. Once the user has typed something, the reason it is not yet savable is spelled out: either the text is not a valid URL, or it is a URL with no token and so could not authenticate against the other daemon.

#### Rationale

The token is a per-browser secret: the saved device lives in this browser's own storage, never in a file on the daemon, so it is not shared with anyone else using the same machine's daemon.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
