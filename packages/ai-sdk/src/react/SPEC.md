The browser side of a streamed agent conversation.

A component starts a run; text and tool activity stream in and render live. When the agent needs something only the browser can provide — a browser-side tool result, or a human's approval of a risky tool call — the run pauses, the UI prompts, and the same logical run resumes with the answer. Browser-tool pauses can resume automatically when the app supplies a resolver; approvals always wait for an explicit human decision. React appears only in the hook: the state machine and round-trip logic underneath are framework-free, exported for non-React consumers, and that is where the exhaustive tests live. The whole directory sits behind its own entry point so the rest of the SDK stays React-free.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
