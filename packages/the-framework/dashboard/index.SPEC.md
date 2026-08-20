The static shell the daemon serves for every address: the root element the app mounts into, the product's typefaces and tab icon, and the module script that boots it.

## Flows

- Served for every path, not just `/`: the app owns routing, so an unknown path is the shell plus a client-side decision, never a 404 from the daemon.
- The tab icon carries its own dark-mode ramp inside the file, because a favicon sits on browser chrome — which follows the OS theme, not the in-app theme choice.

## Rationales

- No framework sits between this page and the app: a static shell plus the app's own client-side routing is all the dashboard needs.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
