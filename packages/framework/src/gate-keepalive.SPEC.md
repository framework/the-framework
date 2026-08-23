Keeps an agent's process alive for exactly as long as it is parked on a gate waiting for the user's answer.

## Business logic — TL;DR

- **An agent parked on the user must not die waiting** - the process is held open while any gate is pending, and released the moment the last one is answered, so an unanswered question never turns into a silently vanished agent and an idle agent never lingers.

## Business logic

### An agent parked on the user must not die waiting

#### User story

An agent started from the dashboard reaches a gate and asks the user a question. The user answers minutes or hours later, and the agent must still be there to continue.

#### Business logic

While at least one gate is awaiting its pick, the agent's process is held open. Overlapping gates share one hold, and the moment the last of them is answered — or fails — the hold is released, so the process can exit as soon as nothing is parked, exactly as if this had never applied.

#### Rationale

An agent the daemon started has nothing else keeping its process alive at a parked gate: it is spawned detached with no terminal attached and no dashboard server of its own, the Claude Code driver runs a fresh child per turn so nothing at all runs between turns, and the control channel watcher deliberately does not hold the process open — otherwise steering alone would keep an already-finished agent running forever. Without this hold the process simply exited mid-question: no end event, no error, and the user's pick landing in `control.jsonl` where nothing would ever read it. Waiting for the answer is the agent's work at that moment, which is why holding the process is correct here and nowhere else.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
