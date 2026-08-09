#!/usr/bin/env node

import { execFile, spawn } from 'node:child_process'
import { constants as fsConstants } from 'node:fs'
import {
  access,
  copyFile,
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { promisify } from 'node:util'
import { pathToFileURL } from 'node:url'

import { parse as parseYaml } from 'yaml'

import {
  buildPackageRecord,
  chooseLocaleManifestFile,
  selectLatestVersionDirectories,
  serializeCatalogSnapshot,
} from './winget-catalog-lib.mjs'

const execFileAsync = promisify(execFile)

const DEFAULT_REPOSITORY = 'https://github.com/microsoft/winget-pkgs.git'
const DEFAULT_BRANCH = 'master'
const DEFAULT_CACHE_DIRECTORY = '.cache/winget-pkgs'
const DEFAULT_OUTPUT_FILE = 'public/packages.json'
const CACHE_MARKER = '.winget-studio-catalog-cache.json'
const MAX_BUFFER_BYTES = 512 * 1024 * 1024
const MAX_CATALOG_PACKAGES = 75_000
const OFFICIAL_MINIMUM_PACKAGES = 5_000
const READ_CONCURRENCY = 64

const HELP = `Sync WingetWebUI's package catalog from official WinGet manifests.

Usage:
  npm run sync:catalog
  node scripts/sync-winget-catalog.mjs [options]

Options:
  --branch <name>     Branch to fetch (default: ${DEFAULT_BRANCH})
  --cache <path>      Marked partial-clone cache (default: ${DEFAULT_CACHE_DIRECTORY})
  --output <path>     Generated snapshot (default: ${DEFAULT_OUTPUT_FILE})
  -h, --help          Show this help

The default command writes a deterministic snapshot for the fetched upstream
commit. It never removes the repository cache or replaces the output until the
new catalog has been fully parsed and validated.
`

function parseArguments(argv) {
  const options = {
    branch: DEFAULT_BRANCH,
    cache: DEFAULT_CACHE_DIRECTORY,
    output: DEFAULT_OUTPUT_FILE,
    help: false,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument === '--help' || argument === '-h') {
      options.help = true
      continue
    }

    const optionNames = new Map([
      ['--branch', 'branch'],
      ['--cache', 'cache'],
      ['--output', 'output'],
    ])
    const optionName = optionNames.get(argument)
    if (!optionName) {
      throw new Error(`Unknown option: ${argument}`)
    }

    const value = argv[index + 1]
    if (!value || value.startsWith('--')) {
      throw new Error(`${argument} requires a value.`)
    }
    options[optionName] = value
    index += 1
  }

  return options
}

function normalizeRepositoryUrl(value) {
  return value
    .trim()
    .replace(/\/+$/, '')
    .replace(/\.git$/i, '')
    .toLocaleLowerCase('en-US')
}

function sanitizeProcessError(value) {
  return String(value ?? '')
    .replace(/(https?:\/\/)[^\s/@]+@/gi, '$1')
    .replace(/[\p{Cc}\p{Cf}]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 500)
}

function childEnvironment() {
  return {
    ...process.env,
    GIT_LFS_SKIP_SMUDGE: '1',
    GIT_TERMINAL_PROMPT: '0',
  }
}

async function runCommand(command, args, options = {}) {
  try {
    const result = await execFileAsync(command, args, {
      cwd: options.cwd,
      encoding: 'utf8',
      env: childEnvironment(),
      maxBuffer: MAX_BUFFER_BYTES,
      windowsHide: true,
    })
    return result.stdout.trim()
  } catch (error) {
    const detail = sanitizeProcessError(error?.stderr || error?.message)
    throw new Error(`${options.label ?? command} failed${detail ? `: ${detail}` : '.'}`, {
      cause: error,
    })
  }
}

async function runCommandWithInput(command, args, input, options = {}) {
  await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: childEnvironment(),
      shell: false,
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    const standardError = []

    child.stdout.resume()
    child.stderr.on('data', (chunk) => {
      if (standardError.reduce((total, item) => total + item.length, 0) < 1_000_000) {
        standardError.push(chunk)
      }
    })
    child.on('error', (error) => reject(error))
    child.stdin.on('error', (error) => reject(error))
    child.on('close', (code) => {
      if (code === 0) {
        resolve()
        return
      }
      const detail = sanitizeProcessError(Buffer.concat(standardError).toString('utf8'))
      reject(
        new Error(`${options.label ?? command} failed${detail ? `: ${detail}` : ` (${code})`}`),
      )
    })
    child.stdin.end(input)
  })
}

