Priority: 2
Topics: [skills, browser]
GitHub: [#1758](https://github.com/framework/the-framework/issues/1758)

# New skill: browser access (with limited permissions)

## TLDR

A skill giving agents a browser for tasks like "browse Twitter and Reddit to do this and that", ideally a separate browser session with its own authenticated sessions.

Brainstorming from the issue:
- Let the user limit write access by blocking POST requests.
- A dashboard listing the websites that are authenticated. Telling auth cookies from tracking cookies may not be easy; perhaps enabling/disabling cookies/localStorage per site is the switch (disabled ⇒ no auth).

The maintainer's call: low priority, focus on the core flows first.

## Why it matters

Opens agent work that needs the logged-in web, while keeping what an agent can do on those sites bounded.

## Source

Imported from GitHub issue [framework/the-framework#1758](https://github.com/framework/the-framework/issues/1758), created 2026-09-05, labels: `low-prio`.
