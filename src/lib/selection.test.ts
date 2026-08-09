import { describe, expect, it } from 'vitest'

import type { WingetPackage } from '../types'
import {
  addPackagesToSelection,
  clearSelection,
  createSelectionState,
  movePackageInSelection,
  removePackageFromSelection,
  reorderSelection,
  resolveSelectedPackages,
  selectRange,
  toggleCategorySelection,
  togglePackageSelection,
  updateSelectionFromInteraction,
} from './selection'

describe('selection operations', () => {
  it('selects and deselects an individual package without mutating input', () => {
    const selected = ['One.App']
    const added = togglePackageSelection(selected, 'Two.App')
    const removed = togglePackageSelection(added, 'One.App')

    expect(selected).toEqual(['One.App'])
    expect(added).toEqual(['One.App', 'Two.App'])
    expect(removed).toEqual(['Two.App'])
  })

  it('supports Ctrl/Command-style multi-selection and retains selection order', () => {
    const visible = ['One.App', 'Two.App', 'Three.App']
    const first = updateSelectionFromInteraction(createSelectionState(), 'Two.App', visible)
    const second = updateSelectionFromInteraction(first, 'One.App', visible, { ctrlKey: true })

    expect(second.selectedIds).toEqual(['Two.App', 'One.App'])
    expect(second.anchorId).toBe('One.App')
  })

  it('adds an inclusive Shift range in visible order', () => {
    const selected = ['Existing.App', 'Two.App']
    const visible = ['One.App', 'Two.App', 'Three.App', 'Four.App']

    expect(selectRange(selected, visible, 'Two.App', 'Four.App')).toEqual([
      'Existing.App',
      'Two.App',
      'Three.App',
      'Four.App',
    ])
    expect(selectRange([], visible, 'Four.App', 'Two.App')).toEqual([
      'Two.App',
      'Three.App',
      'Four.App',
    ])
  })

  it('uses the prior anchor for Shift interaction', () => {
    const state = {
      selectedIds: ['Two.App'],
      anchorId: 'Two.App',
    }
    const next = updateSelectionFromInteraction(
      state,
      'Four.App',
      ['One.App', 'Two.App', 'Three.App', 'Four.App'],
      { shiftKey: true },
    )

    expect(next).toEqual({
      selectedIds: ['Two.App', 'Three.App', 'Four.App'],
      anchorId: 'Two.App',
    })
  })

  it('removes one package and clears all packages', () => {
    const selected = ['One.App', 'Two.App', 'Three.App']

    expect(removePackageFromSelection(selected, 'Two.App')).toEqual(['One.App', 'Three.App'])
    expect(clearSelection()).toEqual([])
    expect(selected).toEqual(['One.App', 'Two.App', 'Three.App'])
  })

  it('selects and deselects a category while preserving other order', () => {
    const selected = ['Existing.App', 'Two.App']
    const categoryIds = ['One.App', 'Two.App', 'Three.App']
    const allSelected = toggleCategorySelection(selected, categoryIds)

    expect(allSelected).toEqual(['Existing.App', 'Two.App', 'One.App', 'Three.App'])
    expect(toggleCategorySelection(allSelected, categoryIds)).toEqual(['Existing.App'])
  })

  it('does not add duplicate IDs during multi-selection', () => {
    expect(
      addPackagesToSelection(['One.App', 'One.App'], ['One.App', 'Two.App', 'Two.App']),
    ).toEqual(['One.App', 'Two.App'])
  })

  it('reorders by index without mutating the current order', () => {
    const selected = ['One.App', 'Two.App', 'Three.App', 'Four.App']

    expect(reorderSelection(selected, 0, 2)).toEqual([
      'Two.App',
      'Three.App',
      'One.App',
      'Four.App',
    ])
    expect(selected).toEqual(['One.App', 'Two.App', 'Three.App', 'Four.App'])
  })

  it('supports keyboard up/down reordering and leaves edges unchanged', () => {
    const selected = ['One.App', 'Two.App', 'Three.App']

    expect(movePackageInSelection(selected, 'Two.App', 'up')).toEqual([
      'Two.App',
      'One.App',
      'Three.App',
    ])
    expect(movePackageInSelection(selected, 'Two.App', 'down')).toEqual([
      'One.App',
      'Three.App',
      'Two.App',
    ])
    expect(movePackageInSelection(selected, 'One.App', 'up')).toEqual(selected)
  })

  it('resolves catalog packages in custom selection order', () => {
    const packageBase = {
      publisher: 'Publisher',
      version: '1.0.0',
      description: 'Description',
      icon: { monogram: 'A', background: '#000' },
      category: 'Utilities' as const,
    }
    const catalog: WingetPackage[] = [
      { ...packageBase, id: 'One.App', name: 'One' },
      { ...packageBase, id: 'Two.App', name: 'Two' },
    ]

    expect(
      resolveSelectedPackages(['Two.App', 'Missing.App', 'One.App'], catalog).map(({ id }) => id),
    ).toEqual(['Two.App', 'One.App'])
  })
})
