Effort: 6
Uncertainty: 7
Outdated: no

# [Plan] New skill: browser access (with limited permissions)

A spike and a first plan: how a standalone skill can give an agent a signed-in browser of its own, what "limited permissions" can actually be enforced, and the choices a human has to make before any code.

## TLDR

- Build a standalone package, `@gemstack/skill-browser`. It has a `SKILL.md` and a `browser` command. It launches one Chrome on a persistent profile that belongs to the skill, not the user's own Chrome. The agent drives it with the `chrome-devtools-mcp` tools it already has, attached by `--browserUrl`.
- "Read-only" is enforced inside the browser by a small extension. Its `declarativeNetRequest` rules block `POST`/`PUT`/`PATCH`/`DELETE` per site. The page cannot undo them, and they need no HTTPS man-in-the-middle.
- "Signed in or not" is a per-site cookie switch, set through `chrome.contentSettings.cookies` (block = signed out). Sites are listed by the domains that hold cookies. The command handles this first; a dashboard widget comes later.
- Before building, run a spike: a blanket write block probably breaks reading on the very sites the ticket names. Reddit's and X's web apps send some reads as `POST` (GraphQL). The spike decides the permission model.
- It is a guard rail, not a sandbox. The agent also has a shell and can start its own browser. Say so in `SKILL.md`.
- The ticket is low priority (2) and the design is a human call (skill architecture = Rom's). The picks below need a human before the build.

## What exists today (facts)

- `packages/framework/src/browser.ts` (`browser.LOGIC.md`): per agent, launches Chrome headless on a **throwaway** profile (`framework-chrome-*`) with a debugging port. It wires `chrome-devtools-mcp` through `npx` with `--browserUrl`, and sweeps orphans at daemon start. No logins survive, and there are no permission limits.
- `packages/framework/src/bridge-browser.ts`: a **persistent** profile (`the-framework-browser/`) on a downloaded Chrome for Testing. It frees the profile's `SingletonLock` holder, installs an unpacked extension over CDP (`loadUnpacked` + the developer-mode switch), and keeps the window minimized. The user signs in once through "Show the window". This is the proven way to load an extension into a Chrome the agent controls. `--load-extension` is ignored by branded Chrome.
- `packages/framework/prompts/protocols/browser.md`: the prompt text that tells an agent it has a browser.
- Skills are standalone packages (`packages/skill-logs` is the model: `SKILL.md`, `bin/<cmd>`, `src/`, `LOGIC.md`/`DECISIONS.md`). A skill must not know other skills or The Framework, and the framework core must not know skill names.

## Problems

1. **Does a write block leave reading intact?** (uncertainty 8) Many sites send reads as `POST`: GraphQL, search, "load more", analytics beacons. A blanket block may turn "browse Reddit" into a broken page. It is also unclear whether *any* rule by HTTP method matches "cannot post or change things" closely enough. Some writes are `GET` (rare), and WebSocket frames are not covered.
2. **Where the rules are enforced** (uncertainty 5): an extension (DNR), CDP `Fetch` interception, or a proxy.
3. **Signed-in dashboard: auth cookies vs tracking cookies** (uncertainty 6). The issue itself doubts that auth cookies can be told apart, so it suggests a per-site on/off switch.
4. **Who owns the browser process** (uncertainty 6): the skill's command (standalone) or the framework daemon (as with the bridge browser). This touches the "remove the daemon" direction.
5. **Package boundaries** (uncertainty 5): the Chrome discovery, CfT download, profile lock and CDP extension install now live inside `packages/framework`. A standalone skill cannot import them.
6. **How the agent reaches it** (uncertainty 4): through the `chrome-devtools-mcp` it already has, through a second MCP server entry, or through Playwright MCP.

## Solutions

1. Permission model:
   - a. **Block write methods per site, reads always allowed**, with an allowlist of "writes OK" sites. Simplest. Breaks POST-reads.
   - b. **Allow writes only to URL patterns listed as reads** (e.g. `*/graphql?*operationName=Search*`). Precise, but it is a per-site catalogue someone maintains.
   - c. **Ask before a write**: CDP `Fetch.requestPaused` holds the request and the agent/user approves. Most faithful to intent, but it needs a live CDP client and adds latency.
   - d. **Signed-out by default**: writes are harmless without a session, so the only lever is the cookie switch. No method rules at all. Cheapest shortcut. It drops "read my feed while signed in".
   - Recommendation: spike (a) on reddit.com and x.com first. If reads break, ship (d) + (a) as opt-in and park (b)/(c).
2. Enforcement:
   - a. **Extension + `declarativeNetRequest`** (`condition.requestMethods`, `initiatorDomains`/`requestDomains`, `action: block`). It lives in the browser, the page cannot bypass it, it works for HTTPS, and it survives any CDP client. It is installed the way the bridge browser installs its extension. ← recommended
   - b. **CDP `Fetch.enable` from the command**, with auto-attach to every target. No extension, but the rules exist only while that client runs, so a crash means unlimited writes.
   - c. **Local proxy (`--proxy-server`)**: it sees only `CONNECT` for HTTPS, so it cannot see the method without MITM certificates. Rejected.
3. Signed-in sites:
   - a. **List the domains holding cookies** (`Storage.getCookies` over CDP, grouped by registrable domain), and switch each with `chrome.contentSettings.cookies.set({ setting: 'block' })` plus clearing that site's cookies/storage for "sign out". ← recommended
   - b. A heuristic that names auth cookies (`HttpOnly` + `Secure` + session-like names). Unreliable, so use it for display only at most.
   - c. One profile per site. Clean isolation, but heavy, and one agent then needs many browsers.
4. Process owner:
   - a. **The skill's command**: `browser start` launches or reuses the Chrome (profile lock tells if it runs) and prints the `browserUrl`; `browser stop`. Fits "skills are standalone". ← recommended
   - b. The framework daemon, like the bridge browser. Rejected for now: the daemon is meant to shrink.
5. Shared code:
   - a. **Lift** Chrome discovery + profile lock + CDP install into a small package (e.g. `@gemstack/chrome-launch`), used by `framework` and the skill. ← recommended, as its own PR first
   - b. Copy into the skill (duplication).
6. Agent access:
   - a. **Point `chrome-devtools-mcp --browserUrl` at the skill's browser.** `SKILL.md` says: run `browser start`, then use the browser tools. Drawback: the MCP server's URL is fixed when the session starts, so a running session cannot switch browsers.
   - b. The skill ships an MCP config snippet / `.mcp.json` entry of its own (`browser mcp` → runs `chrome-devtools-mcp` against its own browser).
   - c. Playwright MCP, which has `--allowed-origins`/`--blocked-origins` and storage state. Only origin limits, not methods; to verify.
   - Recommendation: (b). The server starts the browser lazily, so the agent needs no ordering.

## Considerations

- **Not a sandbox**: an agent with Bash can start another Chrome or call sites with `curl` and a copied cookie. State it plainly in `SKILL.md` and the README. The limits protect against mistakes and prompt-injected pages, not a hostile agent.
- **Prompt injection**: a signed-in agent reading Twitter/Reddit reads attacker-written text. That is the main reason writes are off by default.
- **Cookie extraction**: `evaluate_script` can read non-`HttpOnly` cookies and localStorage and exfiltrate them over a `GET` (an image URL). A method block does not stop that. Signed-out-by-default limits it.
- **Signing in** needs a visible window and a human (never the agent: 2FA, captcha). `browser show` / `browser hide` are like the bridge browser's "Show the window". Headless and signed-in sessions: Cloudflare challenges headless Chrome (see #1332), so run it minimized and headed on macOS.
- **One browser, many agents**: concurrent agents on the same profile share tabs and logins. Decide between one shared instance (simple) and a lock per agent.
- **Profile location**: under the user's config dir (`$XDG_CONFIG_HOME`/`~/Library/Application Support`), never inside the repo. Logins must not be committed.
- **Rules persist in the profile**: dynamic DNR rules and content settings survive restarts. `browser rules` must show the live state, not a file that can drift.
- **Beacons and analytics** are POSTs too. Blocking them is fine, but a site may log errors or retry loops.
- **WebSockets / WebRTC / service-worker background sync** are outside DNR method rules. Document them as uncovered.
- **Windows/Linux**: the CfT download and profile lock already exist for macOS/Linux in `bridge-browser.ts`. Check the Windows lock file name.
- **Relation to the framework's `--browser` option**: that stays the throwaway browser for checking the user's app. This skill is the *signed-in, limited* browser for acting on the web. Do not merge them.
- **FEATURES-SPEC.md** is gone (see memory); add the feature where user-facing features are now listed, and write `LOGIC.md`/`DECISIONS.md` for the package per the ldd skill.

## Implementation

0. **Spike (no PR, ~1-2 h)**: start a CfT Chrome on a scratch profile, load a 20-line extension with DNR rules blocking write methods, sign in by hand to reddit.com and x.com, and record per site whether feed/search/scroll still work. Also check that `chrome.contentSettings.cookies` block signs the user out. Post the table on #1758 with the permission-model pick (Problem 1) for a human.
1. **PR 1: lift Chrome launching** out of `packages/framework` into `@gemstack/chrome-launch` (resolve path, CfT download, persistent-profile launch, `SingletonLock` owner, CDP connect, `loadUnpacked` + developer mode). `framework` imports it, with no behaviour change and its tests moved.
2. **PR 2: `@gemstack/skill-browser`**, modelled on `packages/skill-logs`:
   - `extension/`: manifest v3 with `declarativeNetRequest`, `contentSettings`, `cookies`, `browsingData`, `storage`; the service worker applies rules from `chrome.storage`.
   - `bin/browser` commands: `start` (launch or reuse, print `browserUrl`), `stop`, `show`/`hide`, `sites` (JSON: domain, has cookies, cookies allowed, writes allowed), `allow-writes <site>` / `block-writes <site>`, `sign-out <site>` (block cookies + clear site data), `allow-cookies <site>`, `mcp` (run `chrome-devtools-mcp --browserUrl` against a started browser).
   - Defaults: writes blocked everywhere, cookies allowed, so a human can sign in once and later choose which sites stay signed in.
   - `SKILL.md`: when to use it (acting on the web for the user) versus the plain browser tools; how the agent reads `sites`; that it never signs in or changes permissions itself unless told; the not-a-sandbox sentence.
   - Tests: command parsing, the rule set generated from the site list (pure), and one integration test against a local HTTP server that checks a blocked `POST` fails and a `GET` passes, skipped without Chrome.
3. **Later, separate ticket**: a dashboard widget that shows `sites` with the switches, once the dashboard takes skill widgets.

Picks for a human before step 1: the permission model (1), the process owner (4), and whether a lifted `chrome-launch` package is wanted (5).
