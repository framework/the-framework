---
"@gemstack/framework": patch
---

Fix a spurious "await limit reached" notice after a live-chat run (#742). `runAwaitRounds` reported the opening prompt's await-round exhaustion even when a live-chat phase followed and the run actually ended because chat was stopped. `runChatPhase` now reports its own settled `exhausted`, and a run that ends on Stop/close after chat is no longer treated as having hit the await limit.
