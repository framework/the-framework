import { afterEach, describe, expect, test } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { AgentWorkBar } from './AgentWorkBar.js'

afterEach(cleanup)

describe('AgentWorkBar', () => {
  test('it says the project, the branch, what the branch holds and the next step, in one row', () => {
    render(<AgentWorkBar projectName="gemstack" checkout={{ branch: 'agent-fix-header' }} summary={<span>2 commits</span>} actions={<button type="button">Open PR</button>} show />)
    const bar = screen.getByRole('group', { name: "This agent's work" })
    // The branch as it is named.
    expect(bar.textContent).toBe('gemstackagent-fix-header2 commitsOpen PR')
    expect(screen.getByRole('button', { name: 'Open PR' })).toBeTruthy()
  })

  test('with nothing to say there is no bar', () => {
    const { container } = render(<AgentWorkBar projectName="gemstack" checkout={{ branch: 'agent-1' }} summary={<span>2 commits</span>} actions={<span>Merged into main.</span>} show={false} />)
    expect(container.textContent).toBe('')
  })

  test("the branch's pull request is a link, with its state", () => {
    render(<AgentWorkBar checkout={{ branch: 'agent-1', pr: { number: 12, url: 'https://github.com/o/r/pull/12', state: 'OPEN', title: 'Fix it' } }} show />)
    const link = screen.getByRole('link', { name: /PR #12/ })
    expect(link.getAttribute('href')).toBe('https://github.com/o/r/pull/12')
    expect(link.textContent).toContain('open')
  })

  test('before the branch is known there is no bar', () => {
    const { container, rerender } = render(<AgentWorkBar projectName="gemstack" checkout={null} actions={<button type="button">Open PR</button>} show />)
    expect(container.textContent).toBe('')
    rerender(<AgentWorkBar projectName="gemstack" checkout={{}} show />)
    expect(container.textContent).toBe('')
  })
})
