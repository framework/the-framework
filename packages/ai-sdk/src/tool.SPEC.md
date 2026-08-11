How tools are defined — a typed builder that stays a client tool (executed in the browser) or becomes a server tool once a handler is attached — plus the control signals a running tool yields to pause the whole run.

## TLDR

- A tool without a handler is a client tool; attaching a handler makes it a server tool; an optional refinement shrinks the result into the text the model sees while the UI keeps the full result.
- Handlers may stream progress by yielding; two special yielded signals instead pause the surrounding run — one surfaces client tool calls that must execute in the browser, one surfaces an approval gate raised inside a sub-agent.
- Pauses are yields, not thrown errors: pausing isn't a failure, middleware can observe it, and any server tool can use it (browser geolocation, file uploads, nested agents).
- A pausing tool owns persisting whatever it needs to resume; the framework only propagates the pause and an opaque resume handle.
- Definitions convert to provider-ready schemas, carrying optional hints that let a provider substitute its native version of the tool.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
