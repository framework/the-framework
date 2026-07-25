priority: high

# What is "Spend what's left on the roadmap"?

## TLDR

The "Spend what's left on the roadmap" setting is not understandable from the UI (screenshot in the issue). Proposal: remove it — it may be superseded by the `<Quota>` component ticket (#960), which visualizes remaining quota and lets the user set the automatic-consumption limit directly.

## Why it matters

High priority as a dogfooding-found UX confusion: a setting the maintainer himself can't decode has to be renamed, explained, or removed. It also forces the real design question of where "spend remaining quota automatically" should live — as a checkbox, or as the #960 quota bar + slider.

## Source

Imported from GitHub issue [gemstack-land/the-framework#1138](https://github.com/gemstack-land/the-framework/issues/1138), created 2026-07-25, label: `priority: high`.

### Original description

I don't understand this setting:
<img width="1061" height="80" alt="Image" src="https://github.com/user-attachments/assets/29aa2563-62fd-47ff-8953-e1d357f3ef61" />

Let's remove it? Maybe the following ticket supersedes it?
- https://github.com/gemstack-land/the-framework/issues/960
