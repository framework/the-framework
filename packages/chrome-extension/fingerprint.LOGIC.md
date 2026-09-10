Tells whether the extension's own files changed on disk, so the worker [1] can reload the extension after an edit without anyone clicking on `chrome://extensions`: a short hash of each of the seven files Chrome loads for the extension (`manifest.json`, `background.js`, `driver-plan.js`, `fingerprint.js`, `content.js`, `options.html`, `options.js`), taken from the files as they are on disk right now, and the list of files whose hash differs between two such fingerprints, in that order.

## Glossary

[1] worker: the extension's background service worker: the half of the extension that holds the bridge token and talks to the daemon; Chrome runs it without any page and ends it when idle.

## Business logic — TL;DR

- **Every file Chrome loads is watched, and nothing else** - the manifest, the worker [1] and the two scripts it loads, the content script, and the options page with its script; the offline tests pin the list to what the manifest and the pages actually load.
- **A change is any difference** - the hash is enough to tell an edit apart; nobody is attacking it, so it is not a cryptographic one.
- **A file that cannot be read is never a change** - a read failure fails the whole fingerprint rather than standing in for a changed file, because a reload on a read that merely failed once would reload the extension in a loop.
