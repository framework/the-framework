What the tests cover:

- **A daemon that answers** - the probe is made and the daemon reads as healthy.
- **A daemon that does not answer** - a probe that fails flips the verdict to unreachable, which is what lets the dashboard say the daemon is not answering instead of freezing silently.
