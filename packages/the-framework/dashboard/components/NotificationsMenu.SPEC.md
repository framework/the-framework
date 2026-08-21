The single notifications bell in the sidebar's utility footer, making the model legible: where notifications are delivered, and which categories trigger them.

## Flows

- The bell lights only when a method would actually deliver: browser needs its permission granted, Discord needs a configured credential on top of the toggle — a switch that delivers nothing must not read as a promise to page the user.
- "Human Queue" (an agent awaiting the user, or a PR to review) is the default-on baseline but a real toggle; "New activity" (an agent started or finished) is opt-in on top.
- Turning browser delivery on asks the browser for permission on that same click, and a permission blocked in browser settings disables the toggle with the reason.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
