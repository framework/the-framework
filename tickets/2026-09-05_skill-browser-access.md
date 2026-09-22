Priority: 2
Topics: [skills, browser]
Issue: [#1758](https://github.com/framework/the-framework/issues/1758)

# New skill: browser access (with limited permissions)

## TLDR

A skill that gives an agent a browser for tasks like "browse Twitter and Reddit to do X", ideally a separate browser session with its own logins. Brainstorm from the issue:
- Limit write access by blocking POST requests.
- A dashboard of the sites the browser is signed in to. Auth cookies may be hard to tell from tracking cookies, so the lever may be turning cookies/localStorage on or off per site: off means signed out.

Low priority: focus on the core flows first.

## Why it matters

It extends the agent's browser beyond checking the user's own app to acting on the web for them. Without permission limits, an agent with a signed-in browser can post or change things on the user's accounts.

## Source

Imported from GitHub issue [framework/the-framework#1758](https://github.com/framework/the-framework/issues/1758), created 2026-09-05, labels: `low-prio`, 0 comments.
