The "Add a device" modal (#1052): paste the `?token=` URL another daemon printed on its network bind to save it as a connection profile.

## TLDR

- A device is any reachable daemon (LAN IP, tailnet name, tunnel URL); the input is the full URL from `cli.ts`'s non-loopback bind, not a LAN-IP form.
- `parseDeviceUrl` (`lib/profiles.ts`) extracts origin + token from one paste; a URL without a token is unsavable (cannot authenticate against a guarded box) and gets an inline warning.
- Saves via `addProfile` into this browser's localStorage — the token is a per-browser secret, never a server file.
- Optional label defaults to the URL host; Cmd/Ctrl+Enter saves; `onAdded` then `onClose` fire on success.
