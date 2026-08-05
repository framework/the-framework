Portable capability bundles for agents: a skill is a folder — instructions, optional tools, optional resources — discovered cheaply, loaded only when triggered, and composed onto an agent without ever overriding what the agent itself declares.

## TLDR

- A skill's manifest is the front matter of its instructions file, so skills authored for Claude load here unchanged and skills authored here ship as plain folders. The registry indexes only that cheap front matter; a skill's body, tools, and middleware load when its trigger matches — progressive disclosure, nothing paid for skills that never fire.
- Composition never surprises the agent: its own instructions remain the base identity and its own tools keep their names. A skill tool that collides is renamed, not dropped. Skills can also contribute middleware (the agent's runs first) and resource files.
- The trust boundary is explicit and honest: loading a skill runs its code, exactly like installing a plugin. So skills come only from sources you registered, a skill's additions can be inspected *before* attaching it (and its tools can be skipped while inspecting), and there is deliberately no in-process sandbox pretending otherwise — real isolation is the host's job.
- Robust by default: a malformed skill is skipped and reported, never fatal to the scan; loads are cached.

## Before modifying this file

Read this file's format at https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
