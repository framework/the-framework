Carries a half-typed prompt into the next screen — across a device hop or an in-app jump to the launcher — without ever letting it linger in the address bar.

## TLDR

- A prompt arriving from another device rides in on the URL; at boot it is moved into tab-local storage and stripped from the address bar, so it never sits in history or leaks to other sites.
- An in-app navigation writes the same stash directly — it never leaves the tab, so there is no reason to put the prompt in a URL at all.
- The stash is handed over exactly once and cleared, so a reload does not re-seed the composer.

## Before modifying/creating SPEC.md files

Always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
