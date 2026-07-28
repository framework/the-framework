Settings section for the browser bridge (#1237): explains the extension setup and reveals/copies the bridge token.

## TLDR

- Exists because the bridge was unusable without it: enabling used to mean hand-editing `~/.the-framework.json`, and the token lived only in that file.
- Renders only when `enabled`; fetches the token via the `onBridgeToken` telefunc read.
- A null token means the daemon predates the toggle flip: "Restart the dashboard to generate the token" — genuinely required, the token is read at daemon start.
- Token is masked (24 dots) behind a Reveal toggle plus a CopyButton.

## Decisions

- Reveal-on-request, not because on-screen display is dangerous here (anyone loading the page can already start runs) but because a permanently visible secret lands in every screen recording, and this dashboard is demoed.
