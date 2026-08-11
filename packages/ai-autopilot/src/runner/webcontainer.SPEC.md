The runner that boots each workspace inside the user's browser tab (StackBlitz's WebContainer), so agent-written code runs and serves an instant preview with no server involved and nothing touching the host machine.

## TLDR

- Browser-only: the hosting page must carry the browser's cross-origin isolation protections; a helper reports whether the current context qualifies, and booting anywhere else fails with a clear message.
- Preview URLs come from the container announcing when a server starts listening, and asking for one can wait until a server is ready.
- Only one browser workspace can exist per page, so booting a second before disposing the first is refused.
- Command output arrives as one merged stream — the one runner that does not report errors separately from normal output.

## Rationales

- The browser-only dependency is loaded only at the moment a workspace boots, so using the package on a server never drags it in.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
