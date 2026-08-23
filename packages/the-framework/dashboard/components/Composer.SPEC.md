The dashboard's one prompt box, used everywhere the user types at an agent: the launcher, the chat inside an agent, and the navbar's quick launch. It holds the editor plus the controls that decide how the work runs, and hands the composed text to whoever hosts it.

## User story

- The user writes a task and starts an agent on it.
- The user talks to an agent that is already running, or resumes one that has ended.
- The user starts something from the navbar without leaving the page they are on.
- The user picks a canned prompt instead of writing one, and saves their own.
- The user chooses which coding-agent CLI, which model, and where the work runs.

## Business logic — TL;DR

- **One box, three hosts** - the launcher, the in-agent chat and the navbar quick launch all get the same editor, the same data and the same controls; only what happens on submit differs.
- **A preset prefills and then runs verbatim** - loading a preset fills the box with its rendered prompt and marks the work as a canned prompt; emptying the box turns it back into an ordinary task.
- **A preset can insist on its own agent** - some presets must open a new agent rather than talk to the one the user is sitting in.
- **Driver and model are picked together** - each driver lists only its own models, so an impossible pair cannot be chosen, and not choosing a model stays a state rather than pretending the first one was picked.
- **The options gear follows what the next action can still change** - the launcher's full option table, nothing while an agent is live, and just the options that shape a resume once it has ended.
- **An offline device blocks starting and says so** - with no silent fallback to another target.
- **The submit slot holds one control at a time** - an empty box shows Stop or Resume where the host provides one, and typing swaps in the send arrow.
- **A double submit cannot start two agents** - a second press while the first is still in flight is ignored.
- **A carried-in draft is restored** - a draft handed over from another device or from the click that navigated here seeds the box.

## Business logic

### One box, three hosts

#### User story

The user types at an agent from the launcher, from inside an agent, or from the navbar.

#### Business logic

The composer is the editor — with its `/`, `<`, `@` and `#` triggers for presets, files and project mentions — plus a control row holding the presets menu, the driver and model choice, the options gear and the submit control. The host owns what submitting does: the launcher starts an agent with the collected options, the in-agent chat sends a message.

Mentions feed the agent's context: mentioning a project or a file adds its path, and removing that mention from the box drops it again. The list of registered projects for the `@` picker is the composer's own concern, so it loads that list itself instead of every host passing the same list down.

The compact form, used by the navbar's quick launch, is a single row — the editor, the driver and model choice, the options gear and the submit control — deliberately kept to one line so the header never grows taller. It carries no presets menu and no preset-creation panel, but the `/`, `<`, `@` and `#` triggers still work, and the driver, model and options it uses are the same shared preferences the launcher writes.

#### Rationale

The driver and model choice and the options gear were the compact form's one real omission: an agent started from the navbar used the stored driver, model and options with nothing on screen saying which.

### A preset prefills and then runs verbatim

#### User story

The user picks a canned prompt instead of writing one.

#### Business logic

Loading a preset — from the `/` menu or from the presets menu — puts its rendered prompt into the box and marks what will be run as a canned prompt, sent verbatim. Emptying the box is a fresh start: the work goes back to being an ordinary task, and any rule the preset carried is dropped with it.

Presets render against the agent they are launched from: an agent's page passes its own session name, so a preset launched there targets that agent by default, while the launcher passes none and the preset falls through to the whole codebase.

The presets menu offers loading, creating and deleting in one place, for the framework's own presets, the user's saved presets, and the presets committed in the open project's repo. Deleting removes it from whichever of those two lists it belongs to. Creating one saves it either to the user's own presets or, when a project is open, into that project's repo.

#### Rationale

The list of presets, their order and each preset's label live with the presets themselves, so a preset's identity and the button that starts it cannot drift apart.

### A preset can insist on its own agent

#### User story

The user launches a preset from inside an agent, but that preset describes work that must not join the current conversation.

#### Business logic

A preset can declare that it needs an agent of its own. When such a preset is loaded, the two hosts that sit inside an agent start a new agent instead of sending into the agent they are in. Emptying the box drops the preset and this rule with it.

### Driver and model are picked together

#### User story

The user chooses which coding-agent CLI does the work, and on which model.

#### Business logic

Driver and model are chosen from one menu in which each driver lists only its own models, since the model choice passes straight through to that CLI. Picking a model inside a driver's submenu sets both at once, so an incompatible pair cannot be chosen. Every entry is a real model; not having chosen a model is still a state, but no longer something to pick, and the control says so rather than naming the first model as if it had been chosen.

The choice is hidden inside an agent: an agent is bound to the driver it started with, so the control would only ever rewrite the next agent's default. It is made at the launcher instead.

#### Rationale

A "Default" entry used to head each model list, and picking it stored nothing — so the menu's own answer to "which model?" was "we do not know".

### The options gear follows what the next action can still change

#### User story

The user opens the gear inside a running agent and finds nothing they can usefully change.

#### Business logic

At the launcher the gear holds the full table of the user's options, plus the choice of where the work runs — this device, a GitHub Actions runner, or a saved device — and the saved-devices section for connecting to, adding and removing devices. Selecting a device makes it the target for the next agent in place, with no navigation.

Inside an agent the gear behaves according to what the next action can still affect. While the agent is live, every option was baked in when it was spawned, so the gear is dropped entirely rather than opening empty. Once the agent has ended, the next message is a resume — a new leg that resolves the current preferences when it starts — so the gear comes back, labelled as resume options and holding only the options that shape that leg. Where the work runs stays a launcher-only choice, for the same reason the driver choice is.

The "In play" row, which shows how each option was resolved and which layer decided it, is shown at the launcher only. Inside an agent it described the user's global options rather than that agent's, and the compact row has no space for it.

### An offline device blocks starting and says so

#### User story

The user picks a device to run on, and that device is not reachable.

#### Business logic

When the selected device is known to be offline, submitting is blocked — by button and by keyboard alike — and a message names the device and points back at the "Run on" choice to pick another target. There is no automatic fallback to another target. A device whose status is unknown does not block anything. Removing a saved device that was the selected target also clears that selection.

### The submit slot holds one control at a time

#### User story

The user looks at one place for Start, Stop, Resume and Send.

#### Business logic

Submitting is a single arrow button that appears only once the box has text — an empty launcher has nothing to send. Where the host supplies an idle control, that control occupies the same slot while the box is empty: Stop while the agent is live, Resume once it has stopped. Typing swaps it for the send arrow, so start, stop, resume and send are one slot. Without an idle control the slot simply collapses when empty.

The submit control names what it will do and states its keyboard shortcut: Enter to send, Shift+Enter for a new line. While the work is in flight it shows itself as busy.

### A double submit cannot start two agents

#### User story

The user presses the send shortcut twice in quick succession.

#### Business logic

A submit is refused while another is still in flight, independently of the busy state the host reports. Otherwise two fast presses both saw the composer as idle, fired two starts, and the second surfaced a spurious "already active" error.

### A carried-in draft is restored

#### User story

The user starts typing on one device, or clicks something that hands a prompt to the launcher, and expects the text to be there.

#### Business logic

At the launcher, a draft carried in — from another device, or from the click that navigated here — seeds the box. It is taken once and cleared, and it stays an ordinary task rather than becoming a canned prompt.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
