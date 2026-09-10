What the tests cover:

- **A device that answers** - it reads as online, and the check hands the local daemon the device's address and token so the daemon is the one that reaches out.
- **A device that does not answer** - it reads as offline.
- **No saved devices** - nothing is checked at all and every device reads as unknown rather than offline.
