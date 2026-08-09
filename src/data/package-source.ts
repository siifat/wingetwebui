import { z } from 'zod'

import type { PackageCategory, WingetPackage } from '../types'
import { fallbackPackages, packageCategories } from './catalog'

const MAX_PACKAGE_COUNT = 75_000
const OFFICIAL_REPOSITORY_PATH = 'github.com/microsoft/winget-pkgs'
const PACKAGE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._+-]{0,127}$/
const HEX_COLOR_PATTERN = /^#[0-9A-Fa-f]{6}$/

const remotePackageSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    publisher: z.string().nullish(),
    version: z.string().nullish(),
    description: z.string().nullish(),
    category: z.string().nullish(),
    icon: z.unknown().optional(),
  })
  .passthrough()

type PackageFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>

export type PackageSourceKind = 'official' | 'remote' | 'curated'

export type PackageSourceErrorCode =
  'invalid-url' | 'network' | 'http' | 'invalid-response' | 'empty-response'

export interface PackageSourceError {
  code: PackageSourceErrorCode
  /** Safe for display in the product UI; never contains a raw upstream error. */
  message: string
}

export interface PackageCatalogResult {
  packages: WingetPackage[]
  source: PackageSourceKind
  isFallback: boolean
  generatedAt?: string
  repository?: string
  sourceCommit?: string
  notice?: string
  error?: PackageSourceError
}

export interface PackageSourceLoadOptions {
  signal?: AbortSignal
}

export interface PackageSourceAdapter {
  /** Whether a remote URL was supplied. It does not imply that the URL is valid or reachable. */
  readonly configured: boolean
  load(options?: PackageSourceLoadOptions): Promise<PackageCatalogResult>
}

export interface CreatePackageSourceOptions {
  /**
   * URL for a JSON endpoint returning `{ data: Package[] }` as documented by
   * `/api/v1/packages`. A raw `Package[]` is accepted as a convenience.
   * Pass an empty string to explicitly use the curated catalog.
   */
  apiUrl?: string | null
  fetcher?: PackageFetch
  fallback?: readonly WingetPackage[]
}

const categoryLookup = new Map<string, PackageCategory>(
  packageCategories.map((category) => [normalizeCategoryKey(category), category]),
)

const generatedIconPalette = [
  { background: '#2563EB', foreground: '#FFFFFF' },
  { background: '#7C3AED', foreground: '#FFFFFF' },
  { background: '#C2410C', foreground: '#FFFFFF' },
  { background: '#047857', foreground: '#FFFFFF' },
  { background: '#BE123C', foreground: '#FFFFFF' },
  { background: '#0F766E', foreground: '#FFFFFF' },
  { background: '#4338CA', foreground: '#FFFFFF' },
] as const

function normalizeCategoryKey(value: string): string {
  return value.toLocaleLowerCase('en-US').replace(/[^a-z0-9]+/g, '')
}

function configuredApiUrl(): string | undefined {
  const meta = import.meta as ImportMeta & {
    readonly env?: { readonly BASE_URL?: unknown; readonly VITE_PACKAGE_API_URL?: unknown }
  }
  const value = meta.env?.VITE_PACKAGE_API_URL
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function officialSnapshotUrl(): string {
  const meta = import.meta as ImportMeta & {
    readonly env?: { readonly BASE_URL?: unknown }
  }
  const configuredBase = meta.env?.BASE_URL
  const base = typeof configuredBase === 'string' && configuredBase ? configuredBase : './'
  return `${base.endsWith('/') ? base : `${base}/`}packages.json`
}

function cleanText(value: string, maximumLength: number): string {
  return value
    .replace(/<[^>]*>/g, ' ')
    .replace(/[\p{Cc}\p{Cf}]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maximumLength)
    .trim()
}

function normalizeApiUrl(value: string): string | null {
  const candidate = value.trim()
  if (!candidate || candidate.length > 2_048) {
    return null
  }

  try {
    const base = globalThis.location?.origin ?? 'http://localhost'
    const parsed = new URL(candidate, base)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null
    }
    return candidate
  } catch {
    return null
  }
}

interface ExtractedCatalog {
  rows: unknown[]
  source: Exclude<PackageSourceKind, 'curated'>
  generatedAt?: string
  repository?: string
  sourceCommit?: string
}

