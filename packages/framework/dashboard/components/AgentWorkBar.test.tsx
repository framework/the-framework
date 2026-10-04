import { afterEach, describe, expect, test } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { AgentWorkBar } from './AgentWorkBar.js'

afterEach(cleanup)

describe('AgentWorkBar', () => {
  test('it says the project, the branch, what the branch holds and the next step, in one row', () => {
    render(<AgentWorkBar projectName="gemstack" checkout={{ branch: 'the-framework/fix-header' }} summary={<span>2 commits</span>} actions={<button type="button">Open PR</button>} />)
    const bar = screen.getByRole('group', { name: "This agent's work" })
    // The prefix every agent branch shares is not said.
    expect(bar.textContent).toBe('gemstackfix-header2 commitsOpen PR')
    expect(screen.getByRole('button', { name: 'Open PR' })).toBeTruthy()
  })

  test('it is there with no next step: the row keeps its place, so the message box never moves', () => {
    render(<AgentWorkBar projectName="gemstack" checkout={{ branch: 'agent-1' }} />)
    const bar = screen.getByRole('group', { name: "This agent's work" })
    expect(bar.textContent).toBe('gemstackagent-1')
    expect(bar.className).toContain('h-9')
  })

  test("the branch's pull request is a link, with its state", () => {
    render(<AgentWorkBar checkout={{ branch: 'agent-1', pr: { number: 12, url: 'https://github.com/o/r/pull/12', state: 'OPEN', title: 'Fix it' } }} />)
    const link = screen.getByRole('link', { name: /PR #12/ })
    expect(link.getAttribute('href')).toBe('https://github.com/o/r/pull/12')
    expect(link.textContent).toContain('open')
  })

  test('before the branch is known there is no bar', () => {
    const { container, rerender } = render(<AgentWorkBar projectName="gemstack" checkout={null} actions={<button type="button">Open PR</button>} />)
    expect(container.textContent).toBe('')
    rerender(<AgentWorkBar projectName="gemstack" checkout={{}} />)
    expect(container.textContent).toBe('')
  })
})
