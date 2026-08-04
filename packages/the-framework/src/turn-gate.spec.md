The code side of the turn-boundary protocol: parse the agent turn's **final message** for fenced blocks — blocking gates (`await-choices`, `await-multiselect`, `await-confirmation`, `await-browser`, `await-bind-project`, `await-create-project`) and non-blocking signals (`set-session-name`, `ready-for-merge`, `show-markdown`).

## Problems

- The driver runs each turn as a black box to completion, so the *only* way to learn that the agent stopped to ask (rather than deciding for itself) is a signal embedded in its last message.

## Decisions

- The protocol texts pin **how** to emit, never **when** — the system prompt owns the when — so the two can be edited independently.
- A bind-project gate's options are deliberately *not* in the agent's block: the framework fills them from the registry at resolution time, so the agent never guesses which projects exist.

## Facts

- Also builds the continuation prompts and the canned decline / no-projects messages; the four protocol texts are re-exported from the generated prompt constants.
- The await protocol carries the hand-the-browser-to-a-human rule: on a login wall, captcha, SSO or 2FA step the agent emits `await-browser` and stops — it never types a password and never attempts a captcha; the human acts in the streamed browser and the run resumes from their answer.

## Before modifying this file

Read this file's format at https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
