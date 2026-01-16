import type { AggregatedTask } from '../types'

const MAX_PARALLEL_AGENTS = 3

export interface TaskWave {
  waveNumber: number
  tasks: AggregatedTask[]
  reason: string
}

export interface ParallelExecutionPlan {
  waves: TaskWave[]
  conflicts: TaskConflict[]
  blockedTasks: BlockedTask[]
  totalEstimatedHours: number
}

export interface TaskConflict {
  taskA: string
  taskB: string
  conflictingPatterns: string[]
}

export interface BlockedTask {
  taskId: string
  blockedBy: string[]
  reason: string
}

/**
 * Check if two glob patterns can potentially overlap
 * Simple heuristic: check if directory prefixes overlap
 */
function patternsOverlap(patternA: string, patternB: string): boolean {
  // Extract base directory (before any glob wildcards)
  const getBaseDir = (pattern: string): string => {
    const parts = pattern.split('/')
    const baseParts: string[] = []
    for (const part of parts) {
      if (part.includes('*')) break
      baseParts.push(part)
    }
    return baseParts.join('/')
  }

  const dirA = getBaseDir(patternA)
  const dirB = getBaseDir(patternB)

  // If one is empty (root level), they might overlap
  if (!dirA || !dirB) return true

  // Same directory or one contains another
  if (dirA.startsWith(dirB) || dirB.startsWith(dirA)) {
    return true
  }

  // Exact same file
  if (patternA === patternB) return true

  return false
}

/**
 * Find conflicting file patterns between two tasks
 */
function findConflictingPatterns(
  filesA: string[],
  filesB: string[]
): string[] {
  const conflicts: string[] = []

  for (const patternA of filesA) {
    for (const patternB of filesB) {
      if (patternsOverlap(patternA, patternB)) {
        conflicts.push(`${patternA} ↔ ${patternB}`)
      }
    }
  }

  return conflicts
}

/**
 * Build a dependency graph from tasks
 */
function buildDependencyGraph(tasks: AggregatedTask[]): Map<string, Set<string>> {
  const graph = new Map<string, Set<string>>()

  for (const task of tasks) {
    graph.set(task.id, new Set(task.blockedBy || []))
  }

  return graph
}

/**
 * Check if a task has all dependencies resolved
 */
function canExecute(
  taskId: string,
  completedTasks: Set<string>,
  dependencyGraph: Map<string, Set<string>>
): boolean {
  const dependencies = dependencyGraph.get(taskId) || new Set()
  for (const dep of dependencies) {
    if (!completedTasks.has(dep)) {
      return false
    }
  }
  return true
}

/**
 * Create parallel execution plan from selected tasks
 */
export function createParallelExecutionPlan(
  tasks: AggregatedTask[]
): ParallelExecutionPlan {
  const waves: TaskWave[] = []
  const conflicts: TaskConflict[] = []
  const blockedTasks: BlockedTask[] = []

  // Build dependency graph
  const dependencyGraph = buildDependencyGraph(tasks)

  // Track completed and scheduled tasks
  const completedTasks = new Set<string>()
  const scheduledTasks = new Set<string>()
  const remainingTasks = new Set(tasks.map((t) => t.id))

  // Find all conflicts upfront
  for (let i = 0; i < tasks.length; i++) {
    for (let j = i + 1; j < tasks.length; j++) {
      const taskA = tasks[i]
      const taskB = tasks[j]

      const filesA = taskA.affectedFiles || []
      const filesB = taskB.affectedFiles || []

      if (filesA.length > 0 && filesB.length > 0) {
        const conflictingPatterns = findConflictingPatterns(filesA, filesB)
        if (conflictingPatterns.length > 0) {
          conflicts.push({
            taskA: taskA.id,
            taskB: taskB.id,
            conflictingPatterns,
          })
        }
      }
    }
  }

  // Create conflict map for quick lookup
  const conflictMap = new Map<string, Set<string>>()
  for (const conflict of conflicts) {
    if (!conflictMap.has(conflict.taskA)) {
      conflictMap.set(conflict.taskA, new Set())
    }
    if (!conflictMap.has(conflict.taskB)) {
      conflictMap.set(conflict.taskB, new Set())
    }
    conflictMap.get(conflict.taskA)!.add(conflict.taskB)
    conflictMap.get(conflict.taskB)!.add(conflict.taskA)
  }

  let waveNumber = 1

  // Process tasks into waves
  while (remainingTasks.size > 0) {
    const waveTaskIds: string[] = []
    const waveTasksSet = new Set<string>()

    // Find eligible tasks for this wave
    for (const taskId of remainingTasks) {
      // Check if dependencies are resolved
      if (!canExecute(taskId, completedTasks, dependencyGraph)) {
        continue
      }

      // Check if conflicts with already scheduled tasks in this wave
      const taskConflicts = conflictMap.get(taskId) || new Set()
      let hasConflictInWave = false
      for (const waveTaskId of waveTasksSet) {
        if (taskConflicts.has(waveTaskId)) {
          hasConflictInWave = true
          break
        }
      }

      if (hasConflictInWave) {
        continue
      }

      // Check max parallel limit
      if (waveTaskIds.length >= MAX_PARALLEL_AGENTS) {
        break
      }

      waveTaskIds.push(taskId)
      waveTasksSet.add(taskId)
    }

    // If no tasks can be scheduled, we have a deadlock
    if (waveTaskIds.length === 0 && remainingTasks.size > 0) {
      // Find what's blocking
      for (const taskId of remainingTasks) {
        const deps = dependencyGraph.get(taskId) || new Set()
        const unresolvedDeps = [...deps].filter((d) => !completedTasks.has(d))

        if (unresolvedDeps.length > 0) {
          blockedTasks.push({
            taskId,
            blockedBy: unresolvedDeps,
            reason: `Blocked by unresolved dependencies: ${unresolvedDeps.join(', ')}`,
          })
        } else {
          // Must be conflict-blocked
          const taskConflicts = conflictMap.get(taskId) || new Set()
          const activeConflicts = [...taskConflicts].filter((c) =>
            remainingTasks.has(c)
          )
          if (activeConflicts.length > 0) {
            blockedTasks.push({
              taskId,
              blockedBy: activeConflicts,
              reason: `File conflicts with: ${activeConflicts.join(', ')}`,
            })
          }
        }
      }
      break
    }

    // Create wave
    const waveTasks = tasks.filter((t) => waveTaskIds.includes(t.id))
    const reasons: string[] = []

    if (waveNumber === 1) {
      reasons.push('No dependencies')
    } else {
      reasons.push(`Dependencies from wave ${waveNumber - 1} resolved`)
    }

    if (waveTasks.length < MAX_PARALLEL_AGENTS && remainingTasks.size > waveTasks.length) {
      reasons.push('Limited by file conflicts')
    }

    waves.push({
      waveNumber,
      tasks: waveTasks,
      reason: reasons.join(', '),
    })

    // Mark as completed and remove from remaining
    for (const taskId of waveTaskIds) {
      completedTasks.add(taskId)
      scheduledTasks.add(taskId)
      remainingTasks.delete(taskId)
    }

    waveNumber++
  }

  // Calculate total estimated hours (sequential worst case)
  const totalEstimatedHours = tasks.reduce(
    (sum, t) => sum + (t.estimatedHours || 1),
    0
  )

  return {
    waves,
    conflicts,
    blockedTasks,
    totalEstimatedHours,
  }
}

