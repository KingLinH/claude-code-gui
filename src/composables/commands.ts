import type { Component } from 'vue'
import {
  BookOutline,
  ChatbubblesOutline,
  CubeOutline,
  DocumentTextOutline,
  ExtensionPuzzleOutline,
  FolderOpenOutline,
  GridOutline,
  SearchOutline,
  SettingsOutline,
} from '@vicons/ionicons5'

/** A navigable sidebar route, shared so the palette mirrors the sidebar. */
export interface NavRoute {
  to: string
  /** i18n key suffix under `nav.*` (e.g. 'dashboard' → nav.dashboard). */
  label: string
  icon: Component
}

export const NAV_ROUTES: NavRoute[] = [
  { to: '/', label: 'dashboard', icon: GridOutline },
  { to: '/search', label: 'search', icon: SearchOutline },
  { to: '/projects', label: 'projects', icon: FolderOpenOutline },
  { to: '/sessions', label: 'sessions', icon: ChatbubblesOutline },
  { to: '/mcp', label: 'mcp', icon: CubeOutline },
  { to: '/skills', label: 'skills', icon: ExtensionPuzzleOutline },
  { to: '/memory', label: 'memory', icon: BookOutline },
  { to: '/plans', label: 'plans', icon: DocumentTextOutline },
  { to: '/settings', label: 'settings', icon: SettingsOutline },
]

export type CommandSection = 'navigate' | 'actions'

export interface Command {
  id: string
  title: string
  section: CommandSection
  icon?: Component
  run: () => void
}
