Read-only reader of Claude Code's per-folder trust record in `~/.claude.json`, so the dashboard can warn before a cloud/web start on an untrusted project (#1318).

## TLDR

- `claudeConfigPath()` — where the Claude CLI records trust (`~/.claude.json`).
- `readClaudeTrust(root)` — `{known, trusted}`: whether `projects[root].hasTrustDialogAccepted === true`.

## Decisions

- Read-only on purpose: trusting a folder is a security decision the Claude CLI owns; the framework reports it and tells the user the one-time step, never makes it for them.
- Fail-quiet: a missing, unparseable, or reshaped config answers `{known: false}` and the dashboard simply shows nothing extra.

## Facts

- The CLI's one-time trust dialog can never be answered under the daemon's pty (#1314), so a `--cloud` run on an untrusted project is doomed before it starts — the point of knowing beforehand.
- "No entry for root" is `known: true, trusted: false` (the dialog will fire on the next start there), distinct from `known: false` (the file could not say).
