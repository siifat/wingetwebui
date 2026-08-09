import type { PackageId } from './package'

/**
 * IDs are the source of truth for selection and their array order is the user's
 * installation order. The anchor is only used for the next Shift interaction.
 */
export interface SelectionState {
  selectedIds: PackageId[]
  anchorId: PackageId | null
}

export interface SelectionModifiers {
  ctrlKey?: boolean
  metaKey?: boolean
  shiftKey?: boolean
}

export type MoveDirection = 'up' | 'down'
