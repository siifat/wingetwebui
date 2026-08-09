import {
  AppWindow,
  Blocks,
  Box,
  Brush,
  Cloud,
  Code2,
  Gamepad2,
  Globe2,
  HardDrive,
  MessageCircle,
  Music2,
  ShieldCheck,
  Sparkles,
  Wrench,
} from 'lucide-react'
import { CATEGORIES, type PackageCategory } from '../types/domain'

const categoryIcons: Record<PackageCategory, typeof Code2> = {
  Development: Code2,
  Browsers: Globe2,
  Communications: MessageCircle,
  'Microsoft Tools': AppWindow,
  Multimedia: Music2,
  Utilities: Wrench,
  Productivity: Sparkles,
  'Design & Creation': Brush,
  Gaming: Gamepad2,
  'Security & Privacy': ShieldCheck,
  'Cloud & Storage': Cloud,
  'System Tools': HardDrive,
  Others: Box,
}

interface CategorySidebarProps {
  activeCategory: PackageCategory | 'All'
  packageCounts: Map<PackageCategory, number>
  selectedCounts: Map<PackageCategory, number>
  totalCount: number
  onChange: (category: PackageCategory | 'All') => void
}

export function CategorySidebar({
  activeCategory,
  packageCounts,
  selectedCounts,
  totalCount,
  onChange,
}: CategorySidebarProps) {
  return (
    <aside className="category-sidebar" aria-label="Package categories">
      <div className="category-sidebar__title">
        <span>Categories</span>
        <span>{CATEGORIES.length}</span>
      </div>
      <div className="category-list">
        <button
          className="category-item"
          data-active={activeCategory === 'All'}
          type="button"
          onClick={() => onChange('All')}
        >
          <span className="category-item__icon">
            <Blocks size={16} />
          </span>
          <span className="category-item__label">All applications</span>
          <span className="category-item__count">{totalCount}</span>
        </button>
        {CATEGORIES.map((category) => {
          const Icon = categoryIcons[category]
          const selected = selectedCounts.get(category) ?? 0
          return (
            <button
              className="category-item"
              data-active={activeCategory === category}
              key={category}
              type="button"
              onClick={() => onChange(category)}
            >
              <span className="category-item__icon">
                <Icon size={16} />
              </span>
              <span className="category-item__label">{category}</span>
              {selected > 0 && (
                <span className="category-item__selected" aria-label={`${selected} selected`}>
                  {selected}
                </span>
              )}
              <span className="category-item__count">{packageCounts.get(category) ?? 0}</span>
            </button>
          )
        })}
      </div>
    </aside>
  )
}
