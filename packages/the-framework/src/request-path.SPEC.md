Reads the pathname out of an incoming HTTP request defensively, so a malformed request target (such as the absolute-form target a proxy client sends) can never crash the daemon: an unparseable request yields "no path", which the server answers with 400 or its fallback page instead of throwing.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
