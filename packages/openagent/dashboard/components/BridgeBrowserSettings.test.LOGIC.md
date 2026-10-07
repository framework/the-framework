What the tests cover:

- **Starting** - a launch under way shows "Starting the bridge browser" with the step the daemon reports, download percentage included, so a minutes-long download does not read as a hang.
- **Running and the sign-in** - a running, minimized browser on claude.ai's sign-in page shows the "sign in once" sentence and the button "Show the window to sign in", which asks the daemon to show the window; a browser with its window shown offers "Hide the window", which asks the daemon to hide it, and a signed-in browser shows no sign-in sentence.
- **Stopped** - a browser that stopped shows "The bridge browser is not running" with the daemon's reason, and "Restart" asks the daemon to relaunch it.
- **Off** - with the bridge browser switch off nothing is rendered and the daemon is never asked.
