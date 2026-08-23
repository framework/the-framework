Remembers which saved device the user has picked to run the next agent on, so the Start form can show the choice and the submit can attach it as the agent's relay target. No device picked means the agent runs on one of the ordinary run targets — this machine or a GitHub Actions runner.

The choice lasts only as long as the page: it is never stored, and in particular never becomes a preference, because a device's token is a per-browser secret and where one agent is sent is a transient decision rather than a saved setting.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
