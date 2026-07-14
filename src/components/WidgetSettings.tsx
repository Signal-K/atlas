import { useState } from 'react'
import { getOrderedWidgets, moveWidget, reorderWidget, setWidgetEnabled } from '../widgets/registry'

export function WidgetSettings() {
  const [, forceRender] = useState(0)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const widgets = getOrderedWidgets()

  function refresh() {
    forceRender((n) => n + 1)
  }

  return (
    <div className="widget-settings">
      {widgets.map((widget, index) => (
        <div
          className={`settings-row widget-settings-row${draggingId === widget.id ? ' is-dragging' : ''}${dragOverId === widget.id && draggingId !== widget.id ? ' is-drag-over' : ''}`}
          key={widget.id}
          draggable
          onDragStart={() => setDraggingId(widget.id)}
          onDragEnd={() => {
            setDraggingId(null)
            setDragOverId(null)
          }}
          onDragOver={(event) => {
            event.preventDefault()
            if (draggingId && draggingId !== widget.id) setDragOverId(widget.id)
          }}
          onDrop={(event) => {
            event.preventDefault()
            if (draggingId) reorderWidget(draggingId, widget.id)
            setDraggingId(null)
            setDragOverId(null)
            refresh()
          }}
        >
          <span className="widget-drag-handle" aria-hidden="true">
            &#8942;&#8942;
          </span>
          <label className="settings-label widget-settings-label">
            <input
              type="checkbox"
              checked={widget.enabled}
              onChange={(event) => {
                setWidgetEnabled(widget.id, event.target.checked)
                refresh()
              }}
            />
            {widget.title}
          </label>
          <div className="settings-choice">
            <button
              type="button"
              disabled={index === 0}
              aria-label={`Move ${widget.title} up`}
              onClick={() => {
                moveWidget(widget.id, 'up')
                refresh()
              }}
            >
              &uarr;
            </button>
            <button
              type="button"
              disabled={index === widgets.length - 1}
              aria-label={`Move ${widget.title} down`}
              onClick={() => {
                moveWidget(widget.id, 'down')
                refresh()
              }}
            >
              &darr;
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
