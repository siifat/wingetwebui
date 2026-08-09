import { z } from 'zod'

import type {
  ConfigurationDocumentResult,
  ConfigurationImportError,
  ConfigurationParseResult,
  PackageReference,
  PreparedConfigurationImport,
  WingetConfigurationV1,
  WingetOptions,
  WingetPackage,
  WorkspaceConfiguration,
} from '../types'
import { CONFIGURATION_VERSION, DEFAULT_WINGET_OPTIONS } from '../types'
import { MAX_PACKAGE_ID_LENGTH, PACKAGE_ID_PATTERN } from './package-id'

export const wingetOptionsSchema = z
  .object({
    acceptSourceAgreements: z.boolean(),
    disableInteractivity: z.boolean(),
    force: z.boolean(),
    ignoreSecurityHash: z.boolean(),
    silent: z.boolean(),
    verbose: z.boolean(),
  })
  .strict()

export const packageReferenceSchema = z
  .object({
    id: z
      .string()
      .min(1)
      .max(MAX_PACKAGE_ID_LENGTH)
      .regex(PACKAGE_ID_PATTERN, 'Invalid WinGet package identifier'),
  })
  .strict()

export const configurationV1Schema = z
  .object({
    version: z.literal(CONFIGURATION_VERSION),
    packages: z.array(packageReferenceSchema),
    wingetOptions: wingetOptionsSchema,
  })
  .strict()
  .superRefine(({ packages }, context) => {
    const seen = new Set<string>()
    packages.forEach(({ id }, index) => {
      if (seen.has(id)) {
        context.addIssue({
          code: 'custom',
          message: `Duplicate package identifier: ${id}`,
          path: ['packages', index, 'id'],
        })
      }
      seen.add(id)
    })
  })

function invalidConfigurationError(error: z.ZodError): ConfigurationImportError {
  return {
    code: 'INVALID_CONFIGURATION',
    message: 'This file is not a valid WingetWebUI configuration.',
    issues: error.issues.map((issue) => {
      const path = issue.path.join('.')
      return path ? `${path}: ${issue.message}` : issue.message
    }),
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function createConfiguration(
  packages: readonly PackageReference[],
  wingetOptions: Readonly<WingetOptions>,
): WingetConfigurationV1 {
  const candidate = {
    version: CONFIGURATION_VERSION,
    packages: packages.map(({ id }) => ({ id })),
    wingetOptions: { ...wingetOptions },
  }

  return configurationV1Schema.parse(candidate)
}

/** Deterministic serialization keeps selection order and uses stable key order. */
export function serializeConfiguration(
  packages: readonly PackageReference[],
  wingetOptions: Readonly<WingetOptions>,
  indentation = 2,
): string {
  return JSON.stringify(createConfiguration(packages, wingetOptions), null, indentation)
}

/** Parse and schema-check a document without resolving it against a catalog. */
export function deserializeConfiguration(input: string): ConfigurationDocumentResult {
  let parsedJson: unknown

  try {
    parsedJson = JSON.parse(input) as unknown
  } catch {
    return {
      success: false,
      error: {
        code: 'INVALID_JSON',
        message: 'The selected file does not contain valid JSON.',
      },
    }
  }

  if (
    isObject(parsedJson) &&
    'version' in parsedJson &&
    parsedJson.version !== CONFIGURATION_VERSION
  ) {
    return {
      success: false,
      error: {
        code: 'UNSUPPORTED_VERSION',
        message: `Configuration version ${String(parsedJson.version)} is not supported.`,
        unsupportedVersion: parsedJson.version,
      },
    }
  }

  const result = configurationV1Schema.safeParse(parsedJson)
  return result.success
    ? { success: true, value: result.data }
    : { success: false, error: invalidConfigurationError(result.error) }
}

/**
 * Validate an imported document and resolve all IDs to current catalog objects.
 * No partial selection is returned when any package is unavailable.
 */
export function parseConfiguration(
  input: string,
  availablePackages: readonly WingetPackage[],
): ConfigurationParseResult {
  const document = deserializeConfiguration(input)
  if (!document.success) return document

  const packageById = new Map(availablePackages.map((item) => [item.id, item] as const))
  const unavailablePackageIds = document.value.packages
    .map(({ id }) => id)
    .filter((id) => !packageById.has(id))

  if (unavailablePackageIds.length > 0) {
    return {
      success: false,
      error: {
        code: 'UNAVAILABLE_PACKAGES',
        message:
          unavailablePackageIds.length === 1
            ? 'One package in this configuration is unavailable.'
            : `${unavailablePackageIds.length} packages in this configuration are unavailable.`,
        unavailablePackageIds,
      },
    }
  }

  return {
    success: true,
    value: {
      configuration: document.value,
      packages: document.value.packages.map(({ id }) => packageById.get(id) as WingetPackage),
    },
  }
}

function optionsEqual(left: Readonly<WingetOptions>, right: Readonly<WingetOptions>): boolean {
  return Object.keys(DEFAULT_WINGET_OPTIONS).every((key) => {
    const optionKey = key as keyof WingetOptions
    return left[optionKey] === right[optionKey]
  })
}

export function workspaceHasUserConfiguration(
  workspace: Readonly<WorkspaceConfiguration>,
): boolean {
  return (
    workspace.selection.selectedIds.length > 0 ||
    !optionsEqual(workspace.wingetOptions, DEFAULT_WINGET_OPTIONS)
  )
}

/**
 * Prepare, but never mutate or silently apply, an imported configuration.
 * Existing user work produces a confirmation state unless replacement was
 * explicitly confirmed by the caller.
 */
export function prepareConfigurationImport(
  input: string,
  availablePackages: readonly WingetPackage[],
  current: WorkspaceConfiguration,
  replaceConfirmed = false,
): PreparedConfigurationImport {
  const parsed = parseConfiguration(input, availablePackages)
  if (!parsed.success) {
    return { status: 'error', current, error: parsed.error }
  }

  const selectedIds = parsed.value.configuration.packages.map(({ id }) => id)
  const next: WorkspaceConfiguration = {
    selection: {
      selectedIds,
      anchorId: selectedIds.at(-1) ?? null,
    },
    wingetOptions: { ...parsed.value.configuration.wingetOptions },
  }

  if (workspaceHasUserConfiguration(current) && !replaceConfirmed) {
    return { status: 'confirmation-required', current, next }
  }

  return { status: 'ready', current, next }
}
