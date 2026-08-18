Covers the cloud-scratch sweep: only the driver's exact ref shapes are ever candidates, each safety gate (age, work landed, open PR, busy agent) keeps a ref on its own, a `cloud-*` ref is first watched for a day before it may go, records are pruned when refs disappear, a refused deletion is retried without restarting the clock, a repo without a remote sweeps nothing, and the daemon-facing service announces deletions and failures but not kept refs.

## Before modifying/creating SPEC.md files

Always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