async function pathExists(target) {
  try {
    await access(target, fsConstants.F_OK)
    return true
  } catch {
    return false
  }
}

async function initializeCache(cacheDirectory, repository, branch) {
  const markerPath = path.join(cacheDirectory, CACHE_MARKER)
  const gitDirectory = path.join(cacheDirectory, '.git')
  const cacheExists = await pathExists(cacheDirectory)

  if (cacheExists && (await pathExists(markerPath))) {
    let marker
    try {
      marker = JSON.parse(await readFile(markerPath, 'utf8'))
    } catch {
      throw new Error(`The catalog cache marker is invalid: ${markerPath}`)
    }

    if (
      marker?.purpose !== 'winget-studio-catalog-cache' ||
      normalizeRepositoryUrl(marker.repository ?? '') !== normalizeRepositoryUrl(repository) ||
      !(await pathExists(gitDirectory))
    ) {
      throw new Error(
        `Refusing to modify an unrecognized cache. Move it aside and retry: ${cacheDirectory}`,
      )
    }

    const remoteUrl = await runCommand('git', ['remote', 'get-url', 'origin'], {
      cwd: cacheDirectory,
      label: 'Reading the catalog cache remote',
    })
    if (normalizeRepositoryUrl(remoteUrl) !== normalizeRepositoryUrl(repository)) {
      throw new Error(`The catalog cache points to a different repository: ${cacheDirectory}`)
    }
    return
  }

  if (cacheExists) {
    const cacheStats = await stat(cacheDirectory)
    const entries = cacheStats.isDirectory() ? await readdir(cacheDirectory) : ['not-a-directory']
    if (!cacheStats.isDirectory() || entries.length > 0) {
      throw new Error(
        `Refusing to use a non-empty, unmarked cache path. Choose another path: ${cacheDirectory}`,
      )
    }
  } else {
    await mkdir(path.dirname(cacheDirectory), { recursive: true })
  }

  console.log('Creating a shallow, blob-filtered WinGet manifest cache…')
  await runCommand(
    'git',
    [
      'clone',
      '--depth=1',
      '--filter=blob:none',
      '--no-checkout',
      '--single-branch',
      `--branch=${branch}`,
      repository,
      cacheDirectory,
    ],
    { label: 'Cloning the WinGet manifest repository' },
  )
  await writeFile(
    markerPath,
    `${JSON.stringify({ purpose: 'winget-studio-catalog-cache', repository, branch }, null, 2)}\n`,
    'utf8',
  )
}

async function fetchCommit(cacheDirectory, branch) {
  console.log(`Fetching origin/${branch}…`)
  await runCommand(
    'git',
    ['fetch', '--depth=1', '--filter=blob:none', '--no-tags', 'origin', branch],
    { cwd: cacheDirectory, label: 'Fetching the latest WinGet manifests' },
  )
  const commit = await runCommand('git', ['rev-parse', '--verify', 'FETCH_HEAD^{commit}'], {
    cwd: cacheDirectory,
    label: 'Resolving the fetched WinGet commit',
  })
  if (!/^[a-f0-9]{40}$/i.test(commit)) {
    throw new Error('Git returned an invalid upstream commit identifier.')
  }
  return commit
}

async function enumerateManifestPaths(cacheDirectory, commit) {
  console.log('Enumerating official manifest paths…')
  const output = await runCommand(
    'git',
    ['ls-tree', '-r', '--name-only', commit, '--', 'manifests'],
    { cwd: cacheDirectory, label: 'Enumerating WinGet manifest paths' },
  )
  return output.split(/\r?\n/).filter((item) => /^manifests\/.*\.ya?ml$/i.test(item))
}

async function sparseCheckout(cacheDirectory, commit, directories) {
  console.log(`Checking out ${directories.length.toLocaleString()} latest-version directories…`)
  await runCommand('git', ['sparse-checkout', 'init', '--cone'], {
    cwd: cacheDirectory,
    label: 'Initializing the sparse manifest checkout',
  })
  await runCommandWithInput(
    'git',
    ['sparse-checkout', 'set', '--stdin'],
    `${directories.join('\n')}\n`,
    { cwd: cacheDirectory, label: 'Selecting latest manifest directories' },
  )
  await runCommand(
    'git',
    ['-c', 'advice.detachedHead=false', 'checkout', '--detach', '--force', commit],
    { cwd: cacheDirectory, label: 'Checking out selected WinGet manifests' },
  )
}

