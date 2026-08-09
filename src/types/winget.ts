export interface WingetOptions {
  acceptSourceAgreements: boolean
  disableInteractivity: boolean
  force: boolean
  ignoreSecurityHash: boolean
  silent: boolean
  verbose: boolean
}

export type WingetOptionKey = keyof WingetOptions

export interface GeneratedArtifacts {
  command: string
  powershell: string
  batch: string
}

export const DEFAULT_WINGET_OPTIONS: Readonly<WingetOptions> = {
  acceptSourceAgreements: true,
  disableInteractivity: true,
  force: false,
  ignoreSecurityHash: false,
  silent: false,
  verbose: false,
}

export const WINGET_OPTION_FLAGS: Readonly<Record<WingetOptionKey, `--${string}`>> = {
  acceptSourceAgreements: '--accept-source-agreements',
  disableInteractivity: '--disable-interactivity',
  force: '--force',
  ignoreSecurityHash: '--ignore-security-hash',
  silent: '--silent',
  verbose: '--verbose',
}
