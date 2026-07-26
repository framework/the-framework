# Claude web bridge

Reports the question a Claude Code cloud session is parked on to your local The Framework
dashboard (#1237). A cloud run hands off and ends, so when the session later asks something there
is nothing streaming back and the question is stranded on claude.ai. This carries it home.

It reads the session page you are already signed into. It does not answer for you: the pick
travelling back is a separate slice, and today the dashboard links you to the session to answer.

## Set it up

1. **Turn the bridge on in The Framework.** It is off by default; it opens the daemon's one route
   reachable from another origin, so it is an explicit choice.
2. **Load the extension**: `chrome://extensions` -> Developer mode -> Load unpacked -> this directory.
3. **Paste the token**: the extension's Options page. Hit *Save and test*, which pings the daemon
   and tells you which of the two failure modes you have (bridge off, or wrong token).
4. Open a cloud session. The dashboard shows the question within a few seconds.

The tab does not have to be visible. Content scripts run in background tabs, so a pinned inactive
tab is enough, and Chrome only has to be running.

## How it is put together

| file | does |
|---|---|
| `content.js` | finds the question in the page, hands it to the worker |
| `background.js` | holds the token, posts to `/_bridge/question`, dedupes repeats |
| `options.js` | where the token and dashboard URL are set, plus a connection test |
| `check.mjs` | runs `content.js` against synthetic pages in jsdom, no browser needed |

**The token lives in the worker, never in the page.** A content script shares a tab with
claude.ai, and nothing on that page should be able to read the secret that talks to a daemon. The
fetch has to live there too: a content-script fetch carries the page's origin, and the daemon
answers no CORS headers on purpose, because a wildcard would let any site you visit post to your
dashboard. A service worker with `host_permissions` is not subject to CORS.

**It watches rather than polls.** Chrome clamps timers in a tab hidden for more than about five
minutes to roughly once a minute, and this is meant to run in a background tab. A `MutationObserver`
catches the session's own DOM changes immediately; the slow interval is only a backstop.

## Checking the extraction

```
node check.mjs
```

Ten cases, including the four that broke it on a real session: `<code>` with no `<pre>`, content
behind a shadow root, an indentation the parser had not guessed, and our own protocol spec
appearing on the page as a decoy before the agent has asked anything.
