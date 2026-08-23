What the tests cover: the fake driver replays its scripted answers one per prompt in order and repeats the last one once the script runs out; it can instead answer from the prompt itself; it produces the same event stream a real driver does — the prompt starting, each scripted tool call, the agent's text, and the turn's result; it serves the file contents it was seeded with and reports a file it was not given as missing; and an agent already stopped refuses further prompts.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
