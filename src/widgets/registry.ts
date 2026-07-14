import type { ComponentType } from 'react'

export interface WidgetDefinition {
  id: string
  title: string
  Component: ComponentType
  defaultEnabled: boolean
}

const registry: WidgetDefinition[] = []

export function registerWidget(widget: WidgetDefinition) {
  if (registry.some((w) => w.id === widget.id)) {
    throw new Error(`Widget "${widget.id}" is already registered`)
  }
  registry.push(widget)
}

export function listWidgets(): WidgetDefinition[] {
  return registry
}

const PREFS_KEY = 'atlas-widget-prefs'

interface WidgetPrefs {
  enabled: Record<string, boolean>
  order: string[]
}

function loadPrefs(): WidgetPrefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY)
    if (raw) return JSON.parse(raw) as WidgetPrefs
  } catch {
    // Corrupt/old data — fall through to defaults.
  }
  return { enabled: {}, order: [] }
}

function savePrefs(prefs: WidgetPrefs) {
  localStorage.setItem(PREFS_KEY, JSON.stringify(prefs))
}

// Order + enabled state for every currently-registered widget, filling in
// defaults for widgets added since the user last customized their layout.
export function getOrderedWidgets(): Array<WidgetDefinition & { enabled: boolean }> {
  const prefs = loadPrefs()
  const known = new Set(prefs.order)
  const order = [...prefs.order, ...registry.filter((w) => !known.has(w.id)).map((w) => w.id)]

  return order
    .map((id) => registry.find((w) => w.id === id))
    .filter((w): w is WidgetDefinition => w != null)
    .map((widget) => ({ ...widget, enabled: prefs.enabled[widget.id] ?? widget.defaultEnabled }))
}

export function setWidgetEnabled(id: string, enabled: boolean) {
  const prefs = loadPrefs()
  prefs.enabled[id] = enabled
  if (!prefs.order.includes(id)) prefs.order.push(id)
  savePrefs(prefs)
}

export function moveWidget(id: string, direction: 'up' | 'down') {
  const ordered = getOrderedWidgets().map((w) => w.id)
  const index = ordered.indexOf(id)
  const swapWith = direction === 'up' ? index - 1 : index + 1
  if (index < 0 || swapWith < 0 || swapWith >= ordered.length) return
  ;[ordered[index], ordered[swapWith]] = [ordered[swapWith], ordered[index]]
  const prefs = loadPrefs()
  prefs.order = ordered
  savePrefs(prefs)
}

// Drops `id` into the position `targetId` currently occupies (used by
// pointer/touch drag-reorder in WidgetSettings — the up/down buttons above
// stay as the keyboard/screen-reader-accessible equivalent, per AT decision
// 212: drag-reorder is additive, not a replacement for the button controls).
export function reorderWidget(id: string, targetId: string) {
  if (id === targetId) return
  const ordered = getOrderedWidgets().map((w) => w.id)
  const from = ordered.indexOf(id)
  const to = ordered.indexOf(targetId)
  if (from < 0 || to < 0) return
  ordered.splice(from, 1)
  ordered.splice(to, 0, id)
  const prefs = loadPrefs()
  prefs.order = ordered
  savePrefs(prefs)
}
