import { describe, expect, it } from 'vitest'

import {
  buildCatalogPackage,
  buildPackageRecord,
  chooseLocaleManifestFile,
  compareVersions,
  createCatalogSnapshot,
  deriveCategory,
  deriveIcon,
  deriveMonogram,
  parseManifestPath,
  sanitizeText,
  selectLatestManifestDirectories,
  selectLatestVersionDirectories,
  selectLatestVersion,
  selectPreferredLocaleManifest,
  serializeCatalogSnapshot,
} from './winget-catalog-lib.mjs'

describe('manifest paths and versions', () => {
  it('parses a WinGet manifest path and rejects paths outside the manifest tree', () => {
    expect(
      parseManifestPath(
        'manifests/m/Microsoft/VisualStudio/Code/1.2.3/Microsoft.VisualStudio.Code.yaml',
      ),
    ).toEqual({
      id: 'Microsoft.VisualStudio.Code',
      version: '1.2.3',
      directory: 'manifests/m/Microsoft/VisualStudio/Code/1.2.3',
      fileName: 'Microsoft.VisualStudio.Code.yaml',
      path: 'manifests/m/Microsoft/VisualStudio/Code/1.2.3/Microsoft.VisualStudio.Code.yaml',
    })
    expect(parseManifestPath('README.md')).toBeNull()
    expect(parseManifestPath('manifests/m/Microsoft/App/1.0/readme.txt')).toBeNull()
  })

  it('selects loose numeric versions and prefers stable releases over prereleases', () => {
    expect(compareVersions('2.10.0', '2.9.99')).toBeGreaterThan(0)
    expect(compareVersions('1.0', '1.0-rc.2')).toBeGreaterThan(0)
    expect(compareVersions('1.0', '1.0.0-beta.2')).toBeGreaterThan(0)
    expect(compareVersions('1.0-rc.2', '1.0-beta.12')).toBeGreaterThan(0)
    expect(selectLatestVersion(['v1.0.0', '1.0.0-beta', '1.12.0', '1.9.9'])).toBe('1.12.0')
  })

  it('returns one latest directory per case-insensitive package ID in stable ID order', () => {
    const paths = [
      'manifests/z/Zoom/Zoom/5.9/Zoom.Zoom.yaml',
      'manifests/m/Microsoft/PowerToys/0.9/Microsoft.PowerToys.yaml',
      'manifests/m/Microsoft/PowerToys/0.10/Microsoft.PowerToys.locale.en-US.yaml',
      'manifests/m/Microsoft/PowerToys/0.10/Microsoft.PowerToys.installer.yaml',
    ]
    expect(selectLatestManifestDirectories(paths)).toEqual([
      {
        id: 'Microsoft.PowerToys',
        version: '0.10',
        directory: 'manifests/m/Microsoft/PowerToys/0.10',
      },
      { id: 'Zoom.Zoom', version: '5.9', directory: 'manifests/z/Zoom/Zoom/5.9' },
    ])
    expect(selectLatestVersionDirectories(paths)).toEqual([
      {
        directory: 'manifests/m/Microsoft/PowerToys/0.10',
        version: '0.10',
        files: [
          'manifests/m/Microsoft/PowerToys/0.10/Microsoft.PowerToys.installer.yaml',
          'manifests/m/Microsoft/PowerToys/0.10/Microsoft.PowerToys.locale.en-US.yaml',
        ],
      },
      {
        directory: 'manifests/z/Zoom/Zoom/5.9',
        version: '5.9',
        files: ['manifests/z/Zoom/Zoom/5.9/Zoom.Zoom.yaml'],
      },
    ])
  })
})

describe('locale and package metadata', () => {
  it('prefers en-US, en-GB, defaultLocale or singleton, then another locale', () => {
    const candidates = [
      {
        fileName: 'z.locale.fr-FR.yaml',
        manifest: { ManifestType: 'locale', PackageLocale: 'fr-FR' },
      },
      {
        fileName: 'z.default.yaml',
        manifest: { ManifestType: 'defaultLocale', PackageLocale: 'de-DE' },
      },
      {
        fileName: 'z.locale.en-GB.yaml',
        manifest: { ManifestType: 'locale', PackageLocale: 'en-GB' },
      },
      {
        fileName: 'z.locale.en-US.yaml',
        manifest: { ManifestType: 'locale', PackageLocale: 'en_US' },
      },
    ]
    expect(selectPreferredLocaleManifest(candidates, 'de-DE')).toBe(candidates[3])
    expect(selectPreferredLocaleManifest(candidates.slice(0, 3), 'de-DE')).toBe(candidates[2])
    expect(selectPreferredLocaleManifest(candidates.slice(0, 2), 'de-DE')).toBe(candidates[1])
    expect(
      chooseLocaleManifestFile(
        [
          'manifests/e/Example/App/1/Example.App.installer.yaml',
          'manifests/e/Example/App/1/Example.App.locale.fr-FR.yaml',
          'manifests/e/Example/App/1/Example.App.locale.en-GB.yaml',
          'manifests/e/Example/App/1/Example.App.locale.en-US.yaml',
        ],
        'fr-FR',
      ),
    ).toMatch(/en-US\.yaml$/)
    expect(
      chooseLocaleManifestFile(
        [
          'manifests/e/Example/App/1/Example.App.yaml',
          'manifests/e/Example/App/1/Example.App.locale.fr-FR.yaml',
        ],
        'fr-FR',
      ),
    ).toMatch(/fr-FR\.yaml$/)
  })

  it('maps parsed manifests into a sanitized app package', () => {
    const packageData = buildCatalogPackage({
      pathId: 'Example.Editor',
      pathVersion: '2.0',
      candidates: [
        {
          fileName: 'Example.Editor.yaml',
          manifest: {
            ManifestType: 'version',
            PackageIdentifier: 'Example.Editor',
            PackageVersion: '2.0',
            DefaultLocale: 'fr-FR',
          },
        },
        {
          fileName: 'Example.Editor.locale.fr-FR.yaml',
          manifest: {
            ManifestType: 'defaultLocale',
            PackageLocale: 'fr-FR',
            PackageIdentifier: 'Example.Editor',
            PackageVersion: '2.0',
            PackageName: 'Éditeur Exemple',
            Publisher: 'Example',
            ShortDescription: 'Un éditeur.',
            Tags: ['utility'],
          },
        },
        {
          fileName: 'Example.Editor.locale.en-US.yaml',
          manifest: {
            ManifestType: 'locale',
            PackageLocale: 'en-US',
            PackageIdentifier: 'Example.Editor',
            PackageVersion: '2.0',
            PackageName: '<b>Example Editor</b>',
            Publisher: 'Example\u0000 Inc.',
            ShortDescription: 'A source-code editor.',
            Tags: ['Development', 'IDE', 'development'],
          },
        },
      ],
    })

    expect(packageData).toMatchObject({
      id: 'Example.Editor',
      name: 'Example Editor',
      publisher: 'Example Inc.',
      version: '2.0',
      description: 'A source-code editor.',
      tags: ['Development', 'IDE'],
      category: 'Development',
    })

    expect(
      buildPackageRecord({
        version: '2.0',
        versionManifest: {
          PackageIdentifier: 'Example.Editor',
          PackageVersion: '2.0',
        },
        localeManifest: {
          PackageIdentifier: 'Example.Editor',
          PackageName: 'Example Editor',
          Publisher: 'Example',
          ShortDescription: 'A source-code editor.',
          Tags: ['development'],
        },
      }),
    ).toMatchObject({ id: 'Example.Editor', version: '2.0', category: 'Development' })
  })
})

