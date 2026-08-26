What the bridge browser settings line's tests cover, against faked daemon reads and actions.

- **A launch under way** - the line quotes the daemon's current step, download percentage included.
- **The sign-in page** - a running, minimized browser whose Driver tab reported claude.ai's sign-in page gets the sign-in prompt and a show button worded for it; pressing it asks the daemon to show the window.
- **A shown window** - offers to hide it, asking the daemon to; a Driver tab on any other page gets no sign-in prompt.
- **A stopped browser** - the reason is quoted and Restart asks the daemon to launch again.
- **Switched off** - nothing is rendered and nothing is read.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
