import { Check, Laptop, Moon, Sun } from 'lucide-react'
import { type ThemePreference } from '../types/domain'

const themes: Array<{
  value: ThemePreference
  label: string
  icon: typeof Sun
}> = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Laptop },
]

interface ThemeControlProps {
  value: ThemePreference
  onChange: (value: ThemePreference) => void
}

export function ThemeControl({ value, onChange }: ThemeControlProps) {
  return (
    <div className="theme-control" aria-label="Appearance" role="group">
      {themes.map(({ value: option, label, icon: Icon }) => (
        <button
          className="theme-control__button"
          data-active={value === option}
          key={option}
          onClick={() => onChange(option)}
          type="button"
          aria-label={`${label} theme`}
          aria-pressed={value === option}
          title={`${label} theme`}
        >
          <Icon size={15} strokeWidth={2} />
          <span className="sr-only">{label}</span>
          {value === option && <Check className="theme-control__check" size={9} />}
        </button>
      ))}
    </div>
  )
}
