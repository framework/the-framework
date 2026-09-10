Holds what the daemon can actually deliver a notification on, as one shared answer the whole dashboard reads. A notification channel takes two things: the user switching it on, which is a preference [1], and the daemon holding the credential it needs, which is what this reports. Three places show it — the notifications menu, the Settings [2] rows and the Overview's [3] onboarding checklist — and one of them can change it, so they all read one value and settle on a change together.

## Context

**User story**: the user switches Discord notifications on. Without knowing whether the daemon has a webhook, the dashboard would let them enable a channel that delivers nothing and would show the channel as live. With it, the menu says "Not configured — add a webhook in Settings" until the credential is there.

**Problem**: the same fact is shown in three places at once. Each asking on its own timer meant that saving a webhook in Settings [2] left the checklist above it still saying the channel was not configured, so one page disagreed with itself about something the user had just done.

## Glossary

[1] preferences: The user's dashboard settings, kept in the registry (`~/.the-framework.json`, which also lists the projects).
[2] Settings: the settings page.
[3] the Overview: The dashboard's cross-project page at `/`.

## Business logic — TL;DR

- **Presence, never the credential** - the browser is told that a credential exists and where it came from, and never what it is.
- **One shared answer, re-read after a change** - it is fetched once however many places show it, and re-fetched on demand so every one of them changes together.
- **Not asked yet is not "not configured"** - before the first answer, nothing is claimed to be missing, so a page still loading does not accuse the user of an unfinished setup.
- **A failed read keeps what was known** - a daemon that does not answer is not evidence that a credential went away.

## Business logic

### Presence, never the credential

#### Context

**Problem**: the credential is a secret held by the daemon. A dashboard that could read it back would turn every browser with access into a copy of it.

#### Business logic

The answer says three things: whether a Discord webhook is set, where each credential came from, and whether this daemon can store a credential at all. Where a credential came from is either the daemon's environment or the daemon's own stored settings. That distinction is what lets Settings [2] offer to edit a credential it stores and, for one set in the environment, say so instead of offering an edit that would not take effect — the environment is how a deployment configures the machine, and a value typed into a browser must not quietly override it. No credential value ever travels to the browser.

### One shared answer, re-read after a change

#### Context

See `## Context`.

#### Business logic

The answer is fetched from the daemon the first time any part of the dashboard asks for it, and several places asking at once share that one fetch. Every place that shows it is updated together when the answer changes. After the user saves or clears a credential, the answer is re-fetched at once, so the menu, the rows and the checklist agree immediately rather than at the end of some timer.

### Not asked yet is not "not configured"

#### Context

**Problem**: an unanswered question and a negative answer are different, and treating them the same lights up "not configured" on a page that simply has not finished loading.

#### Business logic

Until the first answer arrives there is no reading at all, which every surface treats as capable rather than as missing. A page rendered before the browser is running has no daemon to ask, so it starts with no reading and gets the real one once the page is live. A caller that needs a reading rather than nothing gets one that reports no credentials and no ability to store any.

### A failed read keeps what was known

#### Context

**Problem**: flipping every channel to "not configured" because one request failed tells the user that their setup is broken when it is not.

#### Business logic

A read the daemon does not answer changes nothing: the last known reading stands, and nothing is shown to the user about the failure. The next read replaces it.
