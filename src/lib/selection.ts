import type {
  MoveDirection,
  PackageId,
  SelectionModifiers,
  SelectionState,
  WingetPackage,
} from '../types'

function uniqueIds(ids: readonly PackageId[]): PackageId[] {
  return [...new Set(ids)]
}

export function createSelectionState(selectedIds: readonly PackageId[] = []): SelectionState {
  const uniqueSelectedIds = uniqueIds(selectedIds)

  return {
    selectedIds: uniqueSelectedIds,
    anchorId: uniqueSelectedIds.at(-1) ?? null,
  }
}

/** Toggle one ID without disturbing the relative order of the other IDs. */
export function togglePackageSelection(
  selectedIds: readonly PackageId[],
  packageId: PackageId,
): PackageId[] {
  if (selectedIds.includes(packageId)) {
    return selectedIds.filter((id) => id !== packageId)
  }

  return [...selectedIds, packageId]
}

export function addPackagesToSelection(
  selectedIds: readonly PackageId[],
  packageIds: readonly PackageId[],
): PackageId[] {
  const next = uniqueIds(selectedIds)
  const seen = new Set(next)

  for (const id of packageIds) {
    if (!seen.has(id)) {
      seen.add(id)
      next.push(id)
    }
  }

  return next
}

export function removePackagesFromSelection(
  selectedIds: readonly PackageId[],
  packageIds: readonly PackageId[],
): PackageId[] {
  const idsToRemove = new Set(packageIds)
  return selectedIds.filter((id) => !idsToRemove.has(id))
}

export function removePackageFromSelection(
  selectedIds: readonly PackageId[],
  packageId: PackageId,
): PackageId[] {
  return removePackagesFromSelection(selectedIds, [packageId])
}

export function clearSelection(): PackageId[] {
  return []
}

/**
 * Add the inclusive visible range between anchor and target. Previously
 * selected packages keep their order, then new range members are appended in
 * visible order.
 */
export function selectRange(
  selectedIds: readonly PackageId[],
  visiblePackageIds: readonly PackageId[],
  anchorId: PackageId,
  targetId: PackageId,
): PackageId[] {
  const anchorIndex = visiblePackageIds.indexOf(anchorId)
  const targetIndex = visiblePackageIds.indexOf(targetId)

  if (anchorIndex === -1 || targetIndex === -1) {
    return addPackagesToSelection(selectedIds, [targetId])
  }

  const first = Math.min(anchorIndex, targetIndex)
  const last = Math.max(anchorIndex, targetIndex)
  return addPackagesToSelection(selectedIds, visiblePackageIds.slice(first, last + 1))
}

/**
 * Apply a package-row interaction. Ctrl/Command uses the same additive toggle
 * semantics as the standard checkbox interaction; Shift selects a visible
 * inclusive range from the last non-Shift interaction.
 */
export function updateSelectionFromInteraction(
  state: Readonly<SelectionState>,
  packageId: PackageId,
  visiblePackageIds: readonly PackageId[],
  modifiers: Readonly<SelectionModifiers> = {},
): SelectionState {
  if (modifiers.shiftKey && state.anchorId) {
    return {
      selectedIds: selectRange(state.selectedIds, visiblePackageIds, state.anchorId, packageId),
      anchorId: state.anchorId,
    }
  }

  return {
    selectedIds: togglePackageSelection(state.selectedIds, packageId),
    anchorId: packageId,
  }
}

export function areAllPackagesSelected(
  selectedIds: readonly PackageId[],
  packageIds: readonly PackageId[],
): boolean {
  if (packageIds.length === 0) return false
  const selected = new Set(selectedIds)
  return packageIds.every((id) => selected.has(id))
}

/** Select all missing category IDs, or deselect the category when all are set. */
export function toggleCategorySelection(
  selectedIds: readonly PackageId[],
  categoryPackageIds: readonly PackageId[],
): PackageId[] {
  return areAllPackagesSelected(selectedIds, categoryPackageIds)
    ? removePackagesFromSelection(selectedIds, categoryPackageIds)
    : addPackagesToSelection(selectedIds, categoryPackageIds)
}

/** Move an item by array index, matching drag-and-drop list semantics. */
export function reorderSelection(
  selectedIds: readonly PackageId[],
  fromIndex: number,
  toIndex: number,
): PackageId[] {
  if (
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= selectedIds.length ||
    toIndex >= selectedIds.length ||
    fromIndex === toIndex
  ) {
    return [...selectedIds]
  }

  const next = [...selectedIds]
  const [moved] = next.splice(fromIndex, 1)
  next.splice(toIndex, 0, moved)
  return next
}

/** ID-based convenience adapter for drag-and-drop libraries such as dnd-kit. */
export function reorderSelectionById(
  selectedIds: readonly PackageId[],
  activeId: PackageId,
  overId: PackageId,
): PackageId[] {
  return reorderSelection(selectedIds, selectedIds.indexOf(activeId), selectedIds.indexOf(overId))
}

/** Keyboard-accessible alternative to drag-and-drop reordering. */
export function movePackageInSelection(
  selectedIds: readonly PackageId[],
  packageId: PackageId,
  direction: MoveDirection,
): PackageId[] {
  const currentIndex = selectedIds.indexOf(packageId)
  if (currentIndex === -1) return [...selectedIds]

  const nextIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1
  return reorderSelection(selectedIds, currentIndex, nextIndex)
}

/** Resolve selected IDs against a catalog without losing the selected order. */
export function resolveSelectedPackages(
  selectedIds: readonly PackageId[],
  availablePackages: readonly WingetPackage[],
): WingetPackage[] {
  const byId = new Map(availablePackages.map((item) => [item.id, item]))
  return selectedIds.flatMap((id) => {
    const item = byId.get(id)
    return item ? [item] : []
  })
}

// Concise aliases retained for callers that model selection as just an ID list.
export const toggleSelection = togglePackageSelection
export const removeFromSelection = removePackageFromSelection
