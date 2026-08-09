import { describe, expect, it } from 'vitest'

import type { WingetOptions } from '../types'
import {
  generateArtifacts,
  generateBatchScript,
  generatePowerShellScript,
  generateWingetCommand,
  getEnabledWingetFlags,
} from './generators'

const noOptions: WingetOptions = {
  acceptSourceAgreements: false,
  disableInteractivity: false,
  force: false,
  ignoreSecurityHash: false,
  silent: false,
  verbose: false,
}

const packages = [{ id: 'Microsoft.VisualStudioCode' }, { id: 'Git.Git' }, { id: '7zip.7zip' }]

describe('WinGet generation', () => {
  it('generates a multi-package command in selection order', () => {
    expect(generateWingetCommand(packages, noOptions)).toBe(
      'winget install Microsoft.VisualStudioCode Git.Git 7zip.7zip',
    )
  })

  it('generates enabled options in a stable documented order', () => {
    const options: WingetOptions = {
      ...noOptions,
      verbose: true,
      silent: true,
      ignoreSecurityHash: true,
      acceptSourceAgreements: true,
    }

    expect(getEnabledWingetFlags(options)).toEqual([
      '--accept-source-agreements',
      '--ignore-security-hash',
      '--silent',
      '--verbose',
    ])
    expect(generateWingetCommand(packages.slice(0, 1), options)).toBe(
      'winget install Microsoft.VisualStudioCode --accept-source-agreements --ignore-security-hash --silent --verbose',
    )
  })

  it('returns empty output for an empty selection', () => {
    expect(generateArtifacts([], noOptions)).toEqual({
      command: '',
      powershell: '',
      batch: '',
    })
  })

  it('rejects unsafe package identifiers', () => {
    expect(() => generateWingetCommand([{ id: 'Good.App && calc.exe' }], noOptions)).toThrow(
      'Invalid WinGet package identifier',
    )
  })
})

describe('script generation', () => {
  it('generates a PowerShell script with package order, options, and failures', () => {
    const output = generatePowerShellScript(packages, {
      ...noOptions,
      silent: true,
      disableInteractivity: true,
    })

    expect(output.indexOf("'Microsoft.VisualStudioCode'")).toBeLessThan(output.indexOf("'Git.Git'"))
    expect(output.indexOf("'Git.Git'")).toBeLessThan(output.indexOf("'7zip.7zip'"))
    expect(output).toContain(
      '& winget install --id $packageId --exact --disable-interactivity --silent',
    )
    expect(output).toContain('if ($LASTEXITCODE -ne 0)')
  })

  it('generates a Batch script with package order, options, and failures', () => {
    const output = generateBatchScript(packages, {
      ...noOptions,
      force: true,
      acceptSourceAgreements: true,
    })

    expect(output.indexOf('call :install "Microsoft.VisualStudioCode"')).toBeLessThan(
      output.indexOf('call :install "Git.Git"'),
    )
    expect(output.indexOf('call :install "Git.Git"')).toBeLessThan(
      output.indexOf('call :install "7zip.7zip"'),
    )
    expect(output).toContain('winget install --id "%~1" --exact --accept-source-agreements --force')
    expect(output).toContain('if errorlevel 1 exit /b 1')
    expect(output.startsWith('@echo off\r\nsetlocal')).toBe(true)
  })
})
