Decides, for every dashboard call that names an agent, whether this daemon answers it itself or forwards it to the device the agent is running on.

An agent this daemon is relaying from a device has no checkout here, so the same call — read or steering action — is sent to that device over its saved URL and token, and its answer is passed back unchanged. Any other agent is handled locally. A device that cannot be reached yields the same empty or failed answer the local path gives when a read fails, so no caller ever has to treat an agent running on a device differently from one running here.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
