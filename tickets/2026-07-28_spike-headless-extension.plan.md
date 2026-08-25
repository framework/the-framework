Effort: 5
Uncertainty: 6
Outdated: yes

# [Plan] Spike: Is it possible to make the extension headless?

Yes — headless Chrome runs the bridge extension end to end, proven by experiment on this machine; the open questions are not technical but about keeping a claude.ai login alive in a second profile and whether unattended operation is a posture the maintainer wants.

## TLDR

Everything the extension needs works under `--headless=new` in branded Chrome 150. Verified by running the real `spike/cc-web-extension` against a real claude.ai and a stub daemon:

| Question | Result |
| --- | --- |
| Can an unpacked MV3 extension load in branded headless Chrome? | Yes, via CDP `Extensions.loadUnpacked` over `--remote-debugging-pipe` |
| Does the MV3 service worker run? | Yes, target `chrome-extension://…/background.js` present |
| Do `chrome.alarms` fire? | Yes, `tf-answers` @30 s and `tf-sessions` @60 s, on time for 100 s |
| Does the daemon get authenticated polls? | Yes, `GET /_bridge/sessions` with `Authorization: Bearer …` on every beat |
| Does the content script inject into claude.ai? | Yes, `#tf-bridge-panel` present in the page DOM |
| Does `chrome.tabs.create({active:false,pinned:true})` work? | Yes |
| Does the `MutationObserver` fire in a hidden tab? | Yes |
| Does Cloudflare let a headless browser through? | Only after overriding the `HeadlessChrome` user agent — see below |

Two things must be dealt with before this is usable, one hard blocker and one bug the spike surfaced:

1. **A headless profile has no claude.ai login, and nothing in the plan can create one** — a human must sign in once per profile. Everything downstream depends on that session surviving.
2. **The tab sweep storms when a watched tab does not land on `/code/session_*`** — measured one new pinned tab per minute, unbounded. This is a live bug in the headed extension too, not a headless-only artifact.

## What was actually measured

All numbers below come from scripted CDP runs against `/Applications/Google Chrome.app` reporting `Chrome/150.0.7871.186`, macOS 25.5.0, loading the unmodified extension from `spike/cc-web-extension/`.

### Loading the extension at all

`--load-extension` was removed from branded Chrome builds in Chrome 137, and `--disable-extensions-except` in 139, so the obvious approach is gone. The supported replacement works: launch with `--remote-debugging-pipe --enable-unsafe-extension-debugging`, then call `Extensions.loadUnpacked({path})`. It returned an extension id and the service worker appeared as a target within ~2 s. Chromium and Chrome for Testing still accept `--load-extension`, so that is a fallback, but it means shipping a second browser binary.

### Cloudflare is the gatekeeper, and the user agent is the tell

A plain `--headless=new` navigation to `https://claude.ai/` sat on `Just a moment…` (Cloudflare Turnstile) for the full 45 s it was watched — it never resolved. Two isolating runs found what triggers it:

- `--headless=new --user-agent=<normal Chrome 150 UA> --disable-blink-features=AutomationControlled` → reached `https://claude.ai/login`, `navigator.webdriver === false`.
- Headed Chrome parked offscreen at `--window-position=-3000,-3000`, no UA override → also reached `/login`, and `navigator.webdriver` was still `true`.

So the discriminator was the `HeadlessChrome/150.0.0.0` token in the default headless user agent, not `navigator.webdriver`. Worth being honest about what that means: passing the check requires telling Cloudflare the browser is something it is not. That is a policy decision (see below), not a technical detail, and it is also fragile — a future Cloudflare heuristic can close it with no warning and no error message beyond a stuck page.

### Hidden-tab throttling: the observer survives, timers do not

Every tab in headless reports `document.visibilityState === 'hidden'`, including the one that was just created. Measured in that tab:

- Five sequential 1 s timeouts took **8954 ms** instead of ~5000 ms — timers run at roughly half speed.
- `requestAnimationFrame` **never fired** within 3 s.
- `MutationObserver` **fired normally**.

This is the good case for the current design. `content.js:652-688` already assumes a background tab and leans on the observer with the interval as a backstop only — the comment there anticipates exactly this. The 250 ms debounce becomes ~500 ms and the 30×`POLL_MS` heartbeat drifts, neither of which matters. Any future code that reaches for `requestAnimationFrame` or a tight interval would break silently.

### The tab storm

