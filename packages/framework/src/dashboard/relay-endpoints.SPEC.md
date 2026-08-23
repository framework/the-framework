The device side of the relay: the endpoints a daemon exposes under `/_relay` so another daemon holding this device's token can start an agent here, watch it, steer it, and check that this device is reachable.

## User story

The user saves another machine as a device in the dashboard and launches an agent on it. That machine's daemon does the work; the user's own dashboard shows the device as online, streams the agent's events back live, and can read, steer, push and open a PR against the agent's checkout on that machine as if it were local.

## Business logic — TL;DR

- **Only an authenticated daemon gets in** - every relay route sits behind the shared-token guard, which admits a daemon presenting the token as a cookie; an unauthenticated caller never reaches these endpoints.
- **Start an agent here** - a relayed start runs an ordinary local agent on this device and answers with the same result a local start would.
- **Never relay onward** - a relayed start strips any nested run target, so a relayed agent can never bounce on to a third device.
- **Stream its events back** - the calling daemon tails the agent's event log until the agent ends or the caller disconnects.
- **Run-scoped steering** - a whitelisted set of read, diff, steer, handoff, push and PR actions can be run against this device's own checkout.
- **Reachability probe** - a ping answers with nothing and starts nothing; it exists purely so the dashboard can show a device as online or offline.
- **Relay off means gone** - a daemon that has not enabled the relay answers "not found" to every relay route except the ping.

## Business logic

### Only an authenticated daemon gets in, and reachability is its own probe

#### User story

The dashboard's device list shows each saved device as online or offline, and no unauthenticated caller may start work on this machine.

#### Business logic

All relay routes sit behind the shared-token guard. A daemon-to-daemon call passes by presenting the token as a cookie, without the redirect a browser would get; a caller with no valid token is rejected before reaching any relay handling at all.

The ping route answers success with an empty body and starts nothing. It deliberately works even on a daemon that wired no relay handlers, because its only job is to prove this daemon is reachable and the caller's token is valid. The online/offline status the dashboard shows is the local daemon pinging each saved device with that device's token.

### Start an agent here

#### User story

The user picks a device in the launcher and starts a task; it must run on that device exactly like a local agent, and report back the same way.

#### Business logic

A relayed start carries the prompt, the kind of work (build, research, or a raw prompt — anything unrecognised is treated as a build), and the same options a local start takes. It runs in this device's own checkout. Any nested run target inside the options is dropped before starting, so a relayed agent never relays onward to a third device. A start that fails is answered as a failure result with its message, rather than as a transport error, so the calling daemon reports it the same way it reports a local failure. The request body is size-capped, and a malformed or oversized body is rejected.

### Stream its events back, and steer it

#### User story

Watching a remote agent must feel the same as watching a local one: live events in the dashboard, with the same buttons — stop, answer a gate, chat, change handoff, push, open a PR.

#### Business logic

The events route names one agent and streams that agent's framework events as they happen, one JSON object per line, until the agent ends or the caller disconnects; a request naming no agent is rejected. When the calling daemon goes away mid-stream the tail is torn down rather than failing.

Steering and reads travel over a separate route that runs one named action with its arguments against this device's own checkout, answering with its result. Only a whitelisted set of actions is accepted; a request naming no action is rejected, an action that fails is answered as a server error carrying its message, and this route is unavailable on a daemon that wired no such actions. Its request body is size-capped the same way.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
