What the tests cover: the shared prompt box and the controls around it.

The control row:

- The full form shows the presets button, the driver and model choice naming the current driver, the options gear, and — only once the box has text — the submit control.
- The compact navbar form keeps the driver and model choice and the options gear, and still starts an agent from what is typed.
- Inside an agent the driver and model choice is dropped while the rest of the row stays usable.
- An option's explanation matches what it actually does, and Browser is disabled with a stated reason when the chosen driver is not Claude Code.

Submitting:

- Submit is absent until the box has text, then enabled, and hands the text out as an ordinary task.
- The editor's keyboard shortcut submits the same way.
- What is typed is mirrored out to the host as it changes.

Presets:

- A preset that must open an agent of its own marks its submission as such; an ordinary preset does not. What is submitted is the preset's rendered prompt, not its menu label.
- Emptying the box drops the preset and its new-agent rule, so the next message is an ordinary task in the same agent.

Carried drafts:

- The launcher restores a draft carried from another device, as an ordinary task, taking it exactly once.
- The carried draft is really in the editor and not merely in what submitting would send.
- A composer sitting inside an agent does not consume a carried draft.

Where the work runs:

- A selected device that is offline blocks starting by both button and keyboard, and names the device in the reason, with no automatic fallback.
- An online selected device leaves starting enabled with no warning.

The in-agent options gear:

- A live agent drops the gear entirely rather than opening an empty menu.
- An ended agent offers exactly the options a resume can still arm — the publish ladder, auto-merge and Browser — while the prompt-shaping options and the choice of where the work runs stay out.
- Changing one of those options writes the shared preference the resumed leg resolves when it starts.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
