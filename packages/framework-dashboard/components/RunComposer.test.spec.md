Tests for `RunComposer.tsx` — covers the three send modes and their wiring.

## TLDR

- Live (#714): ordinary submit goes to `sendMessage`, never `sendStart`; a new-session preset (#959) starts its own run (no `continueRunId`/`resumeSession`) and navigates to it; a refused start surfaces the busy reason without navigating.
- Finished (#720): send spins a `prompt` run with `resumeSession` + `continueRunId` (#762), never messages; resumes on the run's own driver not the agent pref (#831 — claude-code driver ⇒ no `--agent`, codex ⇒ `agent: 'codex'`, model never forwarded); `showAgentModel` is false.
- Finished with no session id (#1026): composer stays with the can't-continue *placeholder* (asserts no `<p>` note duplicates it), and sending starts a fresh run with no resume options.

## Facts

- The Composer child is mocked to two submit buttons plus a JSON props probe; preferences lib is mocked so #831 tests can set a conflicting global agent pref.
