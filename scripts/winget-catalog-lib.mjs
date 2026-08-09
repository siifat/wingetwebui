/**
 * Pure helpers used by the official WinGet catalog synchronization job.
 *
 * This module deliberately performs no filesystem, network, Git, or YAML I/O.
 * Keeping those concerns at the CLI boundary makes the catalog decisions easy
 * to test and ensures that rerunning a source commit produces identical JSON.
 */

export const OFFICIAL_REPOSITORY = 'https://github.com/microsoft/winget-pkgs.git'

export const PACKAGE_CATEGORIES = Object.freeze([
  'Development',
  'Browsers',
  'Communications',
  'Microsoft Tools',
  'Multimedia',
  'Utilities',
  'Productivity',
  'Design & Creation',
  'Gaming',
  'Security & Privacy',
  'Cloud & Storage',
  'System Tools',
  'Others',
])

/**
 * Rules are evaluated by score, then by their order here. Exact tags carry
 * more weight than package identity fields, which carry more than description
 * prose. This prevents a passing mention in a description from overriding a
 * useful upstream tag.
 */
export const CATEGORY_RULES = Object.freeze([
  categoryRule('Development', [
    'developer',
    'development',
    'programming',
    'source code',
    'code editor',
    'ide',
    'compiler',
    'debugger',
    'sdk',
    'git',
    'database client',
    'api client',
  ]),
  categoryRule('Browsers', ['browser', 'web browser', 'chromium', 'firefox', 'internet browser']),
  categoryRule('Communications', [
    'communication',
    'chat',
    'messaging',
    'email client',
    'video conference',
    'conferencing',
    'voip',
    'team collaboration',
  ]),
  categoryRule('Microsoft Tools', [
    'microsoft tools',
    'powertoys',
    'sysinternals',
    'windows terminal',
    'microsoft 365',
    'visual studio installer',
    'azure data studio',
  ]),
  categoryRule('Multimedia', [
    'multimedia',
    'media player',
    'video player',
    'audio player',
    'music player',
    'music',
    'podcast',
    'streaming',
    'codec',
    'screen recorder',
  ]),
  categoryRule('Utilities', [
    'utility',
    'utilities',
    'archive',
    'archiver',
    'compression',
    'clipboard',
    'file manager',
    'text editor',
    'launcher',
  ]),
  categoryRule('Productivity', [
    'productivity',
    'office suite',
    'office',
    'notes',
    'note taking',
    'calendar',
    'task management',
    'spreadsheet',
    'word processor',
    'pdf reader',
  ]),
  categoryRule('Design & Creation', [
    'design',
    'graphics',
    'graphic design',
    'image editor',
    'photo editor',
    '3d modeling',
    'animation',
    'cad',
    'drawing',
    'vector graphics',
    'creative',
  ]),
  categoryRule('Gaming', ['game', 'games', 'gaming', 'game launcher', 'game store', 'esports']),
  categoryRule('Security & Privacy', [
    'security',
    'privacy',
    'antivirus',
    'anti malware',
    'vpn',
    'firewall',
    'encryption',
    'authenticator',
    'password manager',
  ]),
  categoryRule('Cloud & Storage', [
    'cloud storage',
    'cloud',
    'backup',
    'file sync',
    'file sharing',
    'object storage',
    'onedrive',
    'dropbox',
  ]),
  categoryRule('System Tools', [
    'system tool',
    'system utility',
    'driver',
    'hardware',
    'firmware',
    'package manager',
    'disk management',
    'partition',
    'virtualization',
    'virtual machine',
    'container',
    'system monitor',
    'diagnostic',
    'shell',
  ]),
])

