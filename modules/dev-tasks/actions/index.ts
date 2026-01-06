'use server'

import {
  aggregateAllTasks,
  calculateTaskStats,
  sortTasks,
  getAllModuleMeta,
} from '../utils/parse-modules'
import type { AggregatedTask, TaskStats, ModuleMetaFile } from '../types'

export interface GetTasksResult {
  success: boolean
  tasks: AggregatedTask[]
  stats: TaskStats
  error?: string
}

export interface GetModulesResult {
  success: boolean
  modules: Array<{
    name: string
    displayName: string
    description: string
    status: string
    route: string | null
    taskCount: number
  }>
  error?: string
}

/**
 * Get all tasks from all modules
 */
export async function getAllTasks(): Promise<GetTasksResult> {
  try {
    const tasks = aggregateAllTasks()
    const sortedTasks = sortTasks(tasks)
    const stats = calculateTaskStats(tasks)

    return {
      success: true,
      tasks: sortedTasks,
      stats,
    }
  } catch (error) {
    return {
      success: false,
      tasks: [],
      stats: {
        total: 0,
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
      },
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Get all modules with meta files
 */
export async function getModulesOverview(): Promise<GetModulesResult> {
  try {
    const modules = getAllModuleMeta()
    const result: GetModulesResult['modules'] = []

    for (const [, meta] of modules) {
      result.push({
        name: meta.meta.name,
        displayName: meta.meta.displayName,
        description: meta.meta.description,
        status: meta.meta.status,
        route: meta.meta.route || null,
        taskCount: meta.tasks.length,
      })
    }

    // Sort by task count descending
    result.sort((a, b) => b.taskCount - a.taskCount)

    return {
      success: true,
      modules: result,
    }
  } catch (error) {
    return {
      success: false,
      modules: [],
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Get full module meta by name
 */
export async function getModuleMeta(
  moduleName: string
): Promise<{ success: boolean; meta: ModuleMetaFile | null; error?: string }> {
  try {
    const modules = getAllModuleMeta()
    const meta = modules.get(moduleName) || null

    return {
      success: true,
      meta,
    }
  } catch (error) {
    return {
      success: false,
      meta: null,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

export interface ChangelogEntry {
  moduleName: string
  moduleDisplayName: string
  version: string
  date: string
  changes: string[]
}

export interface GetChangelogResult {
  success: boolean
  entries: ChangelogEntry[]
  error?: string
}

/**
 * Get aggregated changelog from all modules
 */
export async function getChangelog(): Promise<GetChangelogResult> {
  try {
    const modules = getAllModuleMeta()
    const entries: ChangelogEntry[] = []

    for (const [name, meta] of modules) {
      if (meta.changelog && meta.changelog.length > 0) {
        for (const entry of meta.changelog) {
          entries.push({
            moduleName: name,
            moduleDisplayName: meta.meta.displayName,
            version: entry.version,
            date: entry.date,
            changes: entry.changes,
          })
        }
      }
    }

    // Sort by date descending
    entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

    return {
      success: true,
      entries,
    }
  } catch (error) {
    return {
      success: false,
      entries: [],
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
