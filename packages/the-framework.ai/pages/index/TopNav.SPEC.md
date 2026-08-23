The header shown at the top of every page: the product logo next to the name "The Framework", and buttons to the Discord community and the GitHub repository.

## Business logic — TL;DR

- **The logo goes home** - clicking it leaves the landing page's top; on the landing page itself it smooth-scrolls back to the top and drops the section anchor from the address bar instead of reloading.
- **Right-clicking the logo opens the press page** - the natural reflex of someone after the logo file lands them where the downloads are.
- **No Dashboard button** - the header deliberately links only to Discord and GitHub.

## Business logic

### No Dashboard button

#### User story

A visitor wants to open the dashboard.

#### Business logic

The header offers no way to do that.

#### Rationale

The dashboard is served by a daemon on the visitor's own machine. A public web page can neither reach that daemon nor detect whether one is running, so a Dashboard button in the header would be a promise the website cannot keep.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
