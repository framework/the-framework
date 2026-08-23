The handful of behaviours every driver needs and none of them owns: publishing an agent's events, combining the agent-wide and per-turn framing into one block, combining the agent-wide and per-turn Stop signals, and reading a file out of the agent's own checkout.

The one rule worth stating: a surface that fails while handling an agent's event — a dashboard listener throwing, say — never takes the agent down with it. The failure is logged, naming which driver's event it happened on, and the agent carries on.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
