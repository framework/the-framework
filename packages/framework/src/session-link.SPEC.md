Turns a session-link value into the real URL for the wrapped CLI's session. A session link may be a template carrying a `{sessionId}` placeholder — used when the driver only reports a session id and the URL shape, so the framework fills the id in once it is known — or a literal URL, which passes through unchanged. Also defines the generic Claude Code entry point (`https://claude.ai/code`), surfaced only as an "Open Claude Code" affordance: a headless session has no per-agent deep link, so a real live link only ever comes from an explicit session link.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
