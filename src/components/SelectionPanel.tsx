import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ArrowDown, ArrowUp, GripVertical, MousePointerClick, Trash2, X } from 'lucide-react'
import { type WingetPackage } from '../types/domain'
import { PackageIcon } from './PackageIcon'

interface SortablePackageProps {
  packageInfo: WingetPackage
  index: number
  total: number
  onRemove: (id: string) => void
  onMove: (index: number, direction: -1 | 1) => void
}

function SortablePackage({ packageInfo, index, total, onRemove, onMove }: SortablePackageProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: packageInfo.id,
  })

  return (
    <li
      ref={setNodeRef}
      className="selected-package"
      data-dragging={isDragging}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <span className="selected-package__number" aria-hidden="true">
        {index + 1}
      </span>
      <button
        className="drag-handle"
        type="button"
        aria-label={`Reorder ${packageInfo.name}. Use arrow keys while dragging.`}
        {...attributes}
        {...listeners}
      >
        <GripVertical size={16} />
      </button>
      <PackageIcon packageInfo={packageInfo} size="small" />
      <span className="selected-package__copy">
        <strong>{packageInfo.name}</strong>
        <code>{packageInfo.id}</code>
      </span>
      <span className="selected-package__controls">
        <button
          className="icon-button icon-button--small"
          type="button"
          disabled={index === 0}
          onClick={() => onMove(index, -1)}
          aria-label={`Move ${packageInfo.name} up`}
          title="Move up"
        >
          <ArrowUp size={14} />
        </button>
        <button
          className="icon-button icon-button--small"
          type="button"
          disabled={index === total - 1}
          onClick={() => onMove(index, 1)}
          aria-label={`Move ${packageInfo.name} down`}
          title="Move down"
        >
          <ArrowDown size={14} />
        </button>
        <button
          className="icon-button icon-button--small icon-button--danger"
          type="button"
          onClick={() => onRemove(packageInfo.id)}
          aria-label={`Remove ${packageInfo.name}`}
          title="Remove"
        >
          <X size={14} />
        </button>
      </span>
    </li>
  )
}

interface SelectionPanelProps {
  packages: WingetPackage[]
  onRemove: (id: string) => void
  onClear: () => void
  onReorder: (activeId: string, overId: string) => void
  onMove: (index: number, direction: -1 | 1) => void
  onBrowse: () => void
}

export function SelectionPanel({
  packages,
  onRemove,
  onClear,
  onReorder,
  onMove,
  onBrowse,
}: SelectionPanelProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (over && active.id !== over.id) onReorder(String(active.id), String(over.id))
  }

  return (
    <section className="plan-section selection-section" aria-labelledby="selection-title">
      <div className="section-heading">
        <div>
          <span className="section-step">02</span>
          <div>
            <h2 id="selection-title">Install plan</h2>
            <p>
              {packages.length === 0
                ? 'Your ordered app list'
                : `${packages.length} ${packages.length === 1 ? 'app' : 'apps'} in order`}
            </p>
          </div>
        </div>
        {packages.length > 0 && (
          <button className="button button--text button--danger" type="button" onClick={onClear}>
            <Trash2 size={14} /> Clear
          </button>
        )}
      </div>

      {packages.length === 0 ? (
        <div className="selection-empty">
          <span>
            <MousePointerClick size={21} />
          </span>
          <div>
            <strong>No applications selected</strong>
            <p>Choose apps from the catalog to build your installation plan.</p>
          </div>
          <button
            className="button button--secondary button--compact"
            type="button"
            onClick={onBrowse}
          >
            Browse apps
          </button>
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext
            items={packages.map((item) => item.id)}
            strategy={verticalListSortingStrategy}
          >
            <ol
              className="selected-packages"
              aria-label="Selected applications in installation order"
            >
              {packages.map((packageInfo, index) => (
                <SortablePackage
                  key={packageInfo.id}
                  packageInfo={packageInfo}
                  index={index}
                  total={packages.length}
                  onRemove={onRemove}
                  onMove={onMove}
                />
              ))}
            </ol>
          </SortableContext>
        </DndContext>
      )}
    </section>
  )
}
