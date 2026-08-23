import { afterEach, describe, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { DriverModelMenu, type DriverOption } from './DriverModelMenu.js'
import { hoverTooltip } from '../test-utils.js'

afterEach(cleanup)

const drivers: DriverOption[] = [
  {
    value: 'claude',
    label: 'Claude Code',
    icon: <svg data-testid="claude-logo" />,
    models: [{ value: 'opus', label: 'Opus' }],
  },
  {
    value: 'codex',
    label: 'Codex',
    models: [{ value: 'gpt-5-codex', label: 'GPT-5 Codex' }],
  },
]

function renderMenu(over: Partial<Parameters<typeof DriverModelMenu>[0]> = {}) {
  const onChange = vi.fn()
  render(<DriverModelMenu drivers={drivers} driver="claude" model="opus" onChange={onChange} busy={false} {...over} />)
  return { onChange }
}

describe('DriverModelMenu tree (#658)', () => {
  test('the trigger shows the current driver logo and model', async () => {
    renderMenu()
    const trigger = screen.getByRole('button')
    expect(trigger.querySelector('[data-testid="claude-logo"]')).toBeTruthy()
    expect(trigger.textContent).toContain('Opus')
    // The logo is the only thing naming the driver on the trigger, so hovering has to spell it out.
    expect((await hoverTooltip(trigger)).textContent).toContain('Claude Code')
  })

  test('picking a model within an driver sets both the driver and the model', () => {
    const { onChange } = renderMenu()
    fireEvent.click(screen.getByRole('button')) // open root
    fireEvent.click(screen.getByText('Codex')) // open the Codex submenu
    fireEvent.click(screen.getByText('GPT-5 Codex'))
    expect(onChange).toHaveBeenCalledWith('codex', 'gpt-5-codex')
  })

  test("each driver's submenu shows only its own models", () => {
    renderMenu({ model: '' }) // keep 'Opus' out of the trigger so we count only submenu items
    fireEvent.click(screen.getByRole('button'))
    fireEvent.click(screen.getByText('Claude Code')) // Claude submenu
    expect(screen.getByText('Opus')).toBeTruthy() // Claude's own model
    expect(screen.queryByText('GPT-5 Codex')).toBeNull() // a Claude submenu never lists Codex models
  })

  test('with no model pinned the trigger names no model, rather than the first one (#1143)', async () => {
    // The list used to open with a "Default" entry storing an empty value, and the label fell back
    // to the first entry — so an unset preference read as whichever model happened to be listed
    // first. Naming a model the agent does not pass is the failure the ticket is about.
    renderMenu({ model: '' })
    const trigger = screen.getByRole('button')
    expect(trigger.textContent).not.toContain('Opus')
    expect((await hoverTooltip(trigger)).textContent).toContain("Model: the CLI's own default")
  })

  test('a model belonging to the other driver is not claimed as this one (#1143)', async () => {
    renderMenu({ driver: 'claude', model: 'gpt-5-codex' })
    const trigger = screen.getByRole('button')
    expect(trigger.textContent).not.toContain('GPT-5 Codex')
    expect((await hoverTooltip(trigger)).textContent).toContain("Model: the CLI's own default")
  })

  test('the trigger is named for assistive tech even with nothing but a logo on it (#1143)', () => {
    renderMenu({ model: '' })
    // The rendered text is a logo and a chevron; without an explicit name this button says nothing.
    expect(screen.getByRole('button', { name: "Driver: Claude Code · Model: the CLI's own default" })).toBeTruthy()
  })
})