describe('category and icon derivation', () => {
  it('weights exact tags above incidental description keywords', () => {
    expect(
      deriveCategory({
        id: 'Example.SafeBrowser',
        name: 'Safe Browser',
        publisher: 'Example',
        description: 'Includes a developer console and notes.',
        tags: ['browser'],
      }),
    ).toBe('Browsers')
    expect(
      deriveCategory({ id: 'Microsoft.PowerToys', name: 'PowerToys', publisher: 'Microsoft' }),
    ).toBe('Microsoft Tools')
    expect(deriveCategory({ id: 'Acme.Widget', name: 'Widget', publisher: 'Acme' })).toBe('Others')
  })

  it('creates deterministic monograms and color metadata', () => {
    expect(deriveMonogram('Visual Studio Code')).toBe('VS')
    expect(deriveMonogram('7-Zip')).toBe('7Z')
    expect(deriveIcon('Visual Studio Code', 'Microsoft.VisualStudioCode')).toEqual(
      deriveIcon('Visual Studio Code', 'Microsoft.VisualStudioCode'),
    )
    expect(deriveIcon('Visual Studio Code', 'Microsoft.VisualStudioCode').background).toMatch(
      /^#[0-9A-F]{6}$/,
    )
  })

  it('removes markup, control characters, and excess whitespace', () => {
    expect(sanitizeText(' <b>Hello</b>\u0000   world ', 20)).toBe('Hello world')
  })
})

describe('snapshot serialization', () => {
  const commit = '7efd77557c46e24d071e29d8fadf7077d5c92227'
  const packages = [
    {
      id: 'Zoom.Zoom',
      name: 'Zoom',
      publisher: 'Zoom',
      version: '6.0',
      description: 'Video conferencing.',
      tags: ['video conference'],
      category: 'Communications',
    },
    {
      id: '7zip.7zip',
      name: '7-Zip',
      publisher: 'Igor Pavlov',
      version: '24.09',
      description: 'File archiver.',
      tags: ['archive'],
      category: 'Utilities',
    },
  ]

  it('uses the commit timestamp, official source, canonical order, and full SHA', () => {
    const snapshot = createCatalogSnapshot({
      generatedAt: '2026-08-10T03:15:00+06:00',
      repository: 'https://github.com/microsoft/winget-pkgs',
      commit: commit.toUpperCase(),
      data: packages,
    })
    expect(snapshot.generatedAt).toBe('2026-08-09T21:15:00.000Z')
    expect(snapshot.source).toEqual({
      repository: 'https://github.com/microsoft/winget-pkgs.git',
      commit,
    })
    expect(snapshot.data.map((item) => item.id)).toEqual(['7zip.7zip', 'Zoom.Zoom'])
  })

  it('is byte-identical for equivalent inputs in different orders', () => {
    const options = { generatedAt: '2026-08-10T00:00:00Z', commit }
    expect(serializeCatalogSnapshot({ ...options, packages })).toBe(
      serializeCatalogSnapshot({ ...options, packages: [...packages].reverse() }),
    )
    expect(serializeCatalogSnapshot({ ...options, data: packages })).toMatch(/\n$/)
  })

  it('rejects non-official sources and abbreviated commits', () => {
    expect(() =>
      createCatalogSnapshot({
        generatedAt: '2026-08-10T00:00:00Z',
        repository: 'https://example.test/repository',
        commit,
        data: [],
      }),
    ).toThrow(/official/)
    expect(() =>
      createCatalogSnapshot({ generatedAt: '2026-08-10T00:00:00Z', commit: '7efd775', data: [] }),
    ).toThrow(/40-character/)
  })
})
