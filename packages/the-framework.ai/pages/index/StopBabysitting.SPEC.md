The "Stop babysitting" section: the problem statement of the pitch. It names five ways a coding agent left alone disappoints its user, and for each one contrasts the "Bad fix" people normally reach for with the "Solution" The Framework offers.

## Business logic — TL;DR

- **AI is lazy** - bad fix: appending "DON'T BE LAZY" to prompts. Solution: The Framework has the agent split a large task into subtasks and work one at a time, and has it enumerate everything that must be done before writing any code, then work that checklist.
- **Lazy AI plans** - bad fix: telling the agent to deep-dive the important parts. Solution: an automatic loop of critical feedback, research, confidence check and implementation.
- **Lazy low-quality code** - bad fix: appending "WRITE CLEAN CODE" to prompts. Solution: after complex changes the agent files low-priority post-merge refactoring prompts into the agent queue, and quality and security passes run on their own whenever the account's quota has room.
- **AI makes important decisions without asking** - bad fix: telling it to research alternatives instead. Solution: the agent gauges its own confidence before starting, and gauges how much its plan could have gone otherwise — when alternatives have subtle trade-offs, it puts them to the user.
- **AI forgets** - bad fix: repeating previous decisions and business context every time. Solution: the agent keeps what it learns in files such as `knowledge-base/DECISIONS.md` and `knowledge-base/INSIGHTS.md`.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
