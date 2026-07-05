---
name: major-change-loop-technical
description: The major-change loop under Technical Control — leaner, the developer drives the depth.
metadata:
  on: major-change
  run: [code-review]
  conditions: technical
---

Technical Control mode: the developer is hands-on, so the loop only auto-runs the
core review and leaves test and security depth to them. Overrides the base
major-change loop when `technical` is active.
