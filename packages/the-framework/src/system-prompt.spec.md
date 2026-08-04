The single assembly path for a run's system channel — shared by the build and direct-prompt flows so the two cannot drift.

## TLDR

- Fixed order: context bullets + the two format specs (ticketing, TODO) + the built-in prompt + the user's `SYSTEM.md`, then the browser section, the await protocol (+ topic-bind), hands-off, and the signal protocol last.
- The composed text is emitted as a `system-prompt` event and nothing is appended after it — the event **is** the whole channel, which is how the dashboard can show exactly what the agent runs under.

## Decisions

- Three levels of "less framework": `--vanilla` drops the built-in prompt and context docs but keeps the emit protocols (the agent must still drive the dashboard's gates); `--transparent` empties the channel entirely; eco flags drop individual sections. Protocols are the *emit contract*, not prompt content, so they are otherwise unconditional.
- Deliberately node-free so the dashboard renders the exact prompt in the browser before a run; the one Node edge (reading `SYSTEM.md`) lives in a separate file.

## Facts

- Section-dropping no-ops on a heading miss, so each eco mapping is pinned by a test against the real template.
- The renderer splits the template at the `# User prompt` heading and renders each half separately.

## Before modifying this file

Read this file's format at https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
