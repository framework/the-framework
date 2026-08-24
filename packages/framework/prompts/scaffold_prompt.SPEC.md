The scaffold retry prompt: the hard directive sent when a build's opening turn left the workspace empty.

## Business logic

A build agent sometimes stalls rather than scaffolding — waiting for code that does not exist, or refusing because the directory is empty. This retry states plainly that no app exists yet and the agent must create the entire app from scratch now: an empty directory is expected, not a reason to refuse or wait, and the agent is not to stop until the requested features exist and the app runs. The user's intent fills the first line.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
