Feeds the dashboard's usage panel and answers, on demand, where the account stands against its quota boundary — both from one continuously polled reading of the account's quota, so the bar the user reads and the line unattended work obeys can never disagree.

## User story

The user wants to see, at any moment and even with nothing running, how much of their subscription's quota week is left, and to be told when the reading is stale rather than shown a blank or a misleading zero. Separately, before The Framework starts unattended work, it needs to know whether that work is still inside the pro-rated share of the week it may spend by now.

## Business logic — TL;DR

- **The account's own windows** - the panel shows the quota windows exactly as the driver reports them: the current session, the week, and the week per model.
- **Stale beats blank** - the last good reading is kept through a failed poll and marked stale, instead of being wiped.
- **Unknown is not "nothing allowed"** - when there is no reading, or the week's reset cannot be placed, the boundary is simply absent.
- **Two boundary questions, one reading** - the panel asks about the account with no model named; an impending agent asks about the model it will run on.
- **Measured per call** - the boundary is recomputed on every ask, never cached, because it moves with the clock.
- **One slider, read live** - the user's spend-offset preference is read on each measurement, so moving it takes effect without a restart.

## Business logic

### The account's own windows, and staleness

#### User story

The user glances at the usage panel and must be able to trust it: what it shows is the account's real standing, and if the latest attempt to read it failed, the panel says so instead of pretending the account is idle.

#### Business logic

The panel is served the quota windows the driver last reported, the moment that reading was taken, and — when the most recent attempt failed — the reason it failed. The last good reading is deliberately kept alongside that reason, so a transient failure marks the panel stale rather than blanking it. An empty set of windows therefore does not mean "nothing used": the failure reason is what tells the two apart.

### The boundary, and what its absence means

#### User story

Unattended work must stand down once the account has spent its pro-rated share of the quota week, but a missing reading must never be read as "you may spend nothing".

#### Business logic

The boundary status is derived from the current reading, the current time, and the user's spend-offset preference. It is absent when there is no reading at all, or when the quota week's reset point cannot be placed — that absence means "we do not know", not "nothing is allowed".

### Two boundary questions, one reading

#### User story

The usage panel asks a question about the account as a whole. A gate about to start an agent asks a narrower question: given the model this work will run on, is there room?

#### Business logic

These are two separate asks against the same reading and the same spend-offset preference. The panel names no model, so it measures the account's week alone. A gate names the model the work will run on, so the model's own week can narrow the answer. Naming no model is a deliberate answer rather than an omission: when the user has set no model preference, the driver chooses, and a window whose model cannot be named must never stop work.

#### Rationale

Keeping them as two distinct asks rather than one ask with an optional model matters: a single entry point answering both makes the panel's call look like it merely forgot to pass a model — which is exactly how a model's own week once ended up filtered out of every gate for a year. Because both are measured from the same reading and the same preference, they can only ever differ on the question the other never asked.

### Measured per call, polled for the dashboard's whole life

#### User story

The user moves the spend slider, or the clock rolls over into a new day of the quota week; the next thing they see must already reflect that.

#### Business logic

Both boundary answers are computed at the moment they are asked, from the poller's last good windows, and the spend-offset preference is re-read each time from the user's preferences — an unreadable preferences file falls back to the default, which is what a fresh install runs anyway. Neither ask costs a fresh quota reading, so asking per project is free.

The daemon polls the account's quota for the entire life of the dashboard, not only while an agent runs, because the panel must show where the account stands even when nothing is running. This is deliberately separate from the per-agent quota guard, which exists to pause a running agent and ends with it.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
