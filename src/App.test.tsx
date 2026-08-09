import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from './App'

vi.mock('./data', () => ({
  loadPackageCatalog: vi.fn(async () => ({
    source: 'curated' as const,
    isFallback: true,
    packages: [
      {
        id: 'Microsoft.VisualStudioCode',
        name: 'Visual Studio Code',
        publisher: 'Microsoft',
        version: 'Latest',
        description: 'A lightweight source code editor.',
        category: 'Development' as const,
        icon: { monogram: 'VS', background: '#2563EB' },
      },
      {
        id: 'Git.Git',
        name: 'Git',
        publisher: 'Git',
        version: 'Latest',
        description: 'Distributed version control.',
        category: 'Development' as const,
        icon: { monogram: 'GT', background: '#C2410C' },
      },
      {
        id: 'Google.Chrome',
        name: 'Google Chrome',
        publisher: 'Google',
        version: 'Latest',
        description: 'A modern web browser.',
        category: 'Browsers' as const,
        icon: { monogram: 'GC', background: '#047857' },
      },
    ],
  })),
}))

describe('WingetWebUI workspace', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  afterEach(() => cleanup())

  it('supports selection, live generation, range selection, options, and search', async () => {
    const user = userEvent.setup()
    render(<App />)

    expect(await screen.findByText('3 verified WinGet IDs')).toBeInTheDocument()

    const visualStudioCode = screen.getByRole('button', { name: 'Add Visual Studio Code' })
    await user.click(visualStudioCode)

    expect(screen.getByText('1 app in order')).toBeInTheDocument()
    const output = screen.getByRole('tabpanel', { name: 'Command' })
    expect(output).toHaveTextContent('Microsoft.VisualStudioCode')
    expect(output).toHaveTextContent('--accept-source-agreements')

    const silentOption = screen.getByRole('checkbox', { name: /Silent installation/i })
    await user.click(silentOption)
    expect(output).toHaveTextContent('--silent')

    const chrome = screen.getByRole('button', { name: 'Add Google Chrome' })
    fireEvent.click(chrome, { shiftKey: true })
    expect(screen.getByText('3 apps in order')).toBeInTheDocument()
    expect(output).toHaveTextContent('Git.Git')
    expect(output.textContent?.indexOf('Microsoft.VisualStudioCode')).toBeLessThan(
      output.textContent?.indexOf('Git.Git') ?? 0,
    )

    const search = screen.getByRole('searchbox', { name: 'Search applications and categories' })
    await user.type(search, 'git')
    const packageResults = within(document.querySelector('#package-results') as HTMLElement)
    expect(packageResults.getByRole('button', { name: 'Remove Git' })).toBeInTheDocument()
    expect(
      packageResults.queryByRole('button', { name: 'Remove Google Chrome' }),
    ).not.toBeInTheDocument()
  })

  it('switches views and appearance without losing the selection', async () => {
    const user = userEvent.setup()
    render(<App />)
    await screen.findByText('3 verified WinGet IDs')

    await user.click(screen.getByRole('button', { name: 'Add Git' }))
    await user.click(screen.getByRole('button', { name: 'List view' }))

    const packageResults = within(document.querySelector('#package-results') as HTMLElement)
    expect(packageResults.getByRole('button', { name: 'Remove Git' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'List view' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )

    await user.click(screen.getByRole('button', { name: 'Dark theme' }))
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark')
    expect(window.localStorage.getItem('winget-web-ui-theme')).toBe('dark')

    const selectedList = screen.getByRole('list', {
      name: 'Selected applications in installation order',
    })
    expect(within(selectedList).getByText('Git')).toBeInTheDocument()
  })
})
