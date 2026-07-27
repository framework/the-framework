import { describe, expect, test } from 'vitest'
import { queueEntryLabel } from './queue-entry.js'

describe('queueEntryLabel (#1164)', () => {
  test('a queued ticket reads as its title, and names its ticket by bare filename', () => {
    // What the Overview card actually showed: `[Improve tooltip: show it with no...`, truncated
    // mid-source, which is why the queue looked like it had not worked. The filename is bare —
    // the `WorkspaceTicket.file` key — so the consumer can open the ticket's page with it.
    const entry = '[Improve tooltip](tickets/2026-07-25_improve-tooltip.md)'
    expect(queueEntryLabel(entry)).toEqual({ text: 'Improve tooltip', ticket: '2026-07-25_improve-tooltip.md' })
  })

  test("the agent's note after the link is dropped from the label, not the title", () => {
    // Agents append their findings to the entry. Keeping them inline pushed the title out of a
    // one-line list entirely; the full text still goes in the tooltip.
    const entry = '[Let Fable be picked](tickets/2026-07-25_fable.md) — the model menu filters it out in AgentModelMenu.tsx:65'
    expect(queueEntryLabel(entry).text).toBe('Let Fable be picked')
  })

  test('an entry linking out of the workspace keeps its target as a url', () => {
    const entry = '[Fix the flaky publish job](https://github.com/gemstack-land/the-framework/issues/42) — CI only'
    expect(queueEntryLabel(entry)).toEqual({
      text: 'Fix the flaky publish job',
      url: 'https://github.com/gemstack-land/the-framework/issues/42',
    })
  })

  test('a link to anything else keeps its title but points nowhere', () => {
    // A bare repo path has no page of its own in the dashboard; a dead link would promise one.
    expect(queueEntryLabel('[Read the docs](README.md)')).toEqual({ text: 'Read the docs' })
  })

  test('a plain entry is left exactly as it is', () => {
    expect(queueEntryLabel('Apply the maintainability preset')).toEqual({ text: 'Apply the maintainability preset' })
    // A link mid-sentence is part of the sentence, not the name of the work.
    const inline = 'read the [docs](README.md) first'
    expect(queueEntryLabel(inline)).toEqual({ text: inline })
  })
})
