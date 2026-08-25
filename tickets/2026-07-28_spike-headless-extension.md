Priority: 8
Topics: [UX]
GitHub: [#1332](https://github.com/framework/the-framework/issues/1332)

# Spike: Is it possible to make the extension headless?

## TLDR

**Answered on the thread (2026-08-24): no — and the blocker is not Chrome.** The extension itself runs headless end to end (Chrome for Testing 150, `--headless=new`: the MV3 worker loads, `chrome.storage.local`, `chrome.tabs.create` and `chrome.tabs.sendMessage` to the content script all work; branded Chrome 151 is out entirely, it has ignored `--load-extension` since 137). What fails is claude.ai: Cloudflare's "Performing security verification" interstitial never clears in a headless browser and clears instantly for the *same binary, same fresh profile, same extension* run headed. Cookies do not help — a profile already carrying Cloudflare's clearance cookie is still blocked headless. Faking the fingerprint to look headed was considered and rejected: bot-detection arms race, and the Usage Policy exposure from #1330. No Chrome flag fixes it, because the block belongs to claude.ai, not to Chrome.

There is also **no invisible tab inside the user's Chrome**: a pinned tab still sits in the strip; a separate window minimized right after opening works and keeps the content script running, but shows in the Dock/taskbar; an off-screen window position is refused for extensions; and hosting claude.ai in an offscreen iframe is dead — even with `X-Frame-Options` stripped (tested) it lands on a bot captcha, and claude.ai's `SameSite=Lax` cookies do not travel cross-site. So one page cannot hold N sessions; each session still needs its own tab.

What the work becomes — three options on the table, and a fourth shape proposed since:

- **Option A (curator's pick).** The daemon owns the browser: it launches Chrome for Testing with a persistent profile, `--load-extension`, `--remote-debugging-port`, seeds the token over CDP, and puts the window off-screen at launch (allowed there, tested, passes Cloudflare) or under Xvfb on Linux. Human signs in once; from then on `extensionAlive` (`bridge-store.ts`, 3-minute window) holds for as long as the daemon runs, so web runs stop depending on the user's Chrome being open. Seam: a sibling of `browser.ts`'s `launchSharedBrowser` — persistent profile instead of throwaway, headed, extension flags, Chrome-for-Testing binary. Cost: one more Chrome process (~300 MB), a window that exists, and a re-login when the claude.ai session expires.
- **Option B.** Keep today's setup — the user's own Chrome, extension installed, worker polling on alarms so no tab needs to be visible; the daemon answers 409 when Chrome is down. Zero work.
- **Option C.** Cookie out of the extension, daemon talks to claude.ai's internal API. Deliberately untested and not recommended: undocumented API, Cloudflare very likely challenges a non-browser client the same way, clearest policy exposure of the three.
- **Maintainer proposal, 2026-08-25 (open — awaiting a reply to "do you see any holes?").** claude.ai/code renders a per-session status icon; use it to cycle one driver tab efficiently across many agents rather than holding a tab each — the concern is 50 agents, not 10. Make that tab explicitly the framework's: a full-page overlay headed "The Framework Driver" explaining what the tab is, with a collapsible "Show debug logs".

**Concurrency is a smaller problem than it looked.** Sessions run in Anthropic's cloud and keep going with the browser closed; a tab is only needed to *notice* a question waiting for an answer. The extension holds at most 3 tabs and closes them itself, so the real gap at 10 sessions is that 7 go unwatched — cheap to fix by raising the cap or rotating one tab through the sessions (which is what the status-icon proposal above is for). The one genuinely headless piece is the CLI: `claude -p "…" --cloud` can *answer* without a browser, but cannot *see* that an answer is wanted.

## Why it matters

Labeled priority-high (was highest-prio at import). The extension path is the shipped direction for web runs — #1328 closed as completed on 2026-08-24 — so how far it scales, and whether it can run on an unattended daemon machine, is now a question about this bridge and nothing else. The spike settled the technical half; what is left is a decision (option A's daemon-owned browser vs. staying inside the user's Chrome with a smarter single driver tab) plus the tab-cap fix that pays off either way.

## Source

Imported from GitHub issue [framework/the-framework#1332](https://github.com/framework/the-framework/issues/1332), created 2026-07-28, labels: `priority: high`, `UX ✨`, 18 comments (last folded: 2026-08-25T11:39Z). Body was empty at first import (the original TLDR was inferred from the title and the #1328 context); as of 2026-08-17 it cross-links #1554 (choices support in the CC web driver) as the other half of full-fledged CC web support.

### Notes from the GitHub thread

- Maintainer (2026-07-31): if headless turns out not to be possible, the fallback is to use the extension merely to siphon the claude.ai cookie. Answered 2026-08-24 — the cookie solves login, not the block: Cloudflare challenges on how the browser looks, before the page loads.
- The spike ran on throwaway profiles with no login and no session spent, so nothing here is measured against a signed-in account; session lifetime in an idle profile is still unmeasured.