With a stub daemon watching one session and a logged-out profile, the watched URL `https://claude.ai/code/session_spikeTest` redirected to `/login?returnTo=…`. `openWatchedTabs` (`background.js:268-269`) computes what is already open with `chrome.tabs.query({url:'https://claude.ai/code/*'})` and matches the session id out of the URL — a tab sitting on `/login` matches neither, so the session looks unopened. Measured: 1 tab after one minute, 2 after two, 3 after three, `lastOpen` cheerfully reporting `{ok:true, opened:1}` each time. It is unbounded, and `closeStaleTabs` will not clean up because the session is still watched.

Headless makes this worse (nobody sees the tabs pile up) but does not cause it. A signed-out user, an expired session, or claude.ai serving an interstitial produces the same storm in a normal browser today.

## Problems

### 1. Getting and keeping a claude.ai login in the headless profile — uncertainty 8

The extension deliberately holds no claude.ai credential: it has no `cookies` permission, no claude.ai `host_permissions`, and never fetches claude.ai. It works because it runs inside a profile the user already signed in to (`README.md:7`, `registry.ts:134-136`). A fresh `--user-data-dir` has no such session, and this spike cannot create one — signing in is exactly the thing an agent must hand to a human.

Compounding constraints:

- **The user's real profile cannot be shared.** Chrome holds a `SingletonLock` in `~/Library/Application Support/Google/Chrome/` (confirmed present, pointing at the running instance). A second Chrome on the same `--user-data-dir` will not start; forcing it risks corrupting the profile the user browses with.
- **Copying the profile is same-machine-only.** On macOS, cookie encryption keys live in the Keychain, so a copied profile decrypts on the same machine and user and nowhere else. That kills "copy the profile to the daemon box".
- **Session lifetime is unknown.** Nobody has measured how long a claude.ai session survives in an idle background profile, and this spike could not measure it without an account.

### 2. Is unattended operation something we want? — uncertainty 7

#610 ruled out driving the claude.ai UI on Usage Policy grounds. #1328 reversed that on 2026-07-28, and the reversal reads as narrow: the extension observes a session *the user is signed into and present for*. Headless plus unattended plus a spoofed user agent is materially further from that: no human at the keyboard, and an explicit step to look like a browser we are not.

This is the maintainer's call, not an implementation detail, and the plan should not quietly assume the answer. Note that the two motivations differ in how much they need: **scale** (#1327's 10 concurrent tabs) does not require headless at all — a headed browser opens 10 background tabs perfectly well, and the tab cap in `bridge-sessions.spec.md:5-10` is 3 by choice, not by limit. Only **unattended running on a daemon machine** needs headless.

### 3. Headless on the machine that would actually run it — uncertainty 4

Every measurement here is macOS. A daemon box is likely Linux, where `--headless=new` behaves the same but a headed fallback needs Xvfb (zero occurrences repo-wide today). The offscreen-window trick that worked here needs a logged-in GUI session, so it is not available over SSH on macOS either.

### 4. Reusing the existing launcher — uncertainty 2

`packages/the-framework/src/browser.ts:59-93` already resolves a Chrome binary (`CHROME_PATH`, `PUPPETEER_EXECUTABLE_PATH`, `chromium`, `chromium-browser`) and builds `chromeLaunchArgs` with `--headless=new` and `--remote-debugging-port`. It deliberately uses a throwaway `--user-data-dir` (`:85-88`) "so a run never inherits (or dirties) the user's real Chrome session" — the exact opposite of what a bridge browser needs, which is one persistent profile that keeps its login. Reuse the binary resolution, do not reuse the profile policy.

## Solutions

### For the login (problem 1), in order of preference

1. **One-time human sign-in into a dedicated persistent profile.** Launch Chrome *headed* once at a fixed `--user-data-dir` (e.g. `~/.the-framework/bridge-profile`), let the human sign in, close it. Every later run is headless against that same directory. Costs one manual step per machine, needs no credential handling, and never touches the user's own profile. This is the recommendation.
2. **Headed-but-out-of-the-way instead of headless.** Offscreen window position, or a separate macOS Space. Verified to pass Cloudflare with no UA spoofing. Removes problem 2's spoofing concern entirely but still needs a GUI session, so it does not solve unattended-on-a-server.
3. **Reuse the user's profile via a copy.** Same machine only, and stale the moment the real profile re-authenticates. Not recommended.
4. **Anything that handles the password itself.** Out of scope — do not build it.

### For the tab storm (surfaced by this spike)

Attribute an opened tab by the **tab id recorded in `openedTabs`**, which `background.js:287` already writes, instead of re-deriving the session from the live URL. A tab we opened for a session stays that session's tab even after a redirect. Add a per-session open attempt cap so a genuinely broken page cannot loop, and make `lastOpen` say "opened a tab but it landed on /login" rather than `{ok:true}` — the diagnostic failure here is as bad as the behavioural one. This deserves its own ticket; it is a bug in shipped behaviour, not headless work.

