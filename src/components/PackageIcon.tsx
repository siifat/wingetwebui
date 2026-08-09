import { type WingetPackage } from '../types/domain'

interface PackageIconProps {
  packageInfo: WingetPackage
  size?: 'small' | 'medium' | 'large'
}

export function PackageIcon({ packageInfo, size = 'medium' }: PackageIconProps) {
  return (
    <span
      className={`package-icon package-icon--${size}`}
      style={
        {
          '--icon-background': packageInfo.icon.background,
          '--icon-foreground': packageInfo.icon.foreground ?? '#ffffff',
        } as React.CSSProperties
      }
      aria-hidden="true"
    >
      {packageInfo.icon.monogram}
    </span>
  )
}
