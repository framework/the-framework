The banner at the top of a project's page naming what the daemon currently finds wrong with the project — a headline per kind of error, the failing command's own words underneath, and since when.

## Flows

- The user sees exactly the errors the daemon's project list carries — the banner holds no state of its own, and there is no dismiss.

## Rationales

- No dismiss because the daemon clears the error the moment the condition is fixed — the banner disappears by the problem going away, not by being waved off.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
