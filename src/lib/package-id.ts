/**
 * WinGet package IDs use a narrow ASCII identifier alphabet (Microsoft Store
 * IDs do not necessarily contain dots). This also prevents imported data from
 * becoming shell syntax.
 */
export const PACKAGE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._+-]{0,127}$/

export const MAX_PACKAGE_ID_LENGTH = 128

export function isValidPackageId(value: string): boolean {
  return value.length <= MAX_PACKAGE_ID_LENGTH && PACKAGE_ID_PATTERN.test(value)
}

export function assertValidPackageId(value: string): void {
  if (!isValidPackageId(value)) {
    throw new TypeError(`Invalid WinGet package identifier: ${value}`)
  }
}
