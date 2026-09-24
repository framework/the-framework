The browser's Chrome: which Chrome executable to run, how it is launched (headless, on a throwaway profile, with its debugging port open on loopback only), how the launch waits until Chrome answers, and how it is closed.

## Context

**Problem**: the browser runs while a person may be at the machine: it must never put a window on their screen, and the agent must never see their logins; the debugging port gives full control of Chrome, so nothing off the machine may reach it.

## Business logic — TL;DR

- **Which Chrome** - `CHROME_PATH` when it names an existing file, else the first well-known install path of the platform that exists, else the first of four Chrome and Chromium names found on `PATH`; none means the machine has no Chrome.
- **How it is launched** - headless, debugging on `127.0.0.1` at a port Chrome picks, on a fresh profile directory `skill-browser-…` under the temporary directory, 1280×800, opening a blank page, with the first-run and default-browser prompts off.
- **Waiting until it answers** - the port Chrome writes into the profile is read and its version endpoint polled every 100 ms, up to 20 seconds; Chrome failing to start, exiting as it starts, or not answering in time fails the launch with a sentence, and Chrome is closed.
- **Closing** - Chrome is asked to exit, killed outright when it has not within 5 seconds, and its profile directory is removed once it has exited; closing twice does nothing more.

## Business logic

### Which Chrome

#### Context

**User story**: the agent's machine has Chrome in its usual place, or a person sets `CHROME_PATH` to the Chrome or Chromium they want.

#### Business logic

`CHROME_PATH` wins when it names a file that exists. Otherwise the platform's well-known paths are tried in order, the first that exists winning: on macOS Google Chrome then Chromium in `/Applications`; on Linux `/opt/google/chrome/chrome`, `/usr/bin/google-chrome`, `/usr/bin/chromium`, `/usr/bin/chromium-browser`; on Windows Chrome under `Program Files` then `Program Files (x86)`. Otherwise each directory of `PATH` is searched for `google-chrome`, `google-chrome-stable`, `chromium`, `chromium-browser` in that order (with `.exe` tried first on Windows). When nothing is found, there is no Chrome.

### How it is launched

#### Context

See `## Context`.

#### Business logic

Chrome runs headless, with its debugging interface bound to `127.0.0.1` on a port Chrome picks itself, on a new empty profile directory under the machine's temporary directory named `skill-browser-` plus a random suffix, at a window size of 1280×800, with the first-run and default-browser prompts turned off, opening a blank page. Its output is discarded.

### Waiting until it answers

#### Context

**Problem**: Chrome picks its own port and writes it to a file in the profile only once it is listening.

#### Business logic

Every 100 ms the port is read from the profile's `DevToolsActivePort` file and, once there, Chrome's version endpoint on `127.0.0.1` at that port is asked; the first successful answer ends the wait, and the launch answers that debugging address. The launch fails with a sentence when Chrome could not start ("Chrome could not start: …"), when it exits during the wait ("Chrome exited as it started (code …)"), or when 20 seconds pass without an answer ("Chrome did not open its debugging port within 20s"); a failed launch closes Chrome and removes its profile.

### Closing

#### Context

**Problem**: the profile holds whatever the pages stored; it must not outlive the browser.

#### Business logic

Closing, when Chrome is still running, sends it the signal to terminate and waits for it to exit, killing it outright when it has not exited 5 seconds after the signal, because until it exits Chrome still writes in the profile. The profile directory is then removed, retried up to three times, a final failure ignored. A second close does nothing.
