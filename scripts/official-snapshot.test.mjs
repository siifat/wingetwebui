import { readFile } from 'node:fs/promises'
import { describe, expect, it, vi } from 'vitest'

import { createPackageSource } from '../src/data/package-source.ts'

describe('generated official catalog snapshot', () => {
  it('is accepted end-to-end by the browser package adapter', async () => {
    const contents = await readFile('public/packages.json', 'utf8')
    const snapshot = JSON.parse(contents)
    const source = createPackageSource({
      apiUrl: './packages.json',
      fetcher: vi.fn(async () => new Response(contents, { status: 200 })),
    })

    const result = await source.load()

    expect(result.source).toBe('official')
    expect(result.isFallback).toBe(false)
    expect(result.error).toBeUndefined()
    expect(result.packages).toHaveLength(snapshot.data.length)
    expect(result.packages.length).toBeGreaterThan(10_000)
    expect(result.notice).toBeUndefined()
    expect(new Set(result.packages.map(({ id }) => id.toLocaleLowerCase('en-US'))).size).toBe(
      result.packages.length,
    )
    expect(result.sourceCommit).toMatch(/^[a-f0-9]{40}$/)
  })
})
