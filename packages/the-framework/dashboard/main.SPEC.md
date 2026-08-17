The dashboard's entry point: mount the app into the static shell's root element, inside the theme-and-error-boundary frame, with the global stylesheet.

## TLDR

- Everything here is the browser's. The daemon serves one static `index.html` plus fingerprinted assets and answers RPCs; the app routes itself off the address.
- There is no framework between the HTML and the app. A prerendering meta-framework used to sit here, and its entire net contribution was emitting that one `index.html` — the rest was scaffolding for a prerender with a single page in it.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
