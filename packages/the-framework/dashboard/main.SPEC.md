The dashboard's entry point: mount the app into the static shell's root element, inside the theme-and-error-boundary frame, with the global stylesheet.

## Flows

- Everything here is the browser's: the daemon serves the one static page plus its assets and answers the app's calls, and the app routes itself off the address.

## Rationales

- There is no framework between the static page and the app: with a single always-served page and client-side routing, a prerendering meta-framework's entire net contribution is emitting that one page — the rest is scaffolding for a prerender with one page in it.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
