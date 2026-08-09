import { ChevronDown, Info } from 'lucide-react'
import { type WingetOptions } from '../types/domain'

const optionDefinitions: Array<{
  key: keyof WingetOptions
  label: string
  flag: string
  description: string
}> = [
  {
    key: 'acceptSourceAgreements',
    label: 'Accept source agreements',
    flag: '--accept-source-agreements',
    description: 'Accept package source terms without an extra prompt.',
  },
  {
    key: 'disableInteractivity',
    label: 'Disable interactivity',
    flag: '--disable-interactivity',
    description: 'Prevent interactive prompts while WinGet is running.',
  },
  {
    key: 'silent',
    label: 'Silent installation',
    flag: '--silent',
    description: 'Ask installers to avoid showing their own interface.',
  },
  {
    key: 'force',
    label: 'Force installation',
    flag: '--force',
    description: 'Run even when WinGet detects a non-security concern.',
  },
  {
    key: 'ignoreSecurityHash',
    label: 'Ignore security hash',
    flag: '--ignore-security-hash',
    description: 'Skip installer hash validation. Use only when you understand the risk.',
  },
  {
    key: 'verbose',
    label: 'Verbose output',
    flag: '--verbose',
    description: 'Include additional output to help diagnose an installation.',
  },
]

interface OptionsPanelProps {
  value: WingetOptions
  onChange: (options: WingetOptions) => void
}

export function OptionsPanel({ value, onChange }: OptionsPanelProps) {
  const enabledCount = optionDefinitions.filter(({ key }) => value[key]).length

  return (
    <details className="plan-section options-section">
      <summary>
        <span className="section-step">03</span>
        <span className="options-summary__copy">
          <strong>WinGet options</strong>
          <small>{enabledCount === 0 ? 'Default behavior' : `${enabledCount} enabled`}</small>
        </span>
        <span className="options-summary__badge">Advanced</span>
        <ChevronDown className="options-summary__chevron" size={17} />
      </summary>
      <div className="options-list">
        {optionDefinitions.map(({ key, label, flag, description }) => (
          <label className="option-row" key={key}>
            <span className="option-row__copy">
              <span>
                <strong>{label}</strong>
                <span className="option-info" title={description} aria-label={description}>
                  <Info size={13} />
                </span>
              </span>
              <code>{flag}</code>
              <small>{description}</small>
            </span>
            <input
              className="switch-input"
              type="checkbox"
              aria-label={label}
              checked={value[key]}
              onChange={(event) => onChange({ ...value, [key]: event.target.checked })}
            />
          </label>
        ))}
      </div>
    </details>
  )
}
