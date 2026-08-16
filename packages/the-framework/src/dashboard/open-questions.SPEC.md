Every session's open question gathered into one hub, so a human can answer any parked run from one place instead of hunting through session views.

## TLDR

- The full question — options, recommendation, whether several may be picked — is read back from each parked session's own log, because the run's summary record only carries the title.
- Longest-waiting first: the session blocked on its human the longest is the one to unblock first.
- A question the log no longer shows open (already answered, or unreadable) is dropped — offering an answer the daemon would refuse is worse than one card fewer.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
