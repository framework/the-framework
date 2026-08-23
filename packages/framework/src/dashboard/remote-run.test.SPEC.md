What the tests cover, for running an agent on another device:

- **Starting** — the start request reaches the device's relay start endpoint carrying the prompt, the kind of work and the options, authenticated by the shared token as a cookie and deliberately without an origin so the device's cross-site guard lets it through; the device's own agent identity comes back; a device that refuses answers as an ordinary failure result naming the device, not as a transport error.
- **Reachability** — a saved device is probed with a token-carrying ping and reads as online on success, offline on a refusal, and offline when nothing is listening at all.
- **Event streaming** — the device's events arrive in order, a line split across two network chunks is reassembled rather than dropped, the stream ends when the device closes the body, and a device that rejects the token ends the stream cleanly with no events, so the dashboard sees a normal ending rather than a lost connection.
- **Forwarded actions** — a read or steering action reaches the device's relay action endpoint with its name and arguments, again cookie-authenticated and origin-free, and the device's own result comes back unwrapped; a device that fails the action raises an error naming the device.
- **The relayed agent's list row** — a relayed agent shows up in its own project's agent list and in no other, marked as remote and carrying what it was asked to do; its status mirrors the device, flipping to done, stopped or failed according to how the agent ended, and to stopped when the stream simply drops with no ending at all; while the device has the agent parked on the user, the row reads as waiting — still live, not terminal.
- **Lifetime** — the event stream is gone once the device closes it, but which device the agent ran on is still remembered so a later push or PR can reach that machine; shutting the daemon down clears both the list of relayed agents and their remembered devices.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
