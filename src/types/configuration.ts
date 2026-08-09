import type { Package } from './package'
import type { SelectionState } from './selection'
import type { WingetOptions } from './winget'

export const CONFIGURATION_VERSION = 1 as const

export interface WingetConfigurationV1 {
  version: typeof CONFIGURATION_VERSION
  packages: Array<{ id: string }>
  wingetOptions: WingetOptions
}

export interface WorkspaceConfiguration {
  selection: SelectionState
  wingetOptions: WingetOptions
}

export type ConfigurationImportErrorCode =
  'INVALID_JSON' | 'UNSUPPORTED_VERSION' | 'INVALID_CONFIGURATION' | 'UNAVAILABLE_PACKAGES'

export interface ConfigurationImportError {
  code: ConfigurationImportErrorCode
  message: string
  issues?: string[]
  unsupportedVersion?: unknown
  unavailablePackageIds?: string[]
}

export type ParsedConfiguration = {
  configuration: WingetConfigurationV1
  packages: Package[]
}

export type ConfigurationParseResult =
  | { success: true; value: ParsedConfiguration }
  | { success: false; error: ConfigurationImportError }

export type ConfigurationDocumentResult =
  | { success: true; value: WingetConfigurationV1 }
  | { success: false; error: ConfigurationImportError }

/**
 * A prepared import never changes `current`. Callers may apply `next` only from
 * `ready`, or after explicitly confirming `confirmation-required`.
 */
export type PreparedConfigurationImport =
  | {
      status: 'ready'
      current: WorkspaceConfiguration
      next: WorkspaceConfiguration
    }
  | {
      status: 'confirmation-required'
      current: WorkspaceConfiguration
      next: WorkspaceConfiguration
    }
  | {
      status: 'error'
      current: WorkspaceConfiguration
      error: ConfigurationImportError
    }