/**
 * Format execution plan for display
 */
export function formatExecutionPlan(plan: ParallelExecutionPlan): string {
  const lines: string[] = []

  lines.push('## Parallel Execution Plan\n')

  if (plan.conflicts.length > 0) {
    lines.push('### File Conflicts Detected\n')
    for (const conflict of plan.conflicts) {
      lines.push(`- **${conflict.taskA}** ↔ **${conflict.taskB}**`)
      for (const pattern of conflict.conflictingPatterns) {
        lines.push(`  - ${pattern}`)
      }
    }
    lines.push('')
  }

  lines.push('### Execution Waves\n')
  for (const wave of plan.waves) {
    lines.push(`**Wave ${wave.waveNumber}** (${wave.tasks.length} tasks, parallel)`)
    lines.push(`_${wave.reason}_\n`)
    for (const task of wave.tasks) {
      const hours = task.estimatedHours ? ` (~${task.estimatedHours}h)` : ''
      lines.push(`- ${task.id}: ${task.title}${hours}`)
      if (task.affectedFiles && task.affectedFiles.length > 0) {
        lines.push(`  Files: ${task.affectedFiles.join(', ')}`)
      }
    }
    lines.push('')
  }

  if (plan.blockedTasks.length > 0) {
    lines.push('### Blocked Tasks\n')
    for (const blocked of plan.blockedTasks) {
      lines.push(`- **${blocked.taskId}**: ${blocked.reason}`)
    }
    lines.push('')
  }

  lines.push(`### Summary\n`)
  lines.push(`- Total waves: ${plan.waves.length}`)
  lines.push(`- Total tasks: ${plan.waves.reduce((sum, w) => sum + w.tasks.length, 0)}`)
  lines.push(`- Blocked tasks: ${plan.blockedTasks.length}`)
  lines.push(`- Estimated time (sequential): ${plan.totalEstimatedHours}h`)

  const parallelTime = plan.waves.reduce((sum, wave) => {
    const maxInWave = Math.max(...wave.tasks.map((t) => t.estimatedHours || 1))
    return sum + maxInWave
  }, 0)
  lines.push(`- Estimated time (parallel): ${parallelTime}h`)

  return lines.join('\n')
}

/**
 * Generate prompts for Task agents
 */
export function generateAgentPrompts(
  wave: TaskWave
): Array<{ taskId: string; modulePath: string; prompt: string }> {
  return wave.tasks.map((task) => ({
    taskId: task.id,
    modulePath: `modules/${task.moduleName}`,
    prompt: `Execute task ${task.id} from modules/${task.moduleName}/module.meta.json

Task: ${task.title}
${task.description ? `Description: ${task.description}` : ''}
Category: ${task.category}
Priority: ${task.priority}

Affected files (YOUR BOUNDARIES):
${(task.affectedFiles || []).map((f) => `- ${f}`).join('\n') || '- Not specified (be careful)'}

Instructions:
1. Read module.meta.json for context (patterns, antipatterns)
2. ONLY edit files within affectedFiles boundaries
3. Follow module patterns, avoid antipatterns
4. Update task status to "done" when complete
5. Add changelog entry`,
  }))
}
