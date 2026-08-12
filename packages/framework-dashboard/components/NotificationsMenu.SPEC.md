The shell header's single notifications bell, making the model legible: where notifications are delivered, which categories trigger them, and — set apart — the Discord bot.

## TLDR

- The bell lights only when a method would actually deliver: browser needs its permission granted, Discord needs a configured credential on top of the toggle — a switch that delivers nothing must not read as "you will be paged".
- "Human Queue" (a session awaiting you, a PR to review) is the default-on baseline but a real toggle; "New activity" (a session started or finished) is opt-in on top.
- The Discord bot sits in its own Chat group because it takes messages in and acts on them, unlike everything above it, which posts outward.
- Turning browser delivery on asks the browser for permission on that same click, and a permission blocked in browser settings disables the toggle with the reason.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
