What the tests cover: a dashboard action that succeeds hands its result back, shows no error, and stops reporting itself as busy; the daemon answering that the action did not succeed surfaces the daemon's own reason and tells the caller it failed; an action that fails outright surfaces the failure's message, or the wording the control chose when the failure carries none; an action that returns nothing still counts as success; and the shown error can be dismissed.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
