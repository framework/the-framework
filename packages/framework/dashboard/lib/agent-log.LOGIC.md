Names the key an ended agent's [1] archive [2] is remembered under in the browser, and reads that archive ahead of the agent's page.

## Context

**User story**: the user moves the pointer onto an ended agent's row in the left column (`components/AgentHistory.tsx`) and clicks. The agent's page (`components/AgentView.tsx`) opens with the feed already drawn.

**Problem**: the archive [2] was read only once the agent's page was open, so the feed was blank for the frames that read took.

**Business logic story**: the agent's page remembers each archive it read, under a key, for as long as the page is open, and shows a remembered archive from its first frame while it reads it again (`lib/use-async.ts`). An archive remembered under the same key before the page opens is shown the same way.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch, started through the project's start hook and shown in the dashboard from the files its tool keeps.
[2] archive: the transient copy of a finished agent's events and status under a project's `.the-framework/agents/`.

## Business logic — TL;DR

- **One key per agent** - an archive is remembered under a key made of the agent's project and the agent's id, the same key for the agent's page and for the read ahead, so no agent is ever shown another agent's archive.
- **Reading the archive ahead** - asked for an agent, the archive is read from the daemon and remembered under the agent's key, under the rules of a read ahead in `lib/use-async.ts`: once while the read is out, never for an archive already remembered, nothing kept on a failure, and never over an archive the agent's page read meanwhile.
