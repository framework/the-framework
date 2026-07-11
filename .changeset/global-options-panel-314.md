---
'@gemstack/framework': minor
---

Add the #314 Global options panel to the dashboard (#371). Beside the Start box the daemon dashboard now shows persistent toggles: Autopilot (auto-accept, sharing its key with the choice-panel toggle so the two stay in lockstep), Technical control, Vanilla (remove all system prompts, fully transparent), and Eco with Auto planning / Auto research / Auto maintenance to trim the built-in prompt. Each persists in localStorage and rides along in the `POST /api/start` body, so flipping a toggle changes what the run gets (and, with the engine plumbing in #370, what the #343 Prompts panel shows). Vanilla disables Eco, since a removed prompt has nothing left to trim.
