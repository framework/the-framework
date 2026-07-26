# YC application — draft answers

> `[Brackets]` mark facts to fill in before submitting.

## What is your company going to make? Please describe your product and what it does or will do.

The Framework ([the-framework.ai](https://the-framework.ai)) makes coding agents autonomous. Today you babysit agents (Claude Code, Codex): prompt, watch, correct, re-prompt. The Framework inverts that: agents continuously work through a task queue and escalate only when a decision genuinely needs a human. Before acting, an agent gauges its confidence and whether alternatives with real trade-offs exist — if so, the decision lands in your review queue; otherwise it proceeds. Agents also feed their own queue (testing, planning and prioritizing tickets, refactoring), which is what makes the system autonomous. You make the important decisions; AI does the rest.

It ships as an open-source npm package running on the Claude Code / Codex subscription you already pay for; the business is the hosted per-org version. It already builds itself: a growing share of our commits are authored end-to-end by agents it orchestrates.

## Why did you pick this idea to work on? Do you have domain expertise in this area? How do you know people need what you're making?

We live the pain daily: we code almost exclusively through agents, and the bottleneck is supervising them, not writing code. We kept building scaffolding for ourselves — queues, planning loops, decision gates — and realized the scaffolding is the product.

Rom has built open-source dev tools full-time for a decade and is the author of Vike ([vike.dev](https://vike.dev)), a widely used web framework [X downloads/week], and we already shipped our own agent runtime and orchestration stack (GemStack). Suleiman [one sentence on background].

How we know people need it: we use The Framework to build The Framework — agents author a growing share of our commits end-to-end. Babysitting is the #1 complaint of every team that adopted coding agents; models are no longer the bottleneck — the orchestration and decision-routing layer is, and it has to be open and tool-agnostic, which the labs won't build.
