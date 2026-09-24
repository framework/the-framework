---
name: browser
description: A real browser you drive from the shell, to see or act on a web page (open it, read it, click, type, take a screenshot), such as checking that the app you changed works.
---

# The browser

A headless Chrome of your own, on an empty profile: nobody's logins are in it. Drive it with the `browser` command, a dependency of this repository (`@gemstack/skill-browser`), run as `npx browser`. When that fails for a missing `node_modules`, install with the lockfile's package manager (`npm install` for `package-lock.json`) and run it again. It needs Chrome on the machine, or `CHROME_PATH` set to a Chrome or Chromium executable.

```
npx browser open <address>       open the address, starting the browser if none is open
npx browser read                 print the page again
npx browser click <n>            click element n
npx browser type <n> <text>      replace what element n holds with the text; on a select, pick that option
npx browser press <key>          Enter, Tab, Escape, Backspace, Space, ArrowUp, ArrowDown, ArrowLeft, ArrowRight
npx browser screenshot [file]    save what the page shows as a PNG and print its path (a temporary file
                                 when none is named; never name one inside the repository)
npx browser eval <script>        run JavaScript in the page and print what it returns, as JSON
npx browser close                close the browser
```

`open`, `read`, `click`, `type` and `press` print the page once it has loaded: its title, its address, its text, then its elements (links, buttons, fields) numbered `[n]`. `click` and `type` take that number, from the last print: when the page changes, the numbers do too. An address without `http://` or `https://` gets `http://`; no other kind opens.

A refusal exits 1 with the reason on stderr (no browser open, no such element, a page that did not load); a wrong command line exits 2 with the usage.

A person watching your run sees this browser live where you opened it, and can click and type in it too: if the page is not what your last print showed, read it again.

Close it when you are done. It also closes when your run ends, and after 30 minutes unused.
