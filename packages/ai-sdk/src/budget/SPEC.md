Caps how much each user of an app can spend on model calls, per day and per month.

Three parts play together: a price catalog turns token usage into dollars, a storage contract keeps per-user spend counters, and a middleware wires both into agent runs. Before each model call the middleware reserves the estimated cost — refusing the call when a cap would be exceeded — and settles the difference once actual usage is known. The load-bearing rule is that checking a cap and recording spend form one atomic step, so simultaneous requests can't team up to overshoot a cap. Bundled in-memory counters cover tests and single-process apps; production plugs in shared storage honoring the same contract.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
