import { describe, expect, it } from 'vitest'

import type { WingetOptions, WingetPackage, WorkspaceConfiguration } from '../types'
import { CONFIGURATION_VERSION, DEFAULT_WINGET_OPTIONS } from '../types'
import {
  deserializeConfiguration,
  parseConfiguration,
  prepareConfigurationImport,
  serializeConfiguration,
} from './configuration'

const catalog: WingetPackage[] = [
  {
    id: 'Microsoft.VisualStudioCode',
    name: 'Visual Studio Code',
    publisher: 'Microsoft',
    version: 'latest',
    description: 'A source code editor.',
    icon: { monogram: 'VS', background: '#2477c9' },
    category: 'Development',
  },
  {
    id: 'Git.Git',
    name: 'Git',
    publisher: 'Git',
    version: 'latest',
    description: 'Version control.',
    icon: { monogram: 'G', background: '#f05032' },
    category: 'Development',
  },
]

const options: WingetOptions = {
  ...DEFAULT_WINGET_OPTIONS,
  silent: true,
}

const validJson = serializeConfiguration([catalog[1], catalog[0]], options)

describe('configuration serialization and validation', () => {
  it('serializes a versioned configuration in package order', () => {
    const value = JSON.parse(validJson) as Record<string, unknown>

    expect(value).toEqual({
      version: CONFIGURATION_VERSION,
      packages: [{ id: 'Git.Git' }, { id: 'Microsoft.VisualStudioCode' }],
      wingetOptions: options,
    })
  })

  it('deserializes and validates a supported document', () => {
    const result = deserializeConfiguration(validJson)

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.value.packages.map(({ id }) => id)).toEqual([
        'Git.Git',
        'Microsoft.VisualStudioCode',
      ])
    }
  })

  it('resolves imported packages in exported order', () => {
    const result = parseConfiguration(validJson, catalog)

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.value.packages.map(({ id }) => id)).toEqual([
        'Git.Git',
        'Microsoft.VisualStudioCode',
      ])
      expect(result.value.configuration.wingetOptions.silent).toBe(true)
    }
  })

  it('reports invalid JSON with a safe result', () => {
    expect(deserializeConfiguration('{not json')).toEqual({
      success: false,
      error: {
        code: 'INVALID_JSON',
        message: 'The selected file does not contain valid JSON.',
      },
    })
  })

  it('reports unsupported versions distinctly', () => {
    const result = deserializeConfiguration(
      JSON.stringify({ version: 99, packages: [], wingetOptions: options }),
    )

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.code).toBe('UNSUPPORTED_VERSION')
      expect(result.error.unsupportedVersion).toBe(99)
    }
  })

  it('rejects missing fields, extra fields, and duplicate IDs', () => {
    const missing = deserializeConfiguration(JSON.stringify({ version: 1, packages: [] }))
    const extra = deserializeConfiguration(
      JSON.stringify({
        version: 1,
        packages: [],
        wingetOptions: options,
        executeAutomatically: true,
      }),
    )
    const duplicate = deserializeConfiguration(
      JSON.stringify({
        version: 1,
        packages: [{ id: 'Git.Git' }, { id: 'Git.Git' }],
        wingetOptions: options,
      }),
    )

    for (const result of [missing, extra, duplicate]) {
      expect(result.success).toBe(false)
      if (!result.success) expect(result.error.code).toBe('INVALID_CONFIGURATION')
    }
  })

  it('rejects invalid package identifiers before command generation', () => {
    const result = deserializeConfiguration(
      JSON.stringify({
        version: 1,
        packages: [{ id: 'Git.Git && calc.exe' }],
        wingetOptions: options,
      }),
    )

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.code).toBe('INVALID_CONFIGURATION')
      expect(result.error.issues?.join(' ')).toContain('Invalid WinGet package identifier')
    }
  })

  it('identifies every unavailable package and returns no partial state', () => {
    const result = parseConfiguration(
      serializeConfiguration([{ id: 'Git.Git' }, { id: 'Missing.Package' }], options),
      catalog,
    )

    expect(result).toEqual({
      success: false,
      error: {
        code: 'UNAVAILABLE_PACKAGES',
        message: 'One package in this configuration is unavailable.',
        unavailablePackageIds: ['Missing.Package'],
      },
    })
  })
})

describe('safe configuration preparation', () => {
  it('does not mutate existing state when import is invalid', () => {
    const current: WorkspaceConfiguration = {
      selection: {
        selectedIds: ['Current.App'],
        anchorId: 'Current.App',
      },
      wingetOptions: { ...DEFAULT_WINGET_OPTIONS },
    }
    const snapshot = structuredClone(current)

    const result = prepareConfigurationImport('{invalid', catalog, current)

    expect(result.status).toBe('error')
    expect(result.current).toBe(current)
    expect(current).toEqual(snapshot)
  })

  it('requires confirmation before replacing existing user work', () => {
    const current: WorkspaceConfiguration = {
      selection: {
        selectedIds: ['Current.App'],
        anchorId: 'Current.App',
      },
      wingetOptions: { ...DEFAULT_WINGET_OPTIONS },
    }

    const result = prepareConfigurationImport(validJson, catalog, current)

    expect(result.status).toBe('confirmation-required')
    if (result.status === 'confirmation-required') {
      expect(result.current).toBe(current)
      expect(result.next.selection.selectedIds).toEqual(['Git.Git', 'Microsoft.VisualStudioCode'])
      expect(result.next.wingetOptions.silent).toBe(true)
    }
  })

  it('prepares replacement only after explicit confirmation', () => {
    const current: WorkspaceConfiguration = {
      selection: {
        selectedIds: ['Current.App'],
        anchorId: 'Current.App',
      },
      wingetOptions: { ...DEFAULT_WINGET_OPTIONS },
    }

    const result = prepareConfigurationImport(validJson, catalog, current, true)

    expect(result.status).toBe('ready')
    if (result.status === 'ready') {
      expect(result.next.selection).toEqual({
        selectedIds: ['Git.Git', 'Microsoft.VisualStudioCode'],
        anchorId: 'Microsoft.VisualStudioCode',
      })
    }
  })
})
