import Fuse from 'fuse.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { PackageCategory, WingetPackage } from '../types'
import {
  filterPackages,
  filterPackagesByCategory,
  searchCategories,
  searchPackages,
} from './search'

const packageBase = {
  version: 'latest',
  description: 'A useful Windows application.',
  icon: { monogram: 'A', background: '#000' },
}

const catalog: WingetPackage[] = [
  {
    ...packageBase,
    id: 'Google.Chrome',
    name: 'Google Chrome',
    publisher: 'Google',
    category: 'Browsers',
  },
  {
    ...packageBase,
    id: 'Mozilla.Firefox',
    name: 'Mozilla Firefox',
    publisher: 'Mozilla',
    category: 'Browsers',
  },
  {
    ...packageBase,
    id: 'Microsoft.VisualStudioCode',
    name: 'Visual Studio Code',
    publisher: 'Microsoft',
    category: 'Development',
  },
]

afterEach(() => {
  vi.restoreAllMocks()
})

describe('package search and filtering', () => {
  it('matches names, IDs, publishers, and fuzzy typos', () => {
    expect(searchPackages(catalog, 'chrom').map(({ id }) => id)).toContain('Google.Chrome')
    expect(searchPackages(catalog, 'Firefx').map(({ id }) => id)).toContain('Mozilla.Firefox')
    expect(searchPackages(catalog, 'VisualStudioCode')[0]?.id).toBe('Microsoft.VisualStudioCode')
  })

  it('matches package categories through the search query', () => {
    expect(searchPackages(catalog, 'Browsers').map(({ id }) => id)).toEqual([
      'Google.Chrome',
      'Mozilla.Firefox',
    ])
  })

  it('combines category filtering and search without mutating catalog order', () => {
    const before = catalog.map(({ id }) => id)
    const result = filterPackages(catalog, {
      category: 'Browsers',
      query: 'fire',
    })

    expect(result.map(({ id }) => id)).toEqual(['Mozilla.Firefox'])
    expect(catalog.map(({ id }) => id)).toEqual(before)
  })

  it('reuses a package index for repeated searches on the same catalog reference', () => {
    const stableCatalog = [...catalog]
    const setCollection = vi.spyOn(Fuse.prototype, 'setCollection')

    searchPackages(stableCatalog, 'chrome')
    searchPackages(stableCatalog, 'firefox')

    expect(setCollection).toHaveBeenCalledTimes(1)

    searchPackages([...stableCatalog], 'chrome')

    expect(setCollection).toHaveBeenCalledTimes(2)
  })

  it('lazily reuses a separate index for each searched category', () => {
    const stableCatalog = [...catalog]
    const setCollection = vi.spyOn(Fuse.prototype, 'setCollection')

    filterPackages(stableCatalog, { category: 'Browsers', query: 'chrome' })
    filterPackages(stableCatalog, { category: 'Browsers', query: 'firefox' })

    expect(setCollection).toHaveBeenCalledTimes(1)

    filterPackages(stableCatalog, { category: 'Development', query: 'visual' })
    filterPackages(stableCatalog, { category: 'Browsers' })

    expect(setCollection).toHaveBeenCalledTimes(2)
  })

  it('filters and searches a large catalog without changing its contents', () => {
    const largeCatalog: WingetPackage[] = Array.from({ length: 10_000 }, (_, index) => ({
      ...packageBase,
      id: index === 9_999 ? 'Contoso.UniqueNeedle' : `Contoso.Package${index}`,
      name: index === 9_999 ? 'Unique Needle Utility' : `Package ${index}`,
      publisher: 'Contoso',
      category: index % 2 === 0 ? 'Development' : 'Utilities',
    }))
    const firstPackage = largeCatalog[0]
    const lastPackage = largeCatalog.at(-1)

    expect(
      filterPackages(largeCatalog, {
        category: 'Utilities',
        query: 'UniqueNeedle',
      })[0]?.id,
    ).toBe('Contoso.UniqueNeedle')
    expect(filterPackagesByCategory(largeCatalog, 'Development')).toHaveLength(5_000)
    expect(largeCatalog).toHaveLength(10_000)
    expect(largeCatalog[0]).toBe(firstPackage)
    expect(largeCatalog.at(-1)).toBe(lastPackage)
  })

  it('fuzzy-searches categories and keeps empty-query order', () => {
    const categories: PackageCategory[] = ['Development', 'Browsers', 'Communications']

    expect(searchCategories(categories, 'Browers')).toEqual(['Browsers'])
    expect(searchCategories(categories, '')).toEqual(categories)
  })

  it('reuses the category index for a stable category-list reference', () => {
    const categories: PackageCategory[] = ['Development', 'Browsers', 'Communications']
    const setCollection = vi.spyOn(Fuse.prototype, 'setCollection')

    searchCategories(categories, 'browser')
    searchCategories(categories, 'development')

    expect(setCollection).toHaveBeenCalledTimes(1)
  })
})
