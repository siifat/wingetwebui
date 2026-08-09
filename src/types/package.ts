/** A WinGet package identifier, for example `Microsoft.VisualStudioCode`. */
export type PackageId = string

export const PACKAGE_CATEGORIES = [
  'Development',
  'Browsers',
  'Communications',
  'Microsoft Tools',
  'Multimedia',
  'Utilities',
  'Productivity',
  'Design & Creation',
  'Gaming',
  'Security & Privacy',
  'Cloud & Storage',
  'System Tools',
  'Others',
] as const

export const CATEGORIES = PACKAGE_CATEGORIES

export type PackageCategory = (typeof PACKAGE_CATEGORIES)[number]

export interface PackageIcon {
  monogram: string
  background: string
  foreground?: string
}

export interface WingetPackage {
  id: PackageId
  name: string
  publisher: string
  version: string
  description: string
  icon: PackageIcon
  category: PackageCategory
}

/** Short compatibility alias for domain helpers. */
export type Package = WingetPackage

export interface PackageReference {
  id: PackageId
}

export type ViewMode = 'grid' | 'list'

export type ThemePreference = 'light' | 'dark' | 'system'
