The heart of the SDK: the agent base class and the step-by-step tool loop behind every prompt and stream call.

## TLDR

- An agent declares its instructions, model, tools, and limits; the loop asks the model, runs the tools it requests, feeds results back, and repeats until the model answers, a stop rule fires, or the run pauses.
- A run pauses instead of finishing when a tool must run in the browser or needs human approval, surfacing the pending work so the caller can resume later.
- Declared failover models are tried in order when the primary fails; middleware and observers see every step, usage, and outcome; the same loop serves streaming and non-streaming callers.
- An agent can be another agent's tool: the child streams progress into the parent, may suspend mid-run with its state snapshotted, and resumes later — singly or as a batch whose pending work aggregates into one client round-trip.
- A handoff passes the conversation to another agent mid-run, merging steps and usage across the chain.

## Rationales

- Resumes refuse forgery: results and approval decisions must match exactly what the pause was waiting on, and every snapshot is single-use.
- Streamed token usage arrives split across chunks; merging by per-field maximum (counts only grow within a step) keeps billing from undercounting.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
