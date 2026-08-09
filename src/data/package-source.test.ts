import { describe, expect, it, vi } from 'vitest'

import { fallbackPackages, packageCategories } from './catalog'
import { createPackageSource } from './package-source'

describe('curated package catalog', () => {
  it('covers every documented category with genuine package identifiers', () => {
    const coveredCategories = new Set(fallbackPackages.map((packageData) => packageData.category))

    expect(fallbackPackages).toHaveLength(26)
    expect(coveredCategories).toEqual(new Set(packageCategories))
    expect(new Set(fallbackPackages.map((packageData) => packageData.id)).size).toBe(
      fallbackPackages.length,
    )
    expect(
      fallbackPackages.every(
        (packageData) =>
          packageData.icon.monogram.length > 0 && packageData.icon.background.startsWith('#'),
      ),
    ).toBe(true)
  })
})

describe('package source adapter', () => {
  it('uses the curated catalog without treating an unconfigured endpoint as an error', async () => {
    const source = createPackageSource({ apiUrl: '' })

    const result = await source.load()

    expect(source.configured).toBe(false)
    expect(result.source).toBe('curated')
    expect(result.isFallback).toBe(true)
    expect(result.error).toBeUndefined()
    expect(result.packages).toEqual(fallbackPackages)
  })

  it('accepts the documented envelope and sanitizes remote package metadata', async () => {
    const fetcher = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            data: [
              {
                id: ' Google.Chrome ',
                name: '<b>Google\u0000 Chrome</b>',
                publisher: ' Google ',
                version: null,
                description: '<i>Fast browser</i>',
                category: 'browsers',
                icon: { monogram: 'gc', background: '#123456', foreground: '#ffffff' },
              },
              { id: 'google.chrome', name: 'Duplicate Chrome' },
              { id: 'unsafe id && calc', name: 'Unsafe' },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
    )
    const source = createPackageSource({ apiUrl: '/api/v1/packages', fetcher })

    const result = await source.load()

    expect(result.source).toBe('remote')
    expect(result.isFallback).toBe(false)
    expect(result.error).toBeUndefined()
    expect(result.notice).toBe('2 invalid or duplicate package records were ignored.')
    expect(result.packages).toEqual([
      {
        id: 'Google.Chrome',
        name: 'Google Chrome',
        publisher: 'Google',
        version: 'Latest',
        description: 'Fast browser',
        category: 'Browsers',
        icon: { monogram: 'GC', background: '#123456', foreground: '#ffffff' },
      },
    ])
    expect(fetcher).toHaveBeenCalledOnce()
  })

  it('recognizes snapshots generated from the official WinGet manifest repository', async () => {
    const fetcher = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            generatedAt: '2026-08-10T10:00:00.000Z',
            source: {
              repository: 'https://github.com/microsoft/winget-pkgs.git',
              commit: '0123456789abcdef0123456789abcdef01234567',
            },
            data: [{ id: 'Git.Git', name: 'Git', category: 'Development' }],
          }),
          { status: 200 },
        ),
    )
    const source = createPackageSource({ apiUrl: './packages.json', fetcher })

    const result = await source.load()

    expect(result.source).toBe('official')
    expect(result.generatedAt).toBe('2026-08-10T10:00:00.000Z')
    expect(result.repository).toBe('https://github.com/microsoft/winget-pkgs.git')
    expect(result.sourceCommit).toBe('0123456789abcdef0123456789abcdef01234567')
    expect(result.packages[0]?.id).toBe('Git.Git')
  })

  it('reports a safe error and falls back when the remote payload is unusable', async () => {
    const fetcher = vi.fn(
      async () =>
        new Response(JSON.stringify({ data: [{ id: 'has spaces', name: 'Unsafe' }] }), {
          status: 200,
        }),
    )
    const source = createPackageSource({
      apiUrl: 'https://packages.example.test/api/v1/packages',
      fetcher,
    })

    const result = await source.load()

    expect(result.source).toBe('curated')
    expect(result.isFallback).toBe(true)
    expect(result.packages).toEqual(fallbackPackages)
    expect(result.error).toEqual({
      code: 'invalid-response',
      message: 'The package service returned no usable package records.',
    })
    expect(result.notice).toContain('curated offline catalog')
  })

  it('does not fetch an unsafe configured URL', async () => {
    const fetcher = vi.fn()
    const source = createPackageSource({ apiUrl: 'javascript:alert(1)', fetcher })

    const result = await source.load()

    expect(fetcher).not.toHaveBeenCalled()
    expect(result.error?.code).toBe('invalid-url')
    expect(result.source).toBe('curated')
  })
})
