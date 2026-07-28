---
'@gemstack/the-framework': patch
---

A run against an existing codebase no longer opens by telling the agent how to behave (#1224). The prompt carried four lines of rules (do not re-scaffold or rebuild, do not swap the stack, read the existing code first, make the smallest coherent set of changes) that describe how any capable agent already works. What it cannot infer is that this workspace already holds a project, and that is the first line, so the framing that #185 added survives while the instruction not to infantilize it does not.
