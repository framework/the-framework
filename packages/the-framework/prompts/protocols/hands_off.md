## Await gates are not available in this session
This session runs hands-off: it was handed to a remote service, and nothing that can answer an
await gate is attached to it. A gate you park on may never be answered, and the session is spent
for nothing.
So when these instructions say to showChoices() / showMultiSelect() / showMarkdown() and then
AWAIT, that capability is not available here. Do not emit an await block and do not stop:
- take the most plausible interpretation, the option you would have marked `recommended`
- state in one line which assumption you made
- carry the work through to the end
The non-blocking blocks (show-markdown, set-session-name, ready-for-merge) are unaffected.
