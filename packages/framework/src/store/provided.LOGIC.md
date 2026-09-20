One sentence the dashboard's widget call says to every provided reader [1] of this directory: a package's command just ran in this project, forget what you read of it. The queue reader and the runs reader each drop what they kept for that project, so their next read runs the provider again. The Framework never knows which command writes what; forgetting is cheap, and re-reading is what it does anyway.

## Glossary

[1] provided reader: a reader of one kind of the framework's data (the agent queue, the finished agents) that runs the command a project's package declares for that kind and keeps the answer for five seconds (`queue.ts`, `runs.ts`).