### For unattended detection of a lost login

The tab-storm fix gives this for free: if the tab we opened is sitting on `/login`, the bridge knows the profile is signed out. Surface it as a dashboard state ("bridge browser needs sign-in") rather than retrying, because retrying cannot fix it.

## Considerations

- **`--enable-unsafe-extension-debugging` is a real flag with a real name.** It is required for `Extensions.loadUnpacked` and it widens what anything holding the debugging pipe can do. The pipe (not `--remote-debugging-port`) is the right choice: a pipe is inherited by the child process only, whereas a port is a local TCP socket any process on the machine can attach to — and this browser would be holding a live claude.ai session.
- **Packing the extension avoids the flag entirely.** A `.crx` in the profile's extension directory, or an unpacked load done once through `chrome://extensions` during the same manual sign-in step, both drop the need for `--enable-unsafe-extension-debugging` on every launch. Worth trying before settling on the flag.
- **Alarm floor is 30 s and headless does not change it.** `tf-answers` at `periodInMinutes: 0.5` is already at Chrome's floor, so headless answer latency is the same 0–30 s as today.
- **The service worker still gets killed when idle** — the alarms are what revive it, and they were observed doing so. Nothing about headless changes the MV3 lifecycle.
- **Do not let the headless browser share `--user-data-dir` with `browser.ts`'s throwaway profile,** or a run will wipe the bridge login.
- **Crash and restart.** An unattended browser will die eventually. Whatever supervises it must restart it and must not restart it in a hot loop when the failure is a missing login.
- **`spike/cc-web-extension` is outside the pnpm workspace on purpose** (`spike/spec.md:1`), and its tests are the jsdom harness `check.mjs`. A CDP-driven headless test needs a real browser and does not belong in that harness; keep it as an opt-in script.
- **The unmerged `suleimansh/feat/1328-extension-sessions` branch changes the picture.** It adds session *creation* from the extension (repo picker → branch picker → composer). Creating a session headless is a much longer DOM interaction than reading one, and every step of it is on the throttled timers measured above. Land and stabilise that headed first.

## Implementation

Sequenced so the answer to problem 2 gates the expensive half.

1. **Report the spike result and get a decision on unattended operation.** Steps 2+ are worth nothing if the answer is "keep a human present". Include the user-agent spoofing point explicitly — it is the part a maintainer would want to weigh, and it is easy to bury.
2. **Fix the tab storm** under its own ticket, independently of headless. Attribute by recorded tab id, cap the attempts, and make `lastOpen` report a wrong-page landing. This ships value whatever the answer to step 1.
3. **Add a `bridge-browser` launcher** in `packages/the-framework/src/`, reusing `browser.ts`'s binary resolution but with a persistent profile at a fixed path. Two modes: `setup` (headed, no automation flags, for the one-time sign-in) and `run` (`--headless=new`, UA override, `--disable-blink-features=AutomationControlled`, `--remote-debugging-pipe`, plus `--enable-unsafe-extension-debugging` only if the packed-extension route in Considerations does not pan out).
4. **Load the extension and wait for readiness** — service worker target present, then write `daemonUrl` and `token` into `chrome.storage.local` from the daemon side so the options page is not part of the unattended path. Both were done successfully in this spike.
5. **Detect a signed-out profile and say so** in the dashboard instead of retrying, using the signal from step 2.
6. **Prove it end to end on one real session**, then measure the thing nobody knows: how long the login survives. Leave it running and record when it drops. That number decides whether this is a set-and-forget capability or one that needs a human every few days.
7. **Only then** consider raising the 3-tab cap for #1327. The cap is a deliberate choice about not accumulating tabs, and headless changes the reason for it without automatically changing the right value.

## Sources

- Chrome 137 removed `--load-extension`, Chrome 139 removed `--disable-extensions-except` and `--extensions-on-chrome-urls`, in branded builds only: [chromium-extensions PSA](https://groups.google.com/a/chromium.org/g/chromium-extensions/c/1-g8EFx2BBY/m/S0ET5wPjCAAJ), [What's happening in Chrome Extensions, June 2025](https://developer.chrome.com/blog/extension-news-june-2025)
- Remote debugging pipes as the replacement for loading unpacked extensions: [chromium-extensions RFC](https://groups.google.com/a/chromium.org/g/chromium-extensions/c/aEHdhDZ-V0E/m/UWP4-k32AgAJ)
