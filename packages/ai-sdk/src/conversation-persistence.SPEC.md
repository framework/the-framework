Wraps an agent run with conversation memory: the thread's history loads before the call, the new turn appends after, and the thread id is stamped on the result.

## TLDR

- The effective conversation choice resolves per call: a per-call override beats the agent class's declaration, and lacking both a user and a thread id means running stateless.
- Given a user, the most recent thread for that user and agent class is resumed, or a fresh one created; given an explicit thread id, the thread loads after an ownership check.
- Resuming by id is refused when the thread belongs to someone else, so holding an id alone never opens another user's history; the dedicated refusal error never names the real owner and lets servers answer 403 rather than 500.
- An optional validation hook compares the caller's claimed history against the full persisted thread before anything runs.
- A history limit can shrink what the model sees without shrinking the trusted baseline used for validation.

## Rationales

- Ownership is inferred from the store's listings (the store contract has no owner lookup); threads with no recorded owner stay resumable so pre-existing data keeps working — except when the store demonstrably hides rows from its listing, where absence proves nothing and the resume is refused rather than failing open.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
