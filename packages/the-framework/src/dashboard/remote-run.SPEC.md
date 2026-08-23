The calling side of the relay: how the local daemon runs an agent on another device, streams that agent's events back into the local dashboard, forwards reads and steering to the device, and keeps a local record of the agent so it shows up in the agent list like any other.

## User story

The user saves another machine as a device and launches a task on it. Their dashboard shows the device as online, then shows the remote agent in the agent list, streams its events live, lets them steer it, and — even after it has finished and its stream has closed — still lets them push it and open its PR on that machine. Reloading the dashboard re-opens the remote agent as if it had been local.

## Business logic — TL;DR

- **The daemon drives the device, never the browser** - the local daemon holds the device's token and makes every cross-machine call itself, so the browser only ever talks to its own origin and the token never leaves the two daemons.
- **Device online status** - a saved device is pinged with a short timeout; anything other than success — refusal, unreachable host, timeout — reads as offline.
- **A remote refusal looks like a local one** - a failed remote start comes back as an ordinary failure result with a readable message, so nothing downstream special-cases remote errors.
- **Events stream back into a local stream** - the remote agent's events are pumped into a local event stream the dashboard reads over its normal channel; malformed or partial lines are dropped rather than breaking the pump.
- **A rotated token ends the stream cleanly** - when the device stops accepting the token, the agent's stream finishes as a normal ending, not as a lost connection.
- **The device outlives the stream** - which device an agent ran on is remembered after its events stop, so pushing it and opening its PR still reach that machine.
- **A remote agent appears in the list** - a local record of each relayed agent is kept and updated from the streamed events, so the remote agent shows up in its project's agent list and survives a dashboard reload.

## Business logic

### The daemon drives the device, never the browser

#### User story

The user's browser must never hold another machine's credentials, and the user must not have to deal with cross-origin access between two daemons.

#### Business logic

The local daemon holds the saved device's token and makes every call to that device itself: starting the agent, streaming its events, forwarding reads and steering. The dashboard reads the result over its normal same-origin channel. Every relay call authenticates daemon-to-daemon by presenting the token as a cookie, which the device's guard accepts without the browser-only redirect. The token is held in memory for as long as it is needed and never written down.

### Device online status

#### User story

The device list shows a dot per saved device; a machine that is asleep or unreachable must show as offline promptly, not hang the list.

#### Business logic

A saved device is health-checked by a ping that starts nothing. Success means online; a refusal, an unreachable host, or a timeout all mean offline. The timeout is deliberately short because this is polled.

### Starting an agent on a device

#### User story

Launching on a device should behave exactly like launching locally, including how failures are shown.

#### Business logic

The prompt, the kind of work and the options are forwarded to the device, which starts an ordinary local agent there and answers with its own agent identity. A device that refuses, or that cannot be reached at all, produces an ordinary failure result carrying a readable message — "the device refused the run" or "could not reach the device" — in exactly the shape a local refusal has. The attempt is bounded by a timeout.

### Forwarding reads and steering to the device

#### User story

Every button the user has on a local agent — read its files, see its diff, answer its gate, change its handoff, push it, open its PR — must work on a remote agent too.

#### Business logic

Each such action is forwarded to the device that owns the agent and runs against that device's own checkout, answering with the device's result. Its timeout is generous, because a relayed push or PR does network work on the far machine. An unreachable device or a refusal raises a failure, so the caller falls back to the same empty-or-error result it uses when a local read fails.

### Streaming the agent's events back

#### User story

Watching a remote agent must look identical to watching a local one, and must end tidily when the device stops sending.

#### Business logic

The device's event stream is read continuously and each complete line is turned back into a framework event; an incomplete trailing line is held until the rest arrives, and a blank or malformed line is dropped rather than breaking the pump. The stream ends when the device closes it, when the agent ends, or when the local side cancels it. If the device refuses the connection — most often because its token was rotated — the stream ends cleanly, so the dashboard sees a normal ending rather than a lost connection.

### The device and the agent record outlive the stream

#### User story

An agent finishes on a device. Its events stop, but the user still wants to review it, push it, and open its PR — and after reloading the dashboard, still find it in the list.

#### Business logic

For each relayed agent the local daemon remembers which device it ran on, and keeps that memory after the event stream has ended, so post-run actions still reach the right machine; it is only forgotten when the daemon shuts down.

It also keeps a local agent record per relayed agent, tagged with the project it belongs to, so the agent appears in that project's agent list and can be re-opened after a dashboard reload. Every streamed event is folded into that record using the same rules that maintain a local agent's record, so it mirrors the device: the terminal status when the agent ends, the waiting flag while the agent is parked on a gate, the driver once its session starts. Because relayed events carry no local write time, each fold stamps its own.

Relayed agents are listed newest first within their project. Registering the same agent again replaces its running pump. If the stream drops without the agent ever reporting a terminal state, the record is marked stopped rather than left showing as running. On daemon shutdown every pump is cancelled, every stream closed, and every remembered device and agent record dropped.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
