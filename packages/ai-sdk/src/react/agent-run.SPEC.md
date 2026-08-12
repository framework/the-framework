The framework-free core of the browser client for streamed agent runs: transcript building, browser-side tool execution, and the run/resume loop.

## TLDR

- Streamed events become a renderable transcript; consecutive text pieces merge into one growing block.
- A run that pauses for browser-side tools is automatically resumed once those tools ran — unless the app chose to handle them by hand.
- An approval pause always parks the run for an explicit human yes/no; it is never auto-resumed.
- A browser tool that throws becomes that tool's error result instead of aborting the batch, so the model sees the failure and can recover — the same posture as server-side tools.
- The app owns the endpoint and request shape (only it can reconstruct the server-side history); the core just hands it a typed run-or-resume intent.
- Kept free of React so the round-trips are exhaustively testable and usable outside React.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
