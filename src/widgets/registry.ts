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
