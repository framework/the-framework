Shared plumbing for the dashboard's scoped state: a piece of state is published for one region of the interface, and any part of that region can read it. Reading such state from outside the region that publishes it fails immediately with an error naming the missing region, instead of silently handing back nothing.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
