Holds one shared, always-current answer to "which notification channels can the daemon actually deliver on?" — whether a Discord webhook is set, where each Discord credential came from, and whether this daemon can store credentials at all — so every part of the dashboard that asks agrees.

## Business logic — TL;DR

- **One answer, shared** - the bell, the settings rows and the Onboarding checklist read the same value, and a save re-reads it for all of them at once.
- **Not-asked-yet is not not-configured** - until the first read lands, callers treat the daemon as capable rather than announcing missing credentials.
- **A failed read changes nothing** - a daemon hiccup keeps the last known answer instead of blanking every channel.

## Business logic

### One answer, shared

#### User story

Three places show what the daemon can deliver on — the notifications bell, the settings rows, and the Onboarding checklist — and the settings page can also change it by saving a Discord webhook. The checklist sits on the same page as the settings rows.

#### Business logic

All readers share a single stored answer, fetched once however many of them appear together. Saving a credential re-reads it immediately, so every reader settles on the new state at the same moment.

#### Rationale

When each place asked on its own timer, saving a webhook on the settings page left the checklist directly above it still saying "not configured" until its own timer came round — the page disagreeing with itself about a fact the user had just established.

### Not-asked-yet is not not-configured

#### User story

The user opens the dashboard; for a moment nothing has been read from the daemon yet.

#### Business logic

Before the first read lands, the answer is explicitly "not asked yet", distinct from "nothing configured". Callers show a not-asked-yet daemon as capable, so a page that has not finished loading never lights up "not configured". A caller that needs a concrete value instead of the not-asked-yet state gets the empty reading: no webhook, no credentials, nothing storable.

### A failed read changes nothing

#### User story

The daemon briefly fails to answer.

#### Business logic

A failed read leaves the last known answer in place.

#### Rationale

A daemon hiccup is not evidence that a credential went away, and blanking the answer would flip every channel row to "not configured".

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
