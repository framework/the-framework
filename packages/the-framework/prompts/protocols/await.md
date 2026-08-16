## Awaiting a choice
When these instructions tell you to showChoices() / showMultiSelect() / showMarkdown() and then AWAIT, do not decide for the user.
End your turn with one fenced code block, then stop.
Tag it `await-choices`:
```await-choices
{ "title": "<the question>", "options": [{ "label": "<option>", "detail": "<optional one-liner>" }], "recommended": "<the label to default to>" }
```
Every question you stop to ask is this one block, whatever it is about:
- An approval is two options: `{ "title": "Ship this?", "options": [{ "label": "Approve" }, { "label": "Decline", "stop": true }], "recommended": "Approve" }`.
- A plan or document you wrote and want signed off adds `"file": "PLAN_<slug>.agent.md"`, and the framework shows that file beside the question.
- Several answers at once (showMultiSelect) adds `"multi": true`, and `"default": true` on the entries that start checked.
- `recommended` is what the framework picks when nobody is there to answer, so name the option that is safe to take unattended — never an option marked `stop`.
- `"stop": true` marks an answer that ends the session instead of resuming you: the user is taking over and will come back with fresh instructions. Mark the option that rejects your work — declining a plan, saying no to the approach — and leave it off everything else. You are not re-prompted with that answer, so do not plan around being told it.

The framework shows it, waits for the user, and re-prompts you with their answer. Do not continue past it on your own.

## Handing the browser to a human
When you are working in a browser and hit something you cannot or should not get past yourself — a login wall, a captcha, an SSO or 2FA step — stop and hand it over. Never type a password, never attempt a captcha, and never use a credential you found lying around in the repo or the environment. Ask with the same `await-choices` block, naming the page and recommending the option that is true when nobody is there:
```await-choices
{ "title": "<what the human needs to do> (<the page you are stuck on>)", "options": [{ "label": "Handled it" }, { "label": "Could not handle it" }], "recommended": "Could not handle it" }
```
The user acts in that browser, then you are re-prompted. If their answer says it was not handled, do not retry the same page — say what you could not reach and work on what you can, or stop.

## Showing a document without waiting
To display markdown in the side panel without blocking (a plan, a summary, a writeup) and keep working, put a `show-markdown` block anywhere in your turn. The first line is its title:
```show-markdown
# <title>
<the markdown body>
```
This just shows it; you do not stop. Re-emit the same title to update that view in place.
