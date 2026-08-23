What the tests cover: the menu presents delivery methods ("Deliver to": Browser, Discord) and categories ("Notify me about": Human Queue, New activity) as separate groups, with Human Queue a real toggle rather than a fixed always-on row; toggling any of them writes that preference through, including turning Human Queue off from its on-by-default state.

Browser permission: switching Browser on while permission has not yet been decided prompts the browser for it, and a browser that has blocked notifications shows the "Blocked in your browser settings" hint.

The bell's state read-out: it reads "Notifications on" when a method that can actually deliver is enabled and plain "Notifications" otherwise — Discord enabled with no webhook configured does not light it and instead explains that a webhook must be added in Settings, while a configured webhook does light it.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
