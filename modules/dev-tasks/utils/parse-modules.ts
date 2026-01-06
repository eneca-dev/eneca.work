import fs from 'fs'
import path from 'path'
import type {
  ModuleMetaFile,
  AggregatedTask,
  TaskStats,
  TaskStatus,
  TaskCategory,
  TaskPriority,
} from '../types'

const MODULES_DIR = path.join(process.cwd(), 'modules')

/**
 * Get all module directories that have module.meta.json
 */
export function getModulesWithMeta(): string[] {
  try {
    const entries = fs.readdirSync(MODULES_DIR, { withFileTypes: true })
    return entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .filter((name) => {
        const metaPath = path.join(MODULES_DIR, name, 'module.meta.json')
        return fs.existsSync(metaPath)
      })
  } catch {
    return []
  }
}

/**
 * Parse a single module.meta.json file
 */
export function parseModuleMeta(moduleName: string): ModuleMetaFile | null {
  try {
    const metaPath = path.join(MODULES_DIR, moduleName, 'module.meta.json')
    const content = fs.readFileSync(metaPath, 'utf-8')
    return JSON.parse(content) as ModuleMetaFile
  } catch {
    return null
  }
}

/**
 * Get all module meta files
 */
export function getAllModuleMeta(): Map<string, ModuleMetaFile> {
  const modules = getModulesWithMeta()
  const result = new Map<string, ModuleMetaFile>()

  for (const moduleName of modules) {
    const meta = parseModuleMeta(moduleName)
    if (meta) {
      result.set(moduleName, meta)
    }
  }

  return result
}

/**
 * Aggregate all tasks from all modules
 */
export function aggregateAllTasks(): AggregatedTask[] {
  const modules = getAllModuleMeta()
  const tasks: AggregatedTask[] = []

  for (const [, meta] of modules) {
    for (const task of meta.tasks) {
      tasks.push({
        ...task,
        moduleName: meta.meta.name,
        moduleDisplayName: meta.meta.displayName,
        moduleRoute: meta.meta.route,
      })
    }
  }

  return tasks
}

/**
 * Calculate task statistics
 */
export function calculateTaskStats(tasks: AggregatedTask[]): TaskStats {
  const stats: TaskStats = {
    total: tasks.length,
    byStatus: {
      backlog: 0,
      todo: 0,
      'in-progress': 0,
      review: 0,
      done: 0,
      blocked: 0,
      cancelled: 0,
    },
    byCategory: {
      feature: 0,
      bug: 0,
      refactor: 0,
      performance: 0,
      security: 0,
      docs: 0,
      'tech-debt': 0,
      migration: 0,
    },
    byPriority: {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
    },
    byModule: {},
  }

  for (const task of tasks) {
    stats.byStatus[task.status]++
    stats.byCategory[task.category]++
    stats.byPriority[task.priority]++
    stats.byModule[task.moduleName] = (stats.byModule[task.moduleName] || 0) + 1
  }

  return stats
}

/**
 * Sort tasks by priority (critical first) then by status
 */
export function sortTasks(tasks: AggregatedTask[]): AggregatedTask[] {
  const priorityOrder: Record<TaskPriority, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
  }

  const statusOrder: Record<TaskStatus, number> = {
    'in-progress': 0,
    blocked: 1,
    review: 2,
    todo: 3,
    backlog: 4,
    done: 5,
    cancelled: 6,
  }

  return [...tasks].sort((a, b) => {
    // First by status (in-progress first)
    const statusDiff = statusOrder[a.status] - statusOrder[b.status]
    if (statusDiff !== 0) return statusDiff

    // Then by priority
    return priorityOrder[a.priority] - priorityOrder[b.priority]
  })
}

/**
 * Group tasks by a field
 */
export function groupTasks<K extends keyof AggregatedTask>(
  tasks: AggregatedTask[],
  key: K
): Map<AggregatedTask[K], AggregatedTask[]> {
  const groups = new Map<AggregatedTask[K], AggregatedTask[]>()

  for (const task of tasks) {
    const value = task[key]
    const existing = groups.get(value) || []
    existing.push(task)
    groups.set(value, existing)
  }

  return groups
}
