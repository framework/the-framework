---
'@gemstack/the-framework': minor
---

A parked Claude web question can now be answered from the dashboard. The run view renders the bridge's question as real choices: pick one, confirm the send, and the browser extension types that label into the session's composer and submits it. The pick is deliberately narrow and reversible: the daemon only queues a label of the currently parked question (never free text), the send is a second explicit click, a queued pick can be withdrawn until the extension collects it over the new `GET /_bridge/answer`, and the extension reports what its delivery did back over `POST /_bridge/answered`, so the dashboard shows queued, sent, or failed with the reason. The transcript mirror also now keeps the newest text when a page exceeds the mirror cap, instead of sending the rendered system prompt and cutting off the session's actual activity.
