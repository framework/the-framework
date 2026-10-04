import { afterEach, describe, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

vi.mock('../lib/models.js', () => ({
  useModels: () => ({ 'claude-code': { models: [{ id: 'opus', name: 'Opus 5.5', resolvedId: 'claude-opus-5-5' }] } }),
  modelName: (models: { models: { id: string; name: string; resolvedId?: string }[] } | undefined, id: string) =>
    models?.models.find(m => m.id === id || m.resolvedId === id)?.name ?? id,
}))

const { SessionLine } = await import('./SessionLine.js')

afterEach(cleanup)

const setup = { workspace: '/repo/.branches/agent-1', branch: 'agent-1', driver: 'claude-code', model: 'claude-opus-5-5' }

describe('SessionLine', () => {
  test('it is one folded line saying the session was set up', () => {
    render(<SessionLine setup={setup} />)
    expect(screen.getByRole('button', { name: 'Session set up' }).getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByText('/repo/.branches/agent-1')).toBeNull()
  })

  test('opened, it says the checkout, the branch, and the coding agent with its model by name', () => {
    const { container } = render(<SessionLine setup={setup} />)
    fireEvent.click(screen.getByRole('button', { name: 'Session set up' }))
    expect(Array.from(container.querySelectorAll('.border > div')).map(n => n.textContent)).toEqual([
      'Checkout made/repo/.branches/agent-1',
      'Branchagent-1',
      'Coding agent startedClaude Code · Opus 5.5',
    ])
    fireEvent.click(screen.getByRole('button', { name: 'Session set up' }))
    expect(container.querySelector('.border')).toBeNull()
  })

  test('a fact the card does not say is no line, and a coding agent with no model is named alone', () => {
    const { container } = render(<SessionLine setup={{ driver: 'codex' }} />)
    fireEvent.click(screen.getByRole('button', { name: 'Session set up' }))
    expect(Array.from(container.querySelectorAll('.border > div')).map(n => n.textContent)).toEqual(['Coding agent startedCodex'])
  })

  test('a card that says none of them draws nothing', () => {
    const { container } = render(<SessionLine setup={{}} />)
    expect(container.firstChild).toBeNull()
  })
})
