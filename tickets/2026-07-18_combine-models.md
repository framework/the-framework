topics: [the-framework]

# Combine models

## TLDR

Let the loop combine models — e.g. Claude Fable writes the code, then GPT checks it with the refactor prompt and reports back — to stretch Claude usage (Fable consumes quota quickly). Simple implementation sketch: every prompt (each preset, the system prompt, TODO entries) can be assigned a (default) model. Explicitly postponed post-MVP: only do it if it's a quick win.

## Why it matters

Cross-model checking could meaningfully reduce Claude quota burn while keeping quality (requested by @nitedani from real usage). The main challenge is the UI for per-prompt model selection. Deprioritized in favor of what YC needs to see (queue, agentic PM, polished UX, landing page) — "YC knows such optimizations are usually done later."

## Source

Imported from GitHub issue [gemstack-land/the-framework#681](https://github.com/gemstack-land/the-framework/issues/681), created 2026-07-18, label: `the-framework ♻️`.

### Original description

Quoting @nitedani

> it would be nice if the loop can use claude + chatgpt together  
> claude fable writes the code  
> then gpt checks it with the refactor prompt and reports back to claude  
> this can help minimize claude usage, fable consumes it very quickly, even though i would prefer fable to do it  

I'd say let's do it only if it's a quick-in. (I think our other work is higher-prio for now.)

I think the biggest challenge is the UI part. But maybe a simple implementation would:
- For each preset, the user can choose a model
- Same for system prompt: the user can choose a model
- Same for TODO entries

In principle, each prompt should be attachable with a (default) model.

But, to be honest, I'm inclined to postpone this post-MVP. Let's focus on showing YC something they'll like (the queue, agentic PM, somewhat polished UX, nice langing page). YC knows such optimizations are usually done later.