function extractCatalog(value: unknown): ExtractedCatalog | null {
  if (Array.isArray(value)) {
    return { rows: value, source: 'remote' }
  }

  if (typeof value !== 'object' || value === null || !('data' in value)) {
    return null
  }

  const data = (value as { data?: unknown }).data
  if (!Array.isArray(data)) {
    return null
  }

  const envelope = value as {
    generatedAt?: unknown
    source?: { repository?: unknown; commit?: unknown }
  }
  const repository =
    typeof envelope.source?.repository === 'string'
      ? cleanText(envelope.source.repository, 300)
      : undefined
  const commitCandidate =
    typeof envelope.source?.commit === 'string' ? envelope.source.commit.trim() : ''
  const sourceCommit = /^[a-f0-9]{7,64}$/i.test(commitCandidate) ? commitCandidate : undefined
  const generatedAtCandidate =
    typeof envelope.generatedAt === 'string' ? envelope.generatedAt.trim() : ''
  const generatedAt =
    generatedAtCandidate.length <= 50 && Number.isFinite(Date.parse(generatedAtCandidate))
      ? generatedAtCandidate
      : undefined
  const source = repository?.toLocaleLowerCase('en-US').includes(OFFICIAL_REPOSITORY_PATH)
    ? 'official'
    : 'remote'

  return {
    rows: data,
    source,
    ...(generatedAt ? { generatedAt } : {}),
    ...(repository ? { repository } : {}),
    ...(sourceCommit ? { sourceCommit } : {}),
  }
}

function normalizeCategory(value: string | null | undefined): PackageCategory {
  if (!value) {
    return 'Others'
  }
  return categoryLookup.get(normalizeCategoryKey(value)) ?? 'Others'
}

function deriveMonogram(name: string): string {
  const words = name.match(/[\p{L}\p{N}]+/gu) ?? []
  if (words.length > 1) {
    const [firstWord = '', secondWord = ''] = words
    return `${Array.from(firstWord)[0] ?? ''}${Array.from(secondWord)[0] ?? ''}`.toLocaleUpperCase(
      'en-US',
    )
  }

  const letters = Array.from(words[0] ?? name).filter((character) =>
    /[\p{L}\p{N}]/u.test(character),
  )
  return letters.slice(0, 2).join('').toLocaleUpperCase('en-US') || '?'
}

function deriveIcon(name: string, packageId: string): WingetPackage['icon'] {
  let hash = 0
  for (const character of packageId) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0
  }
  const color = generatedIconPalette[hash % generatedIconPalette.length]
  return { monogram: deriveMonogram(name), ...color }
}

function normalizeIcon(value: unknown, name: string, packageId: string): WingetPackage['icon'] {
  const generated = deriveIcon(name, packageId)
  if (typeof value !== 'object' || value === null) {
    return generated
  }

  const candidate = value as Record<string, unknown>
  if (typeof candidate.monogram !== 'string' || typeof candidate.background !== 'string') {
    return generated
  }

  const monogram = Array.from(cleanText(candidate.monogram, 4))
    .filter((character) => /[\p{L}\p{N}]/u.test(character))
    .slice(0, 2)
    .join('')
    .toLocaleUpperCase('en-US')
  const background = candidate.background.trim()
  const foreground =
    typeof candidate.foreground === 'string'
      ? candidate.foreground.trim()
      : (generated.foreground ?? '#FFFFFF')

  if (!monogram || !HEX_COLOR_PATTERN.test(background) || !HEX_COLOR_PATTERN.test(foreground)) {
    return generated
  }

  return { monogram, background, foreground }
}

function sanitizePackage(value: unknown): WingetPackage | null {
  const parsed = remotePackageSchema.safeParse(value)
  if (!parsed.success) {
    return null
  }

  const id = cleanText(parsed.data.id, 128)
  const name = cleanText(parsed.data.name, 100)
  if (!PACKAGE_ID_PATTERN.test(id) || !name) {
    return null
  }

  const publisher = parsed.data.publisher
    ? cleanText(parsed.data.publisher, 100)
    : 'Unknown publisher'
  const version = parsed.data.version ? cleanText(parsed.data.version, 64) : 'Latest'
  const description = parsed.data.description
    ? cleanText(parsed.data.description, 400)
    : 'No description is available from this package source.'

  return {
    id,
    name,
    publisher: publisher || 'Unknown publisher',
    version: version || 'Latest',
    description: description || 'No description is available from this package source.',
    category: normalizeCategory(parsed.data.category),
    icon: normalizeIcon(parsed.data.icon, name, id),
  }
}