function manifestType(value) {
  return typeof value?.ManifestType === 'string'
    ? value.ManifestType.toLocaleLowerCase('en-US')
    : ''
}

async function readManifest(cacheDirectory, repositoryPath) {
  const target = path.resolve(cacheDirectory, ...repositoryPath.split('/'))
  const relative = path.relative(cacheDirectory, target)
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`Unsafe manifest path returned by Git: ${repositoryPath}`)
  }

  const contents = await readFile(target, 'utf8')
  const document = parseYaml(contents, { maxAliasCount: 20, prettyErrors: false })
  if (typeof document !== 'object' || document === null || Array.isArray(document)) {
    throw new Error(`Manifest is not a YAML object: ${repositoryPath}`)
  }
  return document
}

async function parsePackageDirectory(cacheDirectory, selectedDirectory) {
  const primaryFiles = selectedDirectory.files
    .filter((file) => !/\.installer\.ya?ml$/i.test(file) && !/\.locale\.[^.]+\.ya?ml$/i.test(file))
    .sort((left, right) => left.localeCompare(right, 'en-US'))

  let primaryManifest
  for (const file of primaryFiles) {
    try {
      const candidate = await readManifest(cacheDirectory, file)
      if (manifestType(candidate) === 'version' || manifestType(candidate) === 'singleton') {
        primaryManifest = candidate
        break
      }
    } catch {
      // A malformed package is skipped later without aborting the complete official snapshot.
    }
  }

  if (!primaryManifest) return null

  if (manifestType(primaryManifest) === 'singleton') {
    const packageInfo = buildPackageRecord({
      version: selectedDirectory.version,
      versionManifest: primaryManifest,
      localeManifest: primaryManifest,
    })
    return packageMatchesDirectory(packageInfo, selectedDirectory) ? packageInfo : null
  }

  const localeFile = chooseLocaleManifestFile(
    selectedDirectory.files.filter((file) => /\.locale\.[^.]+\.ya?ml$/i.test(file)),
    typeof primaryManifest.DefaultLocale === 'string' ? primaryManifest.DefaultLocale : undefined,
  )
  if (!localeFile) return null

  try {
    const localeManifest = await readManifest(cacheDirectory, localeFile)
    const packageInfo = buildPackageRecord({
      version: selectedDirectory.version,
      versionManifest: primaryManifest,
      localeManifest,
    })
    return packageMatchesDirectory(packageInfo, selectedDirectory) ? packageInfo : null
  } catch {
    return null
  }
}

function packageMatchesDirectory(packageInfo, selectedDirectory) {
  if (!packageInfo) return false
  const segments = selectedDirectory.directory.split('/')
  const expectedId = segments.slice(2, -1).join('.')
  return (
    packageInfo.id.toLocaleLowerCase('en-US') === expectedId.toLocaleLowerCase('en-US') &&
    packageInfo.version.toLocaleLowerCase('en-US') ===
      selectedDirectory.version.toLocaleLowerCase('en-US')
  )
}

