import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'

// The section polls onDocs itself (the launcher-section pattern); DocsPanel renders what it is given.
const onDocs = vi.hoisted(() => vi.fn())
vi.mock('../rpc/reads.js', () => ({ onDocs }))

const { ProjectDocs } = await import('./ProjectDocs.js')

beforeEach(() => {
  onDocs.mockReset().mockResolvedValue([])
})

afterEach(cleanup)

describe('ProjectDocs (#1455 item 2)', () => {
  test('a project with no docs gets no section at all', async () => {
    const { container } = render(<ProjectDocs projectId="p1" />)
    await waitFor(() => expect(onDocs).toHaveBeenCalledWith('p1'))
    expect(container.textContent).toBe('')
  })

  test('docs render under a Docs heading in the DocsPanel presentation', async () => {
    onDocs.mockResolvedValue([{ name: 'PLAN.md', content: '# the plan' }])
    render(<ProjectDocs projectId="p1" />)
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Docs' })).toBeTruthy())
    expect(screen.getByText('PLAN.md')).toBeTruthy()
    expect(screen.getByText('the plan')).toBeTruthy()
  })
})
