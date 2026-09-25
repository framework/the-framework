Non-obvious decisions only, grouped by business-logic flow. Anything not listed is left
to the implementer's judgment. Flag conflicts instead of silently deviating. Keep
outdated decisions (no history).

A bullet is a person's pick, and says what it was picked over. What the code does belongs
in the LOGIC.md files; a choice made while implementing is the implementer's judgment,
not a decision. An AI proposes a bullet and asks; it never adds or rewrites one.

## Discord as a skill
- Discord is a skill with one command, `discord send`, like the browser. The Framework knows
  no Discord. Picked over the dashboard's own poster, with its watchers, its settings and
  its stored credentials.
- It posts what it is given and decides nothing: when to post is whoever calls it, the
  runner's `ended:` line or an agent asked to. Picked over a skill that watches runs.
- The webhook is set per machine by a person (`discord setup <webhook>`), outside the
  project; `DISCORD_WEBHOOK` in the environment wins. Picked over a file in the project:
  anyone holding the URL can post to the channel.
