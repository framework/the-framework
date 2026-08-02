import { afterEach, describe, expect, test, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

// The live pane is BrowserPanel's job and tested there; stand in one that hands back a still
// right away, so the degrade ladder can be driven without a real stream or a canvas.
vi.mock('./BrowserPanel.js', async () => {
  const { useEffect } = await import('react')
  return {
    BrowserPanel: ({ onFrame }: { onFrame?: (dataUrl: string) => void }) => {
      useEffect(() => {
        onFrame?.('data:image/jpeg;base64,still')
      }, [onFrame])
      return <div data-testid="live-pane" />
    },
  }
})

const { InlineBrowser } = await import('./InlineBrowser.js')

afterEach(cleanup)

describe('InlineBrowser (#1455 item 6b)', () => {
  test('a live row hosts the pane inside the 16:10 box', () => {
    render(<InlineBrowser projectId="p1" runId="r1" url="https://a.test/" live />)
    expect(screen.getByTestId('live-pane')).toBeTruthy()
  })

  test('the run ending under the reader degrades to the last still with the overlay (#1359)', () => {
    const view = render(<InlineBrowser projectId="p1" runId="r1" url="https://a.test/" live />)
    view.rerender(<InlineBrowser projectId="p1" runId="r1" url="https://a.test/" live={false} />)
    const still = screen.getByAltText("The browser's last frame")
    expect(still.getAttribute('src')).toContain('data:image/jpeg')
    expect(screen.getByText('preview ended — session finished')).toBeTruthy()
    expect(screen.queryByTestId('live-pane')).toBeNull()
  })

  test('dead with no still is just the one-liner — never a dead stream or a spinner', () => {
    render(<InlineBrowser projectId="p1" runId="r1" url="https://a.test/" live={false} />)
    expect(screen.getByText(/browser · https:\/\/a\.test\//)).toBeTruthy()
    expect(screen.queryByAltText("The browser's last frame")).toBeNull()
  })
})
