import { useState } from 'react'
import { getOrderedWidgets, moveWidget, setWidgetEnabled } from '../widgets/registry'

export function WidgetSettings() {
  const [, forceRender] = useState(0)
  const widgets = getOrderedWidgets()

  function refresh() {
    forceRender((n) => n + 1)
  }

  return (
    <div className="widget-settings">
      {widgets.map((widget, index) => (
        <div className="settings-row" key={widget.id}>
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