async function mapWithConcurrency(values, concurrency, mapper) {
  const results = new Array(values.length)
  let cursor = 0
  let completed = 0

  async function worker() {
    while (cursor < values.length) {
      const index = cursor
      cursor += 1
      results[index] = await mapper(values[index])
      completed += 1
      if (completed % 2_500 === 0) {
        console.log(`Parsed ${completed.toLocaleString()} package directories…`)
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, () => worker()))
  return results
}

function validatePackages(packages, officialRepository) {
  if (packages.length > MAX_CATALOG_PACKAGES) {
    throw new Error(
      `Generated ${packages.length.toLocaleString()} packages, above the ${MAX_CATALOG_PACKAGES.toLocaleString()} safety limit.`,
    )
  }
  if (officialRepository && packages.length < OFFICIAL_MINIMUM_PACKAGES) {
    throw new Error(
      `Only ${packages.length.toLocaleString()} official packages were usable; refusing to replace the last good snapshot.`,
    )
  }

  const identifiers = new Set()
  for (const packageInfo of packages) {
    const normalizedId = packageInfo.id.toLocaleLowerCase('en-US')
    if (identifiers.has(normalizedId)) {
      throw new Error(`Generated duplicate package identifier: ${packageInfo.id}`)
    }
    identifiers.add(normalizedId)
  }
}

async function replaceSnapshot(outputFile, contents) {
  await mkdir(path.dirname(outputFile), { recursive: true })
  try {
    if ((await readFile(outputFile, 'utf8')) === contents) {
      console.log('The committed snapshot is already current.')
      return false
    }
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error
  }

  const temporaryFile = `${outputFile}.tmp-${process.pid}`
  await writeFile(temporaryFile, contents, 'utf8')
  try {
    try {
      await rename(temporaryFile, outputFile)
    } catch (error) {
      if (process.platform !== 'win32' || !['EEXIST', 'EPERM'].includes(error?.code)) throw error
      await copyFile(temporaryFile, outputFile)
      await rm(temporaryFile, { force: true })
    }
  } finally {
    await rm(temporaryFile, { force: true })
  }
  return true
}

export async function synchronizeCatalog(options) {
  const workspace = process.cwd()
  const cacheDirectory = path.resolve(workspace, options.cache)
  const outputFile = path.resolve(workspace, options.output)
  const repository = DEFAULT_REPOSITORY
  const branch = options.branch.trim()

  if (!repository || !branch) throw new Error('Repository and branch must not be empty.')
  if (cacheDirectory === workspace || path.parse(cacheDirectory).root === cacheDirectory) {
    throw new Error(
      'The catalog cache must be a dedicated subdirectory, not a workspace or drive root.',
    )
  }
  if (outputFile === workspace || path.parse(outputFile).root === outputFile) {
    throw new Error('The catalog output must be a JSON file, not a directory root.')
  }

  await runCommand('git', ['--version'], { label: 'Checking Git availability' })
  await initializeCache(cacheDirectory, repository, branch)
  await runCommand('git', ['config', 'core.longpaths', 'true'], {
    cwd: cacheDirectory,
    label: 'Enabling long manifest paths in the catalog cache',
  })
  const commit = await fetchCommit(cacheDirectory, branch)
  const manifestPaths = await enumerateManifestPaths(cacheDirectory, commit)
  const selectedDirectories = selectLatestVersionDirectories(manifestPaths)
  if (selectedDirectories.length === 0) {
    throw new Error('No versioned package manifest directories were found.')
  }

  await sparseCheckout(
    cacheDirectory,
    commit,
    selectedDirectories.map(({ directory }) => directory),
  )
  const packageCandidates = await mapWithConcurrency(
    selectedDirectories,
    READ_CONCURRENCY,
    (selectedDirectory) => parsePackageDirectory(cacheDirectory, selectedDirectory),
  )
  const packages = packageCandidates.filter(Boolean)
  validatePackages(packages, true)

  const generatedAt = await runCommand('git', ['show', '-s', '--format=%cI', commit], {
    cwd: cacheDirectory,
    label: 'Reading the upstream commit timestamp',
  })
  const snapshot = serializeCatalogSnapshot({
    packages,
    repository: DEFAULT_REPOSITORY,
    commit,
    generatedAt,
  })

  const parsedSnapshot = JSON.parse(snapshot)
  if (!Array.isArray(parsedSnapshot.data) || parsedSnapshot.data.length !== packages.length) {
    throw new Error('The generated snapshot failed its final integrity check.')
  }

  const changed = await replaceSnapshot(outputFile, snapshot)
  console.log(
    `${changed ? 'Wrote' : 'Validated'} ${packages.length.toLocaleString()} packages from ${commit.slice(0, 12)} to ${path.relative(workspace, outputFile)}.`,
  )
  return { changed, commit, packageCount: packages.length, outputFile }
}

async function main() {
  let options
  try {
    options = parseArguments(process.argv.slice(2))
  } catch (error) {
    console.error(`Catalog sync error: ${sanitizeProcessError(error?.message)}`)
    console.error('Run with --help for usage.')
    process.exitCode = 1
    return
  }

  if (options.help) {
    console.log(HELP)
    return
  }

  try {
    await synchronizeCatalog(options)
  } catch (error) {
    console.error(`Catalog sync error: ${sanitizeProcessError(error?.message)}`)
    process.exitCode = 1
  }
}

const entryPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : undefined
if (entryPath === import.meta.url) {
  await main()
}
