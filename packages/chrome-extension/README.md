# Claude web bridge

Reports the question a Claude Code cloud session is parked on to your local The Framework
dashboard (#1237). A cloud run hands off and ends, so when the session later asks something there
is nothing streaming back and the question is stranded on claude.ai. This carries it home.

It reads the session page you are already signed into, and since v0.7.0 it also carries your
answer back: answer the question in the dashboard — the same panel a local agent's question
gets, multi-select included — and the extension types the answer into the session's composer and
submits it. What it types is composed by the daemon from labels the session itself offered (the
same "You paused to ask … The user chose …" a local agent is re-prompted with; a `stop` option
tells the session the user is taking over), and a queued answer can be withdrawn until the
extension collects it.

A cloud session started by The Framework asks its questions like a local agent does (#1554); with
the bridge off it simply waits on claude.ai for an answer typed there.

## Set it up

1. **Turn the bridge on in The Framework.** It is off by default; it opens the daemon's one route
   reachable from another origin, so it is an explicit choice.
2. **Load the extension**: `chrome://extensions` -> Developer mode -> Load unpacked -> this directory.
2b. **Grant site access.** On the extension's Details page, under **Site access**, switch on
   `http://localhost/*`, `http://127.0.0.1/*` and `https://claude.ai/*`. Declaring host
   permissions in the manifest does not grant them, and for an unpacked extension they can sit
   off. Without the localhost grant the worker's fetch is blocked before it leaves the browser,
   the daemon sees nothing, and it looks exactly like a wrong token.
3. **Paste the token**: the extension's Options page. Hit *Save and test*, which pings the daemon
   and tells you which of the two failure modes you have (bridge off, or wrong token).
4. Open a cloud session. The dashboard shows the question within a few seconds.

The tab does not have to be visible. Content scripts run in background tabs, so a pinned inactive
tab is enough, and Chrome only has to be running.

## How it is put together

| file | does |
|---|---|
| `content.js` | finds the question in the page, hands it to the worker; types a delivered answer into the composer and submits |
| `background.js` | holds the token, posts to `/_bridge/question`, dedupes repeats, polls `/_bridge/answer` and acks deliveries |
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

Fifteen cases: the ten extraction ones, including the four that broke it on a real session
(`<code>` with no `<pre>`, content behind a shadow root, an indentation the parser had not
guessed, and our own protocol spec appearing on the page as a decoy), one pinning that a block's
`multi`/`default`/`stop` reach the daemon whole, three for the answer delivery: fill and click
send, the Enter fallback, and refusing a page with no composer, and one for the panel's collapse
toggle folding it down to a compact `TF` tab and back.

After editing any file here, reload the extension on `chrome://extensions` AND reload the open
claude.ai tabs: reloading the extension does not re-inject content scripts, and an orphaned
script cannot hear the new worker. The panel shows the manifest version, which is how you tell
a stale script from a current one.