const CATEGORY_SET = new Set(PACKAGE_CATEGORIES)
const PACKAGE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._+-]{0,127}$/
const COMMIT_PATTERN = /^[0-9a-f]{40}$/i
const YAML_FILE_PATTERN = /\.ya?ml$/i
const PRERELEASE_RANK = new Map([
  ['dev', 0],
  ['snapshot', 1],
  ['nightly', 1],
  ['alpha', 2],
  ['a', 2],
  ['beta', 3],
  ['b', 3],
  ['pre', 4],
  ['preview', 4],
  ['rc', 5],
])
const ICON_PALETTE = Object.freeze([
  Object.freeze({ background: '#2563EB', foreground: '#FFFFFF' }),
  Object.freeze({ background: '#7C3AED', foreground: '#FFFFFF' }),
  Object.freeze({ background: '#C2410C', foreground: '#FFFFFF' }),
  Object.freeze({ background: '#047857', foreground: '#FFFFFF' }),
  Object.freeze({ background: '#BE123C', foreground: '#FFFFFF' }),
  Object.freeze({ background: '#0F766E', foreground: '#FFFFFF' }),
  Object.freeze({ background: '#4338CA', foreground: '#FFFFFF' }),
])

function categoryRule(category, keywords) {
  return Object.freeze({ category, keywords: Object.freeze(keywords) })
}

function compareText(left, right) {
  const leftFolded = left.toLowerCase()
  const rightFolded = right.toLowerCase()
  if (leftFolded < rightFolded) return -1
  if (leftFolded > rightFolded) return 1
  if (left < right) return -1
  if (left > right) return 1
  return 0
}

function versionTokens(value) {
  return (
    value
      .normalize('NFKC')
      .toLowerCase()
      .replace(/^v(?=\d)/, '')
      .match(/[0-9]+|[a-z]+/g)
      ?.map((token) =>
        /^[0-9]+$/.test(token)
          ? { kind: 'number', value: BigInt(token) }
          : { kind: 'text', value: token },
      ) ?? []
  )
}

function remainingVersionRank(tokens) {
  const first = tokens.find((token) => token.kind !== 'number' || token.value !== 0n)
  if (!first) return 0
  if (first?.kind === 'text' && PRERELEASE_RANK.has(first.value)) return -1
  return 1
}

/** Compare two loose WinGet versions without assuming strict SemVer. */
export function compareVersions(leftValue, rightValue) {
  const left = String(leftValue).trim()
  const right = String(rightValue).trim()
  const leftTokens = versionTokens(left)
  const rightTokens = versionTokens(right)
  const commonLength = Math.min(leftTokens.length, rightTokens.length)

  for (let index = 0; index < commonLength; index += 1) {
    const leftToken = leftTokens[index]
    const rightToken = rightTokens[index]
    if (leftToken.kind === 'number' && rightToken.kind === 'number') {
      if (leftToken.value < rightToken.value) return -1
      if (leftToken.value > rightToken.value) return 1
      continue
    }

    if (leftToken.kind === 'text' && rightToken.kind === 'text') {
      const leftRank = PRERELEASE_RANK.get(leftToken.value)
      const rightRank = PRERELEASE_RANK.get(rightToken.value)
      if (leftRank !== undefined || rightRank !== undefined) {
        if (leftRank === undefined) return 1
        if (rightRank === undefined) return -1
        if (leftRank !== rightRank) return leftRank < rightRank ? -1 : 1
      }
      const comparison = compareText(leftToken.value, rightToken.value)
      if (comparison !== 0) return comparison
      continue
    }

    return leftToken.kind === 'number' ? 1 : -1
  }

  if (leftTokens.length !== rightTokens.length) {
    const leftTail = leftTokens.slice(commonLength)
    const rightTail = rightTokens.slice(commonLength)
    const leftRank = remainingVersionRank(leftTail)
    const rightRank = remainingVersionRank(rightTail)
    if (leftRank !== rightRank) return leftRank < rightRank ? -1 : 1
  }

  return compareText(left, right)
}

/** Return the greatest non-empty version, with deterministic lexical tie-breaking. */
export function selectLatestVersion(versions) {
  let latest
  for (const value of versions ?? []) {
    if (typeof value !== 'string' || !value.trim()) continue
    const version = value.trim()
    if (latest === undefined || compareVersions(version, latest) > 0) latest = version
  }
  return latest
}

/**
 * Parse a repository path such as
 * `manifests/m/Microsoft/PowerToys/0.91.0/Microsoft.PowerToys.yaml`.
 */
