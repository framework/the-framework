Bootstrap mode — the spine that takes a user from nothing to a running, production-grade, deployed app (#116): scope → build → full-fledged loop → deploy.

## TLDR

- `bootstrap.ts` — the `Bootstrap` orchestrator: owns sequencing, the pass loop, the abort gate, and narration; steps are injected.
- `types.ts` — step contracts (`BootstrapSteps` + contexts), `BootstrapEvent` narration union, `BootstrapResult`, deploy vocabulary (`DeployPlan`/`DeployTarget`/…).
- `steps.ts` — default step wirings onto the real primitives: `supervisorBuild` (Supervisor), `loopChecklist`/`loopImprove` (LoopEngine + `defaultLoops()` kinds).
- `deploy.ts` — `agentDeploy` (agent decides `{ render, target, reason }`), `planOnlyTarget` (v1 default: decide + narrate, never ship), `FakeDeployTarget`, `DEFAULT_DEPLOY_TARGETS`.
- `cloudflare.ts` — real target: install/build in the runner session, ship via `wrangler` (SSR → Workers, SSG/SPA → Pages), report the live URL.
- `dokploy.ts` — real target: trigger a deploy of a pre-configured app over the Dokploy HTTP API (Dokploy builds server-side).
- `serve-check.ts` — `serveCheck`, a checklist step with teeth (boots + fetches the app in the session), and `mergeChecklists` to AND it with the prompt checklist.
- `index.ts` — barrel.
- Tests: `*.test.ts` mirror each module; `serve-check.docker.test.ts` proves the boot-and-serve check end-to-end in a real Docker container.

## Decisions

- Steps-injection architecture: the orchestrator never touches model/runner directly, so the entire flow (including end-to-end tests) runs offline against stubs/`AiFake`/`FakeRunner`.
- The `DeployTarget` adapter seam mirrors the runner seam (#109): deploy *decision* (agent) is separated from deploy *execution* (target); v1 defaults to plan-only so bootstrap never does a blind deploy.
- Real deploy targets never throw — every failure is a `{ deployed: false, detail }` narrated to the user, because the app was already built.
- Production-grade is earned, not claimed: only a full-scope run whose checklist ends with zero blockers sets `productionGrade`; prototypes skip the loop.

## Facts

- Cross-module env vars: `CLOUDFLARE_API_TOKEN`/`CLOUDFLARE_ACCOUNT_ID` (cloudflare), `DOKPLOY_AUTH_TOKEN`/`DOKPLOY_API_KEY` (dokploy).
- The loop-side contracts live outside this directory: `Verdict`/`isPassing` in `../loop/verdict.js`, event/prompt ids in `../loop/policy.js`, the runner capabilities (`start`/`preview`, #137) in `../runner/`.
