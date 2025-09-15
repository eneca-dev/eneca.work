// Shared project status types and mappings (DB ↔ UI)

export const PROJECT_STATUS_OPTIONS = [
  'draft',
  'active',
  'paused',
  'completed',
  'waiting for input data',
  'author supervision',
  'actual calculation',
  'customer approval',
] as const

export type ProjectStatusDb = typeof PROJECT_STATUS_OPTIONS[number]

export const PROJECT_STATUS_LABEL: Record<ProjectStatusDb, string> = {
  draft: 'Draft',
  active: 'В работе',
  completed: 'Завершен',
  paused: 'Пауза',
  'waiting for input data': 'В ожидании ИД',
  'author supervision': 'Авторский надзор',
  'actual calculation': 'Фактический расчет',
  'customer approval': 'Согласование зак.',
}

// Text color for inline status display (e.g., cards)
export const PROJECT_STATUS_TEXT_COLOR: Record<ProjectStatusDb, string> = {
  draft: 'text-gray-600',
  active: 'text-primary',
  paused: 'text-yellow-600',
  completed: 'text-blue-600',
  'waiting for input data': 'text-orange-600',
  'author supervision': 'text-purple-600',
  'actual calculation': 'text-green-600',
  'customer approval': 'text-cyan-600',
}

// Badge classes for compact status chips (e.g., tree rows)
export const PROJECT_STATUS_BADGE_CLASSES: Record<ProjectStatusDb, string> = {
  draft:
    'bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-900/20 dark:text-gray-300 dark:border-gray-700',
  active:
    'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-700',
  paused:
    'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-700',
  completed:
    'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
  'waiting for input data':
    'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-700',
  'author supervision':
    'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/20 dark:text-purple-300 dark:border-purple-700',
  'actual calculation':
    'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/20 dark:text-orange-300 dark:border-orange-700',
  'customer approval':
    'bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-900/20 dark:text-cyan-300 dark:border-cyan-700',
}

export function getProjectStatusLabel(status?: string): string {
  const s = normalizeProjectStatus(status)
  return s ? PROJECT_STATUS_LABEL[s] : '—'
}

export function getProjectStatusTextColor(status?: string): string {
  const s = normalizeProjectStatus(status)
  return s ? PROJECT_STATUS_TEXT_COLOR[s] : 'text-gray-600'
}

export function getProjectStatusBadgeClasses(status?: string): string {
  const s = normalizeProjectStatus(status)
  return s
    ? PROJECT_STATUS_BADGE_CLASSES[s]
    : 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
}

export function normalizeProjectStatus(status?: string): ProjectStatusDb | undefined {
  if (!status) return undefined
  // Map legacy Russian values to new DB keys
  switch (status) {
    case 'В работе':
      return 'active'
    case 'Завершен':
      return 'completed'
    case 'Пауза':
      return 'paused'
    case 'В ожидании ИД':
      return 'waiting for input data'
    case 'Авторский надзор':
      return 'author supervision'
    case 'Фактический расчет':
      return 'actual calculation'
    case 'Согласование зак.':
      return 'customer approval'
    case 'Draft':
    case 'draft':
      return 'draft'
  }
  // If already an English DB value we support, return it as-is
  return PROJECT_STATUS_OPTIONS.includes(status as ProjectStatusDb) ? (status as ProjectStatusDb) : undefined
}
