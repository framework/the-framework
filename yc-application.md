# YC application — draft answers

> Draft based on [the-framework.ai](https://the-framework.ai) (the landing page), `Architecture.md`, and `tickets/`.
> Square brackets `[like this]` mark facts/numbers to fill in or double-check before submitting.

## What is your company going to make? Please describe your product and what it does or will do.

The Framework ([the-framework.ai](https://the-framework.ai)) turns coding agents into autonomous teammates. Today's agents (Claude Code, Codex) are powerful but need babysitting: you prompt, watch, correct, and re-prompt — the human is the event loop. The Framework inverts that: agents continuously work through a queue of tasks, and pull a human in only when a decision genuinely needs one. You make the important decisions; AI does the rest.

Concretely, it's an npm package that spins up a dashboard and orchestrates agents through the Claude Code / Codex subscription you already pay for. Two building blocks make agents trustworthy without supervision:

1. **An enhanced system prompt** encoding practices that reliably counter agent failure modes: divide-and-conquer task splitting, enumerate-then-execute coverage checklists, and — crucially — self-gauged confidence and plan variability. Before acting, the agent assesses whether alternative approaches with meaningful trade-offs exist. If yes, the decision is escalated to a human; if not, it proceeds autonomously.

2. **Two queues.** The AI Queue is the agents' backlog (a `TODO_AGENTS.md` file in your git repo), populated by humans and by the agents themselves — agents feeding their own queue is what makes the system autonomous. The Human Queue is your cockpit: pending decisions and reviews. Your job shifts from supervising code being written to reviewing decisions.

On top of that: autonomous product management (agents test, review, spike, plan, and prioritize tickets; turn team conversations into tickets), agent memory persisted in git (`knowledge-base/DECISIONS.md`), quota-aware scheduling (spare subscription capacity is spent on refactoring, code-quality, and security prompts), and browser/Discord notifications when AI needs you.

The core is open-source, local-first, and bring-your-own-subscription. The business is the hosted, per-organization version: sign in with GitHub, agents run server-side, the whole team shares queues and agent memory, and agents join the team's Slack/Discord as real teammates you can @mention.

It already works on itself: The Framework increasingly builds The Framework — a growing share of commits in our repo are authored end-to-end by agents it orchestrates.

## Why did you pick this idea to work on? Do you have domain expertise in this area? How do you know people need what you're making?

We live this pain daily. We develop almost exclusively through coding agents, and the bottleneck is no longer writing code — it's supervising the writer. Agents are lazy, make consequential decisions without asking, forget prior decisions, and write quick-and-dirty code unless watched; appending "DON'T BE LAZY" to prompts doesn't fix any of it. We kept building scaffolding for ourselves — task queues, planning loops, decision gates, knowledge files — and realized the scaffolding is the product: babysitting is a workflow problem, not a model problem, and it won't disappear with the next model release.

Domain expertise: Rom has built open-source developer tools full-time for a decade. He's the author of Vike ([vike.dev](https://vike.dev)), a widely used web framework [X downloads/week; used in production by companies such as Y] — he has spent years designing developer workflows, shipping tools developers adopt, and growing the communities around them, which also gives us a direct distribution channel to thousands of professional developers. Before The Framework we built the GemStack AI stack (an agent runtime, a skills system, an MCP server framework, and an autonomous-orchestration layer, all shipped on npm) — this is not our first agent infrastructure. Suleiman [one sentence on Suleiman's background].

How we know people need it: first, us — we use The Framework to build The Framework. Agents author a growing share of our commits end-to-end, and incoming GitHub issues get triaged, ticketed, and planned by agents. Second, babysitting is the dominant complaint wherever coding agents are adopted: every team that rolled out Claude Code or Cursor hits the same wall — the agents are capable of far more than the one-human-watching-one-agent supervision model allows. Third, timing: over the past year models crossed the capability threshold where autonomy fails on orchestration, not intelligence. What's missing is the layer that decides what agents work on next and when a human must be consulted — and that layer has to be tool-agnostic, open, and owned by the team, which is exactly what the model labs won't build.
