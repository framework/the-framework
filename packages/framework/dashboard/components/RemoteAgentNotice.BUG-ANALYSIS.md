# Bug analysis: packages/framework/dashboard/components/RemoteAgentNotice.tsx

## Business logic (high-level)

The agent view's banner for a remote-device agent (#1067 slice 2). SPEC requirements vs code:

- Names the device: "Running on {device}." — holds.
- States that worktree, diff, and pull request live on the device — holds verbatim.
- Warns the browser preview is unavailable for remote runs — holds.
- "Nothing is shown for an agent running on this machine, so the agent view can always include
  it": `if (!device) return null` — both `undefined` and `''` render nothing, so unconditional
  mounting is safe. Holds.

One wording nuance, not a bug: the SPEC/code say the worktree "lives on the device" while the
file's own comment notes diff/feed relay back and render normally — the banner is about physical
location, which is accurate either way.

Stateless, no effects, `role="status"` announces it politely; icon `aria-hidden` with the text
carrying the content. Nothing to leak or race.

## Functions (low-level)

### `RemoteAgentNotice({ device })`

Input: optional device label. Output: null or the one-line banner. Edge cases: empty-string
device → null (falsy check, correct — an unnamed device row cannot occur upstream anyway);
long device names wrap inside `min-w-0 flex-1`. Verdict: correct.

## Bugs found

None found.
