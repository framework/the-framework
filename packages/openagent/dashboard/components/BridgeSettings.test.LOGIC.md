What the tests cover:

- **A blocked extension** - when the daemon reports the extension's version as blocked, the panel's notice contains "blocked", both the extension's version and the expected one, and "chrome://extensions"; an accepted version shows no such notice while the setup text ("paste this token") still renders.
- **A rejected token** - when the bridge's last contact was refused as unauthorized, the notice says the dashboard rejects the token and to save the token again; an accepted contact shows no such notice; a version block and a refused contact reported together show only the version block.
