Starting an agent from the dashboard. Both surfaces that can start one — the launcher and the continuation offered on a finished agent — go through here, so a refusal reads identically on either.

Starting is the one action with a refusal of its own: the daemon will not start a second agent on a checkout that already has one. The dashboard restates that refusal in its own words, "An agent is already active for this project.", since the daemon phrases it for its own log. Any other failure that names no reason reads as "Failed to start the agent." While the request is in flight the control reports itself as busy, and on success the new agent's identity comes back so the dashboard can immediately point at it.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
