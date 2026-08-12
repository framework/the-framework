Proof that the in-browser workspace really works: a WebContainer boots only inside a cross-origin-isolated browser page — never in plain Node — so this harness drives a real headless browser through boot, file round-trips, commands, serving an app, previewing it, and teardown.

## TLDR

- A tiny local web server hosts a page with the isolation protections the browser sandbox requires and hands it the compiled adapter.
- The page exercises that real adapter exactly as an app would and records each check's outcome; a driver script launches the browser, reads the results, and fails on any miss.
- A headed mode leaves the window open showing the live app served from inside the browser sandbox.
- It is opt-in rather than part of the normal test run: it needs a browser and network access (the sandbox's runtime downloads on first boot); only the plain-Node guards are covered by the ordinary suite.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
