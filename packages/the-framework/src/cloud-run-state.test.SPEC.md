What the tests cover for the cloud state of a `web`-target agent:

- **Age** - a young agent with nothing adopted is in cloud, up to and including the adoption window's edge; one past it, or one whose start time cannot be read, is done.
- **Waiting** - a question the bridge holds makes the agent waiting, over a pull request and over any age.
- **Adopted work** - a pull request reads as the pull request; a merged one reads merged, whatever the agent's age; a withheld merge is still just the pull request.
- **Scope** - a local or Actions agent, and a web agent still running, stopped or failed, have no cloud state.
- **At work** - in cloud and waiting count as working; pull request, merged, done and no state do not.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
