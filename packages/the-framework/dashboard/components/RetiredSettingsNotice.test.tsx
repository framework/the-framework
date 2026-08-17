import { afterEach, describe, expect, test } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { RetiredSettingsNotice } from './RetiredSettingsNotice.js'

afterEach(cleanup)

const PUBLISHED = {
  path: '/repos/app-a',
  keys: ['handoff'],
  advice: 'Add `handoff: local` to its the-framework.yml — without it, agents there push their branch and open a pull request.',
}
const REST = { path: '/repos/app-b', keys: ['model', 'target'], advice: 'Your own settings apply to it now.' }

describe('RetiredSettingsNotice (#840)', () => {
  test('names the repo, what it held, and what the daemon says to do about it', () => {
    render(<RetiredSettingsNotice projects={[PUBLISHED]} />)
    const alert = screen.getByRole('alert')
    expect(alert.textContent).toContain('/repos/app-a')
    expect(alert.textContent).toContain('handoff: local')
    // The consequence rides along, because it is the reason this banner exists at all.
    expect(alert.textContent).toMatch(/push their branch and open a pull request/i)
  })

  test('the advice is rendered as given, not re-derived here', () => {
    // One wording, written where the judgement was made. A second copy in the browser is a copy
    // that drifts from the daemon's own line for the same repo.
    render(<RetiredSettingsNotice projects={[REST]} />)
    const alert = screen.getByRole('alert')
    expect(alert.textContent).toContain('model, target')
    expect(alert.textContent).toContain(REST.advice)
    expect(alert.textContent).not.toMatch(/handoff:/)
  })

  test('every affected repo is listed, not just the first', () => {
    render(<RetiredSettingsNotice projects={[PUBLISHED, REST]} />)
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
  })

  test('nothing retired renders nothing, so the shell can mount it unconditionally', () => {
    const { container } = render(<RetiredSettingsNotice projects={[]} />)
    expect(container.firstChild).toBeNull()
  })
})
