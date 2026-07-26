# YC Application — The Framework

## What is your company going to make? Please describe your product and what it does or will do.

The Framework makes coding agents work autonomously, so developers stop babysitting them.

Today, using an AI agent means sitting in a chat window feeding it one prompt at a time: re-explaining context it forgot, catching the lazy shortcut it took, approving every step. The agent is capable; the workflow around it is manual. The Framework inverts that — you make the important decisions, AI does the rest.

It's one command (`npm i -g @gemstack/the-framework`) and runs entirely on your machine. It doesn't ship its own model: it drives the coding-agent CLI you already pay for (Claude Code, Codex) as a black box, so you use your existing subscription — no API keys, no per-token margin, no lock-in. On top of that it adds two things:

**1. An enhanced system prompt** that forces the practices that actually raise output quality: divide large work into subtasks, enumerate the full checklist before writing code, self-gauge confidence, and self-gauge *variability* — if a plan has real alternatives with subtle trade-offs, ask the human instead of silently picking one.

**2. Two queues.** The **AI Queue** is a plain `TODO_AGENTS.md` file in your Git repo — the backlog agents pull from and, crucially, *write to themselves*. An agent that lands a complex change queues the post-merge refactor; routine security and code-quality passes get queued when quota is spare. That self-population is what makes it autonomous rather than a fancier prompt runner. The **Human Queue** is the cockpit: it collects only the decisions with genuine trade-offs, so you review those and nothing else.

Around that core: a localhost dashboard (usage quota, live agents, queued work, pending reviews, hot tickets), browser and Discord notifications, a Discord bot for agentic team conversations, autonomous product management (agents spike, plan, prioritize, test, and review tickets, and turn team conversations into tickets), and memory that lives in your repo as markdown — `knowledge-base/DECISIONS.md`, `INSIGHTS.md` — so the AI stops forgetting decisions and business context. Runs can be fanned out to Claude Code on the web (0% local CPU) or across a swarm of your own machines.

The local core is and stays 100% open source, free, and local — that's the distribution engine. The business is the layer teams need on top: hosted mode (agents running on a server instead of a laptop, so work continues with the lid closed) and an org layer with company / department / project scopes, shared knowledge bases, and real access boundaries between agents. Individual developers use it free; companies pay for the team substrate around it.

## Why did you pick this idea to work on? Do you have domain expertise in this area? How do you know people need what you're making?

We picked it because we hit the problem every day and the fix kept being the same fix.

Rom has spent a decade building developer frameworks: he created **Vike** (formerly `vite-plugin-ssr`, ~330k npm downloads/month) and **Telefunc**, both widely used in the Vite ecosystem. That's the exact expertise this needs — The Framework is a *framework*: its whole value is in the extension surface, the defaults, the escape hatches, and the community around it, which is what he's done for years. Suleiman is co-founder and CTO of Averotech, a software company shipping client work, which is where the pain is commercial rather than academic: agent babysitting is billable engineer time.

Working with coding agents daily, we kept writing the same patches by hand — appending "DON'T BE LAZY" and "WRITE CLEAN CODE" to prompts (barely works), re-pasting context the agent had forgotten, keeping a private TODO list of the follow-up work the agent should have queued itself, and repeatedly discovering it had made an architectural decision without asking. Those aren't prompt problems, they're missing *infrastructure*. Nobody was building the infrastructure, so we did.

How we know people need it: **we dogfood it on itself.** The Framework builds The Framework. Its own repo is run through the product — tickets, the AI queue, and agent-authored commits and sessions are all in the public history, with a knowledge base and 50+ tickets carried in Git. That's the hardest possible test of "does this actually produce mergeable work without a human in the loop", and it's the one we run every day. The next step in that loop is already scoped: a user files a GitHub issue and the AI reviews it, tickets it, plans it, and — if the plan has no significant variability — ships it, with the variability gate as the safety valve.

Beyond ourselves: the demand signal is that the entire industry adopted coding agents in ~18 months and every team is now running them the same manual way, one chat window at a time. Everyone we talk to has independently built some scrappy version of this — a scripts folder, a CLAUDE.md, a homegrown queue. When users keep rebuilding the same missing layer by hand, that layer wants to be a framework. That's the pattern Vike was built on too.
