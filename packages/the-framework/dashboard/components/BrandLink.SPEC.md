The Framework's logo and name in the dashboard's top bar, which is the way home: clicking them goes to the Overview.

## Business logic — TL;DR

- **The brand is the way home** - clicking the logo or the name navigates to the Overview.
- **It behaves like a real link** - cmd-click, middle-click and "copy link address" work as in any browser; a plain click navigates inside the dashboard without a page reload.
- **The logo shows when agents are working** - it animates while work is in flight.
- **The name folds away on narrow screens** - the logo alone stays, and remains the way home.

## Business logic

### The brand is the way home

#### User story

The user is deep inside an agent and wants to get back to the Overview.

#### Business logic

The logo and the words "The Framework" form one target that leads to the dashboard's root, the Overview.

### It behaves like a real link

#### User story

The user cmd-clicks the logo to open a second Overview in another tab, or copies its address.

#### Business logic

The brand is a genuine link to `/`, so modified clicks — cmd, ctrl, shift, alt, or a non-primary button — are left entirely to the browser, opening a new tab or window as the user expects. A plain left click is instead handled inside the dashboard as a client-side navigation, the same one every other selection uses, so no page reload happens.

### The logo shows when agents are working, and the name folds away on narrow screens

#### User story

The user glances at the top bar to see whether anything is running, on a phone as well as on a desktop.

#### Business logic

The logo reflects whether any agent is currently working. Below a small viewport width the wordmark is hidden so the navigation bar fits; the logo stays and is still the way home.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