function sanitizePackages(rows: unknown[]): { packages: WingetPackage[]; skipped: number } {
  const packages: WingetPackage[] = []
  const seenIds = new Set<string>()
  let skipped = Math.max(0, rows.length - MAX_PACKAGE_COUNT)

  for (const row of rows.slice(0, MAX_PACKAGE_COUNT)) {
    const packageData = sanitizePackage(row)
    const normalizedId = packageData?.id.toLocaleLowerCase('en-US')
    if (!packageData || !normalizedId || seenIds.has(normalizedId)) {
      skipped += 1
      continue
    }
    seenIds.add(normalizedId)
    packages.push(packageData)
  }

  return { packages, skipped }
}

function fallbackResult(
  fallback: readonly WingetPackage[],
  error?: PackageSourceError,
): PackageCatalogResult {
  return {
    packages: [...fallback],
    source: 'curated',
    isFallback: true,
    ...(error
      ? {
          notice:
            'The live package source is unavailable. Showing the curated offline catalog instead.',
          error,
        }
      : {}),
  }
}

/** Create an isolated adapter so tests or future providers can supply their own fetch implementation. */
export function createPackageSource(
  options: CreatePackageSourceOptions = {},
): PackageSourceAdapter {
  const configuredUrl = options.apiUrl === undefined ? configuredApiUrl() : (options.apiUrl ?? '')
  const fallback = options.fallback ?? fallbackPackages

  return {
    configured: Boolean(configuredUrl?.trim()),
    async load(loadOptions = {}): Promise<PackageCatalogResult> {
      if (!configuredUrl?.trim()) {
        return fallbackResult(fallback)
      }

      const url = normalizeApiUrl(configuredUrl)
      if (!url) {
        return fallbackResult(fallback, {
          code: 'invalid-url',
          message: 'The configured package service address is invalid.',
        })
      }

      const fetcher = options.fetcher ?? globalThis.fetch
      if (!fetcher) {
        return fallbackResult(fallback, {
          code: 'network',
          message: 'The package service could not be reached.',
        })
      }

      let response: Response
      try {
        response = await fetcher(url, {
          headers: { Accept: 'application/json' },
          signal: loadOptions.signal,
        })
      } catch {
        return fallbackResult(fallback, {
          code: 'network',
          message: 'The package service could not be reached.',
        })
      }

      if (!response.ok) {
        return fallbackResult(fallback, {
          code: 'http',
          message: 'The package service returned an unexpected response.',
        })
      }

      let payload: unknown
      try {
        payload = await response.json()
      } catch {
        return fallbackResult(fallback, {
          code: 'invalid-response',
          message: 'The package service returned data in an unsupported format.',
        })
      }

      const extracted = extractCatalog(payload)
      if (!extracted) {
        return fallbackResult(fallback, {
          code: 'invalid-response',
          message: 'The package service returned data in an unsupported format.',
        })
      }

      const sanitized = sanitizePackages(extracted.rows)
      if (sanitized.packages.length === 0) {
        return fallbackResult(fallback, {
          code: extracted.rows.length === 0 ? 'empty-response' : 'invalid-response',
          message:
            extracted.rows.length === 0
              ? 'The package service returned an empty catalog.'
              : 'The package service returned no usable package records.',
        })
      }

      return {
        packages: sanitized.packages,
        source: extracted.source,
        isFallback: false,
        ...(extracted.generatedAt ? { generatedAt: extracted.generatedAt } : {}),
        ...(extracted.repository ? { repository: extracted.repository } : {}),
        ...(extracted.sourceCommit ? { sourceCommit: extracted.sourceCommit } : {}),
        ...(sanitized.skipped > 0
          ? { notice: `${sanitized.skipped} invalid or duplicate package records were ignored.` }
          : {}),
      }
    },
  }
}

/**
 * Application-wide adapter. A custom API can override the checked-in official snapshot,
 * while the curated catalog remains available if either source cannot be loaded.
 */
export const packageSource = createPackageSource({
  apiUrl: configuredApiUrl() ?? officialSnapshotUrl(),
})

/** Convenience wrapper for consumers that do not need a custom adapter. */
export function loadPackageCatalog(
  options?: PackageSourceLoadOptions,
): Promise<PackageCatalogResult> {
  return packageSource.load(options)
}
