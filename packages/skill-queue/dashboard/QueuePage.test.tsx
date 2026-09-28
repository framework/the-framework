import { afterEach, describe, expect, test } from 'vitest'
import { cleanup, screen } from '@testing-library/react'
import { QueuePage } from './QueuePage.js'
import { fakeHost, renderWithHost } from './test-host.js'

// The page rendered from nothing but this package: a host answering `queue --local --full`.

const alpha = { id: 'p1', name: 'alpha' }

afterEach(cleanup)

/** The section headers and entries, top to bottom, as the page shows them. */
const shown = () => [...document.querySelectorAll('h3, li')].map(node => node.textContent?.replace('•', ''))

describe('QueuePage', () => {
  test('shows the entries in the order agents take them: an unranked entry above the sections shows first', async () => {
    const full = [{ entry: 'Hand-written on top' }, { entry: 'Urgent', priority: 8 }, { entry: 'Also urgent', priority: 8 }, { entry: 'Later', priority: 3 }]
    renderWithHost(<QueuePage projects={[alpha]} path={[]} />, fakeHost({ p1: { '--local --full': full } }))
    await screen.findByText('Hand-written on top')
    expect(shown()).toEqual(['No priority', 'Hand-written on top', 'Priority 8', 'Urgent', 'Also urgent', 'Priority 3', 'Later'])
  })
})
