The bootstrap orchestrator: it drives a user's app idea to a production-grade app — scope, build, full-fledged loop, deploy — narrating each phase.

## TLDR

- One upfront question fixes the scope — quick prototype or full production app — and what the user wants built, in their words.
- The build hands that intent to agents; which stack to build on is their call, not the orchestrator's.
- Full scope then loops: check production-grade, improve against the reported blockers with fresh context, check again — until clean or the pass budget runs out.
- Production-grade is earned, never claimed: only a run whose checklist ended clean gets the label; prototypes skip the loop.
- Deploy runs last — for prototypes too — and the user can interrupt the run between phases.

## Rationales

- The orchestrator owns only control flow; all real work (asking, building, checking, improving, deploying) is injected as steps, so the same flow runs with production agents or entirely offline.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
