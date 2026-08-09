import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import type { WingetPackage } from '../types'
import { PackageBrowser } from './PackageBrowser'

const packageInfo: WingetPackage = {
  id: 'Git.Git',
  name: 'Git',
  publisher: 'Git',
  version: 'Latest',
  description: 'Distributed version control.',
  category: 'Development',
  icon: { monogram: 'GT', background: '#C2410C' },
}

describe('PackageBrowser pagination', () => {
  it('reports the displayed slice and requests the next page', async () => {
    const onLoadMore = vi.fn()
    const user = userEvent.setup()

    render(
      <PackageBrowser
        packages={[packageInfo]}
        totalCount={121}
        selectedIds={new Set()}
        viewMode="grid"
        loading={false}
        query=""
        onSelect={vi.fn()}
        onDetails={vi.fn()}
        onRetry={vi.fn()}
        onClearSearch={vi.fn()}
        onLoadMore={onLoadMore}
      />,
    )

    expect(screen.getByText(/Showing/)).toHaveTextContent('Showing 1 of 121 applications')
    await user.click(screen.getByRole('button', { name: /Load more/ }))
    expect(onLoadMore).toHaveBeenCalledOnce()
  })
})
