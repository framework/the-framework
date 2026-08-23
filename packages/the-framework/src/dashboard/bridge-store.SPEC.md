Holds everything the Claude web bridge carries: the question each cloud session is parked on, the answer the user picked for it, that session's transcript so far, and the diagnostic record of what last reached the bridge.

## User story

- A cloud session parks on a question. The dashboard shows it next to the questions local agents are parked on, the user picks an option, and the extension types that option back into claude.ai — with the dashboard showing whether the delivery worked.
- The user follows a cloud session's conversation from the dashboard rather than from claude.ai.
- When the bridge is not working, the user needs to see whether anything is reaching the daemon at all, and which extension version it claims to be.

## Business logic — TL;DR

- **One parked question per cloud session** - the newest report replaces the previous one.
- **The same question, re-reported, stays the same question** - reports are compared by the text shown, not by when they arrived.
- **An answered question does not come back** - the delivered answer is remembered so the still-visible block on the page cannot resurface as parked.
- **A new question discards the old answer** - an undelivered pick for a question the session has moved past is never typed into it.
- **Only an option the session itself offered can be queued** - the bridge can never put arbitrary text into a claude.ai composer.
- **A queued answer can be withdrawn, until it is delivered** - once the extension has delivered it, it is too late.
- **A delivery report is matched by answer identity** - a stale report from a tab that died mid-delivery cannot resolve a newer answer.
- **The transcript is kept by position** - repeat reports of the same message overwrite rather than accumulate, and a bounded number of entries is kept per cloud session.
- **Nothing survives a daemon restart** - held in memory on purpose.
- **Contacts are recorded even when refused** - a refused request at least proves something is trying.

## Glossary

- **question fingerprint** - what makes two reports the same question: the title, the options and the recommendation — deliberately not the moment the report arrived.

## Business logic

### The parked question

#### User story

A `web`-target agent hands its task to a cloud session, and that session stops to ask the user something. There is no live local agent to park the question on: a hands-off agent is already finished by the time its cloud session asks anything. The question is held here instead, joined back to the agent by the cloud session id the agent recorded.

#### Business logic

Each cloud session has at most one parked question, and a newer report for that session replaces the older one.

Because the extension re-reads the page continuously, the same question is reported over and over. Two reports are the same question when their question fingerprint matches. A report that matches the question already parked is a re-report and changes nothing else. A report with a different fingerprint means the session moved on, which discards both any answer still queued for the old question and any memory of having answered it.

Everything is held in memory and nothing survives a daemon restart.

#### Rationale

Not persisting is deliberate: a question is only answerable while the session that asked it is still parked, and the extension re-reports whatever is on the page as soon as it reconnects. Surviving a restart would resurrect a question that may already have been answered somewhere else.

### Answering

#### User story

The user picks one of the options in the dashboard, and the extension types it back into the claude.ai composer.

#### Business logic

An answer can only be queued for a cloud session that has a question parked, and only with a label that question actually offers — anything else is refused with the reason. Queuing gives the answer its own identity and marks it as waiting for delivery.

A waiting answer can be withdrawn; one the extension has already delivered cannot.

The extension reports what its delivery attempt did. The report is only honoured when it names the answer that is actually waiting, so a stale report from a tab that died mid-delivery cannot resolve a newer answer. A successful delivery marks the answer as sent, drops the parked question, and remembers that question's fingerprint as answered — so the answered block still sitting in the page's DOM is ignored when the extension re-reports it, which it will, because its worker forgets what it sent when it restarts. A failed delivery marks the answer as failed and keeps the extension's reason, and leaves the question parked so the user can try again.

The dashboard reads the answer in whatever state it is in, so it can show queued, sent, or failed with its reason.

#### Rationale

Restricting the queued answer to a label the question itself offered is what bounds the whole feature: the only text this can ever put in a claude.ai composer is text that session offered.

### The transcript

#### Business logic

Each transcript entry is stored under its position in the cloud session's transcript, so a re-read of the page overwrites the entry it already reported instead of appending a duplicate, and a message still being streamed is replaced by its later, longer version. The transcript is read back in position order. Only the most recent entries are kept per cloud session, oldest dropped first, so a long session cannot grow without limit in a daemon that never restarts.

### Diagnosis

#### User story

A misconfigured extension and an extension that was never installed look identical from the dashboard — both leave no question behind. The user needs to tell them apart.

#### Business logic

The most recent contact with the bridge is kept: when it happened, which route it asked for and what it got, refusals included. The most recent extension version claim is kept too, with the version the daemon expected and whether the claim was turned away — accepted claims included, which is what lets a "your extension is out of date" banner clear itself the moment an updated extension gets through. What the script injected into the claude.ai page last reported about itself is kept as well.

### Clearing a cloud session

#### Business logic

A cloud session can be dropped entirely — its parked question, its transcript, its answer and its answered memory — once it is answered or its agent is gone.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
