import Fuse, { type IFuseOptions } from 'fuse.js'

import type { PackageCategory, WingetPackage } from '../types'

export type CategoryFilter = PackageCategory | 'All' | null | undefined

export interface PackageFilters {
  query?: string
  category?: CategoryFilter
}

const PACKAGE_SEARCH_OPTIONS: IFuseOptions<WingetPackage> = {
  keys: [
    { name: 'name', weight: 0.36 },
    { name: 'id', weight: 0.24 },
    { name: 'publisher', weight: 0.16 },
    { name: 'category', weight: 0.16 },
    { name: 'description', weight: 0.08 },
  ],
  threshold: 0.38,
  distance: 120,
  ignoreLocation: true,
  shouldSort: true,
}

const CATEGORY_SEARCH_OPTIONS: IFuseOptions<PackageCategory> = {
  threshold: 0.4,
  distance: 60,
  ignoreLocation: true,
  shouldSort: true,
}

const ALL_PACKAGES = Symbol('all-packages')

type PackageIndexKey = PackageCategory | typeof ALL_PACKAGES

interface PackageSearchIndex {
  readonly packages: readonly WingetPackage[]
  readonly packageCount: number
  readonly packagesByCategory: ReadonlyMap<PackageCategory, readonly WingetPackage[]>
  readonly searchers: Map<PackageIndexKey, Fuse<WingetPackage>>
}

interface CategorySearchIndex {
  readonly categoryCount: number
  readonly searcher: Fuse<PackageCategory>
}

/**
 * Callers pass readonly catalogs, so their reference is a natural cache key.
 * Replacing a catalog creates a fresh index while repeated searches reuse the
 * existing one. The length check also handles common in-place push/pop changes.
 */
const packageSearchIndexes = new WeakMap<readonly WingetPackage[], PackageSearchIndex>()
const categorySearchIndexes = new WeakMap<readonly PackageCategory[], CategorySearchIndex>()

function createPackageSearchIndex(packages: readonly WingetPackage[]): PackageSearchIndex {
  const packagesByCategory = new Map<PackageCategory, WingetPackage[]>()

  for (const item of packages) {
    const categoryPackages = packagesByCategory.get(item.category)

    if (categoryPackages) {
      categoryPackages.push(item)
    } else {
      packagesByCategory.set(item.category, [item])
    }
  }

  return {
    packages,
    packageCount: packages.length,
    packagesByCategory,
    searchers: new Map(),
  }
}

function getPackageSearchIndex(packages: readonly WingetPackage[]): PackageSearchIndex {
  const cachedIndex = packageSearchIndexes.get(packages)

  if (cachedIndex?.packageCount === packages.length) return cachedIndex

  const index = createPackageSearchIndex(packages)
  packageSearchIndexes.set(packages, index)
  return index
}

function getCategoryPackages(
  index: PackageSearchIndex,
  category: CategoryFilter,
): readonly WingetPackage[] {
  if (!category || category === 'All') return index.packages
  return index.packagesByCategory.get(category) ?? []
}

function searchPackageIndex(
  index: PackageSearchIndex,
  query: string,
  category: CategoryFilter,
): WingetPackage[] {
  const categoryPackages = getCategoryPackages(index, category)
  const normalizedQuery = query.trim()

  if (!normalizedQuery) return [...categoryPackages]
  if (categoryPackages.length === 0) return []

  const indexKey = !category || category === 'All' ? ALL_PACKAGES : category
  let searcher = index.searchers.get(indexKey)

  if (!searcher) {
    searcher = new Fuse(categoryPackages, PACKAGE_SEARCH_OPTIONS)
    index.searchers.set(indexKey, searcher)
  }

  return searcher.search(normalizedQuery).map(({ item }) => item)
}

export function filterPackagesByCategory(
  packages: readonly WingetPackage[],
  category: CategoryFilter,
): WingetPackage[] {
  return [...getCategoryPackages(getPackageSearchIndex(packages), category)]
}

export function searchPackages(packages: readonly WingetPackage[], query: string): WingetPackage[] {
  return searchPackageIndex(getPackageSearchIndex(packages), query, 'All')
}

/** Apply category first, then fuzzy search across package and category fields. */
export function filterPackages(
  packages: readonly WingetPackage[],
  filters: Readonly<PackageFilters> = {},
): WingetPackage[] {
  return searchPackageIndex(getPackageSearchIndex(packages), filters.query ?? '', filters.category)
}

export function searchCategories(
  categories: readonly PackageCategory[],
  query: string,
): PackageCategory[] {
  const normalizedQuery = query.trim()
  if (!normalizedQuery) return [...categories]

  let index = categorySearchIndexes.get(categories)

  if (!index || index.categoryCount !== categories.length) {
    index = {
      categoryCount: categories.length,
      searcher: new Fuse(categories, CATEGORY_SEARCH_OPTIONS),
    }
    categorySearchIndexes.set(categories, index)
  }

  return index.searcher.search(normalizedQuery).map(({ item }) => item)
}
