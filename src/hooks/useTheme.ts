import { useEffect, useState } from 'react'
import { type ThemePreference } from '../types/domain'

const STORAGE_KEY = 'winget-web-ui-theme'

function resolveTheme(preference: ThemePreference) {
  if (preference !== 'system') return preference
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function useTheme() {
  const [preference, setPreference] = useState<ThemePreference>(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY)
    return saved === 'light' || saved === 'dark' || saved === 'system' ? saved : 'system'
  })

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')

    const applyTheme = () => {
      document.documentElement.dataset.theme = resolveTheme(preference)
      document.documentElement.dataset.themePreference = preference
      const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
      meta?.setAttribute('content', resolveTheme(preference) === 'dark' ? '#0b0f16' : '#f5f7fb')
    }

    applyTheme()
    window.localStorage.setItem(STORAGE_KEY, preference)
    mediaQuery.addEventListener('change', applyTheme)
    return () => mediaQuery.removeEventListener('change', applyTheme)
  }, [preference])

  return { preference, setPreference }
}
