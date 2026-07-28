The "Add project" modal (#396/#433): install a single repo, or every git repo directly under a directory, via the `sendAddProject` telefunction.

## TLDR

- Two-step form: submit a path → trust confirmation (#439/#314, plain-language prompt-injection warning) → daemon installs and registers.
- "It's a folder of repos" checkbox switches to directory mode; success shows "Added N projects · M already added" (a folder add used to register any number with zero feedback), then auto-closes after 2.5s.
- Hand-rolled dialog behavior (#948): Esc closes, Tab cycles inside the panel (manual focus trap over queried focusables), focus returns to the opener on unmount, click on the backdrop closes.
- Opened as a modal from the navbar project dropdown since #772 replaced the projects sidebar rail (the picker has no room for a two-step form).

## Decisions

- Trust gate before install (#439): adding a repo lets the agent read its files, so an untrusted repo is a prompt-injection risk — confirm trust explicitly, never add on first submit.
- Opener focus target is captured at mount (`document.activeElement`): the picker's Add item is gone by close time, so its trigger is the stable target.
