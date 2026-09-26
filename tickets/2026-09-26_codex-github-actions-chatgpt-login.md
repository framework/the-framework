Topics: [agent-driver, codex]
Issue: [#1861](https://github.com/framework/the-framework/issues/1861)
Waiting: a way to keep a ChatGPT login on a CI runner (a self-hosted runner, a CI-only ChatGPT login saved back after each run, or a CI token from OpenAI)

# Codex on GitHub Actions needs a way to keep a ChatGPT login

## TLDR

`@agent-driver/github-actions` runs Claude Code today. Adding Codex is small on the driver side: one workflow step and Codex's output reader. The blocker is the login.

- `openai/codex-action` takes only an API key, billed per token: that breaks "your subscription, never a key".
- OpenAI's advanced route for trusted CI copies a ChatGPT login's `auth.json` to the runner, writes it only when missing, and keeps the file Codex refreshes for the next run. Private repos only, and they still recommend API keys.
- GitHub-hosted runners start fresh every run, so the refreshed login would have to be written back (for example into a secret) after every run, or the stored copy goes stale and runs fail. Reusing a laptop's login could also log that laptop out.
- Claude has `claude setup-token`, a long-lived token made for CI; Codex has nothing like it.

## Why it matters

Codex users can't run agents on GitHub Actions on their subscription.

## When it becomes worth building

- a self-hosted runner, where the Codex home stays on disk, or
- a separate ChatGPT login used only for CI, with the refreshed file saved back after each run, or
- OpenAI shipping a CI token like Claude's.

## Links

- [openai/codex-action](https://github.com/openai/codex-action)
- [Maintain Codex account auth in CI/CD (advanced)](https://developers.openai.com/codex/auth/ci-cd-auth)
- [Codex authentication](https://learn.chatgpt.com/docs/auth)