export function parseManifestPath(value) {
  if (typeof value !== 'string' || value.includes('\0')) return null
  const normalized = value.replaceAll('\\', '/').replace(/^\.\//, '')
  const segments = normalized.split('/')
  if (
    segments.length < 6 ||
    segments[0] !== 'manifests' ||
    segments.some((segment) => !segment || segment === '.' || segment === '..')
  ) {
    return null
  }

  const fileName = segments.at(-1)
  const version = segments.at(-2)
  const identifierParts = segments.slice(2, -2)
  if (!fileName || !version || identifierParts.length < 2 || !YAML_FILE_PATTERN.test(fileName)) {
    return null
  }

  const id = identifierParts.join('.')
  if (!PACKAGE_ID_PATTERN.test(id)) return null
  return {
    id,
    version,
    directory: segments.slice(0, -1).join('/'),
    fileName,
    path: normalized,
  }
}

/** Group manifest paths by package and choose one latest version directory per ID. */
export function selectLatestManifestDirectories(paths) {
  const groups = new Map()
  for (const value of paths ?? []) {
    const parsed = parseManifestPath(value)
    if (!parsed) continue
    const key = parsed.id.toLowerCase()
    let group = groups.get(key)
    if (!group) {
      group = { versions: new Map() }
      groups.set(key, group)
    }
    const current = group.versions.get(parsed.version)
    if (!current || compareText(parsed.directory, current.directory) < 0) {
      group.versions.set(parsed.version, parsed)
    }
  }

  return [...groups.values()]
    .map((group) => {
      const version = selectLatestVersion(group.versions.keys())
      const selected = version === undefined ? undefined : group.versions.get(version)
      return selected
        ? { id: selected.id, version: selected.version, directory: selected.directory }
        : null
    })
    .filter(Boolean)
    .sort((left, right) => compareText(left.id, right.id))
}

/**
 * Select the latest manifest directory for each package while retaining all
 * YAML paths needed by the checkout/parser stage.
 */
export function selectLatestVersionDirectories(paths) {
  const groups = new Map()
  for (const value of paths ?? []) {
    const parsed = parseManifestPath(value)
    if (!parsed) continue
    const packageKey = parsed.id.toLowerCase()
    let group = groups.get(packageKey)
    if (!group) {
      group = new Map()
      groups.set(packageKey, group)
    }
    let versionEntry = group.get(parsed.version)
    if (!versionEntry) {
      versionEntry = { directory: parsed.directory, version: parsed.version, files: new Set() }
      group.set(parsed.version, versionEntry)
    }
    versionEntry.files.add(parsed.path)
  }

  return [...groups.values()]
    .map((versions) => {
      const version = selectLatestVersion(versions.keys())
      const selected = version === undefined ? undefined : versions.get(version)
      return selected
        ? {
            directory: selected.directory,
            version: selected.version,
            files: [...selected.files].sort(compareText),
          }
        : null
    })
    .filter(Boolean)
    .sort((left, right) => compareText(left.directory, right.directory))
}

function normalizeLocale(value) {
  return typeof value === 'string' ? value.trim().replaceAll('_', '-').toLowerCase() : ''
}

function manifestType(candidate) {
  const value = candidate?.manifest?.ManifestType
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

/** Lower scores are preferred; filename provides the final deterministic tie-break. */
export function localePreference(candidate, defaultLocale = '') {
  const locale = normalizeLocale(candidate?.manifest?.PackageLocale)
  const type = manifestType(candidate)
  const normalizedDefault = normalizeLocale(defaultLocale)
  let rank = 4
  if (locale === 'en-us') rank = 0
  else if (locale === 'en-gb') rank = 1
  else if (type === 'defaultlocale' || type === 'singleton' || locale === normalizedDefault)
    rank = 2
  else if (type === 'locale') rank = 3

  return { rank, fileName: String(candidate?.fileName ?? '') }
}

/**
 * Prefer en-US, then en-GB, then the declared/default locale or singleton,
 * then any other locale. The input and returned item are `{fileName, manifest}`.
 */
export function selectPreferredLocaleManifest(candidates, defaultLocale = '') {
  return [...(candidates ?? [])]
    .filter(
      (candidate) =>
        candidate &&
        typeof candidate === 'object' &&
        candidate.manifest &&
        typeof candidate.manifest === 'object',
    )
    .sort((left, right) => {
      const leftPreference = localePreference(left, defaultLocale)
      const rightPreference = localePreference(right, defaultLocale)
      return (
        leftPreference.rank - rightPreference.rank ||
        compareText(leftPreference.fileName, rightPreference.fileName)
      )
    })[0]
}

/**
 * Choose a locale/singleton path using filenames alone. Callers should omit a
 * separate version manifest from `files` when distinguishing it from a
 * singleton is necessary; installer manifests are always ignored.
 */
export function chooseLocaleManifestFile(files, defaultLocale = '') {
  const normalizedDefault = normalizeLocale(defaultLocale)
  const localeCandidates = []
  const singletonCandidates = []
  for (const value of files ?? []) {
    if (typeof value !== 'string' || !YAML_FILE_PATTERN.test(value)) continue
    const fileName = value.replaceAll('\\', '/').split('/').at(-1) ?? ''
    if (/\.installer\.ya?ml$/i.test(fileName)) continue
    const localeMatch = fileName.match(/\.locale\.([^.]+)\.ya?ml$/i)
    const locale = normalizeLocale(localeMatch?.[1])
    const normalizedPath = value.replaceAll('\\', '/')
    if (!localeMatch) {
      singletonCandidates.push(normalizedPath)
      continue
    }
    let rank = 3
    if (locale === 'en-us') rank = 0
    else if (locale === 'en-gb') rank = 1
    else if (locale && locale === normalizedDefault) rank = 2
    localeCandidates.push({ path: normalizedPath, rank })
  }
  localeCandidates.sort(
    (left, right) => left.rank - right.rank || compareText(left.path, right.path),
  )
  if (localeCandidates.length > 0) return localeCandidates[0].path
  return singletonCandidates.sort(compareText)[0]
}

/** Remove markup/control characters, normalize whitespace, and cap Unicode code points. */
export function sanitizeText(value, maximumLength = 400) {
  if (typeof value !== 'string' || !Number.isInteger(maximumLength) || maximumLength < 1) return ''
  const cleaned = value
    .normalize('NFKC')
    .replace(/<[^>]*>/g, ' ')
    .replace(/[\p{Cc}\p{Cf}]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return Array.from(cleaned).slice(0, maximumLength).join('').trim()
}

/** Normalize, de-duplicate, and sort manifest tags independently of input order. */
export function sanitizeTags(value) {
  if (!Array.isArray(value)) return []
  const tags = new Map()
  for (const item of value) {
    const tag = sanitizeText(item, 40)
    if (!tag) continue
    const key = tag.toLowerCase()
    const current = tags.get(key)
    if (!current || compareText(tag, current) < 0) tags.set(key, tag)
  }
  return [...tags.values()].sort(compareText).slice(0, 32)
}

function normalizeSearchText(value) {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
}

function containsPhrase(haystack, phrase) {
  return ` ${haystack} `.includes(` ${phrase} `)
}

/** Infer one of the app's 13 exact categories from tags and package metadata. */
export function deriveCategory(metadata = {}) {
  const tags = sanitizeTags(metadata.tags ?? metadata.Tags).map(normalizeSearchText)
  const identity = normalizeSearchText(
    [metadata.id, metadata.name, metadata.publisher].filter(Boolean).join(' '),
  )
  const description = normalizeSearchText(metadata.description)
  let winner = 'Others'
  let winningScore = 0

  for (const rule of CATEGORY_RULES) {
    let score = 0
    for (const rawKeyword of rule.keywords) {
      const keyword = normalizeSearchText(rawKeyword)
      for (const tag of tags) {
        if (tag === keyword) score += 16
        else if (containsPhrase(tag, keyword)) score += 8
      }
      if (containsPhrase(identity, keyword)) score += 4
      if (containsPhrase(description, keyword)) score += 1
    }
    if (score > winningScore) {
      winner = rule.category
      winningScore = score
    }
  }

  if (winningScore === 0) {
    const id = normalizeSearchText(metadata.id)
    const publisher = normalizeSearchText(metadata.publisher)
    if (id.startsWith('microsoft ') || containsPhrase(publisher, 'microsoft')) {
      return 'Microsoft Tools'
    }
  }
  return winner
}

/** Public CLI-facing name for category inference. */
export const categorizePackage = deriveCategory

/** Generate a compact, Unicode-aware two-character package monogram. */
export function deriveMonogram(name) {
  const cleaned = sanitizeText(name, 100)
  const words = cleaned.match(/[\p{L}\p{N}]+/gu) ?? []
  let monogram
  if (words.length > 1) {
    monogram = `${Array.from(words[0])[0] ?? ''}${Array.from(words[1])[0] ?? ''}`
  } else {
    monogram = Array.from(words[0] ?? '')
      .slice(0, 2)
      .join('')
  }
  return monogram.toLocaleUpperCase('en-US') || '?'
}

/** Derive stable icon metadata solely from the package name and identifier. */
export function deriveIcon(name, packageId) {
  let hash = 0
  for (const character of String(packageId)) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0
  }
  return { monogram: deriveMonogram(name), ...ICON_PALETTE[hash % ICON_PALETTE.length] }
}

function firstText(candidates, keys, maximumLength) {
  for (const candidate of candidates) {
    for (const key of keys) {
      const value = sanitizeText(candidate?.manifest?.[key], maximumLength)
      if (value) return value
    }
  }
  return ''
}

/** Map parsed version/locale manifests into one app catalog record. */
export function buildCatalogPackage({ pathId, pathVersion, candidates }) {
  const manifests = [...(candidates ?? [])].filter(
    (candidate) => candidate?.manifest && typeof candidate.manifest === 'object',
  )
  const versionCandidate = manifests.find((candidate) => manifestType(candidate) === 'version')
  const defaultLocale = firstText([versionCandidate], ['DefaultLocale'], 32)
  const preferred = selectPreferredLocaleManifest(manifests, defaultLocale)
  const ordered = [
    preferred,
    ...manifests
      .filter((candidate) => candidate !== preferred)
      .sort((left, right) => compareText(String(left.fileName), String(right.fileName))),
  ].filter(Boolean)

  const manifestId = firstText(ordered, ['PackageIdentifier'], 128)
  const fallbackId = sanitizeText(pathId, 128)
  const id =
    PACKAGE_ID_PATTERN.test(manifestId) && manifestId.toLowerCase() === fallbackId.toLowerCase()
      ? manifestId
      : fallbackId
  if (!PACKAGE_ID_PATTERN.test(id)) return null

  const name =
    firstText(ordered, ['PackageName'], 100) || sanitizeText(id.split('.').at(-1), 100) || id
  const publisher =
    firstText(ordered, ['Publisher'], 100) ||
    sanitizeText(id.split('.')[0], 100) ||
    'Unknown publisher'
  const version = firstText(ordered, ['PackageVersion'], 64) || sanitizeText(pathVersion, 64)
  if (!version) return null
  const description =
    firstText(ordered, ['ShortDescription', 'Description'], 400) ||
    `${name} package from the Windows Package Manager community repository.`
  const tags = sanitizeTags(
    preferred?.manifest?.Tags ?? ordered.find((item) => item.manifest.Tags)?.manifest.Tags,
  )
  const category = deriveCategory({ id, name, publisher, description, tags })

  return { id, name, publisher, version, description, tags, category, icon: deriveIcon(name, id) }
}

/**
 * Build one catalog row from parsed WinGet version and chosen locale YAML.
 * Singleton manifests may be supplied for both manifest arguments.
 */
export function buildPackageRecord({ version, versionManifest, localeManifest }) {
  const sourceVersion =
    versionManifest && typeof versionManifest === 'object' ? versionManifest : Object.create(null)
  const sourceLocale =
    localeManifest && typeof localeManifest === 'object' ? localeManifest : Object.create(null)
  const id = sanitizeText(sourceLocale.PackageIdentifier ?? sourceVersion.PackageIdentifier, 128)
  if (!PACKAGE_ID_PATTERN.test(id)) return null
  const name =
    sanitizeText(sourceLocale.PackageName ?? sourceVersion.PackageName, 100) ||
    sanitizeText(id.split('.').at(-1), 100) ||
    id
  const publisher =
    sanitizeText(sourceLocale.Publisher ?? sourceVersion.Publisher, 100) ||
    sanitizeText(id.split('.')[0], 100) ||
    'Unknown publisher'
  const packageVersion =
    sanitizeText(sourceLocale.PackageVersion ?? sourceVersion.PackageVersion ?? version, 64) ||
    sanitizeText(version, 64)
  if (!packageVersion) return null
  const description =
    sanitizeText(
      sourceLocale.ShortDescription ??
        sourceLocale.Description ??
        sourceVersion.ShortDescription ??
        sourceVersion.Description,
      400,
    ) || `${name} package from the Windows Package Manager community repository.`
  const tags = sanitizeTags(sourceLocale.Tags ?? sourceVersion.Tags)
  const category = deriveCategory({ id, name, publisher, description, tags })
  return {
    id,
    name,
    publisher,
    version: packageVersion,
    description,
    tags,
    category,
    icon: deriveIcon(name, id),
  }
}

function canonicalizePackage(value) {
  if (!value || typeof value !== 'object') return null
  const id = sanitizeText(value.id, 128)
  const name = sanitizeText(value.name, 100)
  if (!PACKAGE_ID_PATTERN.test(id) || !name) return null
  const publisher = sanitizeText(value.publisher, 100) || 'Unknown publisher'
  const version = sanitizeText(value.version, 64) || 'Latest'
  const description =
    sanitizeText(value.description, 400) || 'No description is available from this package source.'
  const tags = sanitizeTags(value.tags)
  const category = CATEGORY_SET.has(value.category)
    ? value.category
    : deriveCategory({ id, name, publisher, description, tags })
  return { id, name, publisher, version, description, tags, category, icon: deriveIcon(name, id) }
}

function normalizeOfficialRepository(value) {
  const normalized = String(value ?? '')
    .trim()
    .replace(/\/+$/, '')
    .replace(/\.git$/i, '')
    .toLowerCase()
  if (normalized !== 'https://github.com/microsoft/winget-pkgs') {
    throw new Error('Snapshot source must be the official microsoft/winget-pkgs repository.')
  }
  return OFFICIAL_REPOSITORY
}

/** Create a canonical snapshot object. `generatedAt` must be the source commit timestamp. */
export function createCatalogSnapshot({
  generatedAt,
  repository = OFFICIAL_REPOSITORY,
  commit,
  packages,
  data,
}) {
  const sourceRepository = normalizeOfficialRepository(repository)
  const sourceCommit = String(commit ?? '')
    .trim()
    .toLowerCase()
  if (!COMMIT_PATTERN.test(sourceCommit))
    throw new Error('Snapshot commit must be a full 40-character SHA.')
  const timestamp = new Date(generatedAt)
  if (!Number.isFinite(timestamp.getTime()))
    throw new Error('Snapshot generatedAt must be a valid timestamp.')

  const canonicalPackages = [...(packages ?? data ?? [])]
    .map(canonicalizePackage)
    .filter(Boolean)
    .sort((left, right) => {
      const idComparison = compareText(left.id, right.id)
      if (idComparison !== 0) return idComparison
      const versionComparison = compareVersions(right.version, left.version)
      if (versionComparison !== 0) return versionComparison
      return compareText(JSON.stringify(left), JSON.stringify(right))
    })

  const deduplicated = []
  const identifiers = new Set()
  for (const packageData of canonicalPackages) {
    const key = packageData.id.toLowerCase()
    if (identifiers.has(key)) continue
    identifiers.add(key)
    deduplicated.push(packageData)
  }

  return {
    generatedAt: timestamp.toISOString(),
    source: { repository: sourceRepository, commit: sourceCommit },
    data: deduplicated,
  }
}

/** Serialize a canonical snapshot with stable key ordering, indentation, and trailing newline. */
export function serializeCatalogSnapshot(options) {
  return `${JSON.stringify(createCatalogSnapshot(options), null, 2)}\n`
}
