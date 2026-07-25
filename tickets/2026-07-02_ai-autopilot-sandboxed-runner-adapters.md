priority: medium
topics: [enhancement]

# ai-autopilot: sandboxed runner adapters (Docker / WebContainer / Flue)

## TLDR

Build the sandboxed runner adapters that isolate untrusted agent code behind the runner seam shipped in #106 (`LocalRunner` is the reference, `FakeRunner` covers tests). Docker (`DockerRunner`, PR #142/#143) and WebContainer (`WebContainerRunner`, PR #223) have shipped; what remains is the **Flue** adapter mirroring Flue's `sandbox` contract (in-memory / edge / container).

## Why it matters

Running untrusted, agent-generated code on the host is the main safety gap of ai-autopilot; sandboxed adapters close it per environment (server via Docker, browser via WebContainer, edge via Flue). The remaining Flue adapter is infra-gated — it can't be built and honestly verified without a live Flue environment — so the ticket stays open to track it.

## Source

Imported from GitHub issue [gemstack-land/the-framework#109](https://github.com/gemstack-land/the-framework/issues/109), created 2026-07-02, labels: `enhancement`, `priority: medium`, 1 comment.

### Original description

Follow-up from the ai-autopilot epic (#97). The runner seam and the first real adapter (`LocalRunner`, #106) shipped. What's left are the *sandboxed* adapters that isolate untrusted agent code:

- [x] **Docker** — full-fidelity, background/long-running; needs a Docker daemon. **Shipped** (`DockerRunner`, PR #142; sandboxed boot-and-serve E2E, PR #143).
- [x] **WebContainer** — instant in-browser Vike preview; needs a browser runtime. **Shipped** (`WebContainerRunner`, PR #223; headless-Chromium boot-and-serve harness under `harness/webcontainer/`, 15/15).
- [ ] **Flue** — mirror Flue's `sandbox` contract (in-memory / edge / container); needs a live Flue env.

`LocalRunner` is the reference each mirrors; `FakeRunner` covers tests. Docker is done; WebContainer and Flue remain infra-gated (can't be built and honestly verified without provisioning that infra first).

### Notes from the GitHub thread

- Docker adapter confirmed done in #142: boots each workspace as a container via the `docker` CLI, same seam as `LocalRunner`, verified against a live daemon (15 container tests; skips cleanly with no daemon so CI stays green). Issue left open to track WebContainer and Flue.
