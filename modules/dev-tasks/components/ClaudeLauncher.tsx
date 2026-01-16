'use client'

import { memo, useState, useMemo } from 'react'
import { Terminal, Copy, Check, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { AggregatedTask } from '../types'

interface ClaudeLauncherProps {
  tasks: AggregatedTask[]
  selectedTaskIds: Set<string>
}

export const ClaudeLauncher = memo(function ClaudeLauncher({
  tasks,
  selectedTaskIds,
}: ClaudeLauncherProps) {
  const [copied, setCopied] = useState(false)

  const selectedTasks = useMemo(() => {
    return tasks.filter((t) => selectedTaskIds.has(t.id))
  }, [tasks, selectedTaskIds])

  // Group tasks by module
  const tasksByModule = useMemo(() => {
    const map = new Map<string, AggregatedTask[]>()
    for (const task of selectedTasks) {
      const existing = map.get(task.moduleName) || []
      existing.push(task)
      map.set(task.moduleName, existing)
    }
    return map
  }, [selectedTasks])

  // Check if tasks can run in parallel (no file conflicts)
  const canRunParallel = useMemo(() => {
    if (selectedTasks.length <= 1) return false

    // Check for file conflicts
    for (let i = 0; i < selectedTasks.length; i++) {
      for (let j = i + 1; j < selectedTasks.length; j++) {
        const filesA = selectedTasks[i].affectedFiles || []
        const filesB = selectedTasks[j].affectedFiles || []

        // Simple overlap check: same directory prefix
        for (const a of filesA) {
          for (const b of filesB) {
            const dirA = a.split('/').slice(0, 3).join('/')
            const dirB = b.split('/').slice(0, 3).join('/')
            if (dirA === dirB) {
              return false // Potential conflict
            }
          }
        }
      }
    }
    return true
  }, [selectedTasks])

  // Generate CLI command
  const generateCommand = (parallel: boolean) => {
    if (selectedTasks.length === 0) return ''

    const taskIds = selectedTasks.map((t) => t.id).join(', ')

    if (parallel && canRunParallel) {
      return `claude "Выполни задачи ${taskIds} параллельно через агентов. Каждой задаче свой агент."`
    }

    if (selectedTasks.length === 1) {
      const task = selectedTasks[0]
      return `claude "Выполни задачу ${task.id} из модуля ${task.moduleName}"`
    }

    return `claude "Выполни последовательно задачи: ${taskIds}"`
  }

  const handleCopy = async (parallel: boolean = false) => {
    const command = generateCommand(parallel)
    if (!command) return

    await navigator.clipboard.writeText(command)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (selectedTasks.length === 0) {
    return null
  }

  return (
    <div className="space-y-3 border-t pt-3">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Terminal className="h-4 w-4" />
        <span>Запуск в Claude Code</span>
      </div>

      {/* Quick info */}
      <div className="text-xs text-muted-foreground">
        {selectedTasks.length} задач
        {tasksByModule.size > 1 && ` из ${tasksByModule.size} модулей`}
        {canRunParallel && selectedTasks.length > 1 && (
          <span className="ml-1 text-emerald-500">(можно параллельно)</span>
        )}
        {!canRunParallel && selectedTasks.length > 1 && (
          <span className="ml-1 text-amber-500">(есть конфликты файлов)</span>
        )}
      </div>

      {/* Command preview */}
      <div className="rounded bg-muted/50 p-2 font-mono text-xs">
        {generateCommand(canRunParallel)}
      </div>

      {/* Action buttons */}
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => handleCopy(false)}
          className="flex-1 gap-2"
          title="Скопировать команду в буфер обмена"
        >
          {copied ? (
            <>
              <Check className="h-4 w-4" />
              Скопировано
            </>
          ) : (
            <>
              <Copy className="h-4 w-4" />
              Копировать
            </>
          )}
        </Button>

        {canRunParallel && selectedTasks.length > 1 && (
          <Button
            size="sm"
            variant="default"
            onClick={() => handleCopy(true)}
            className="gap-2"
            title="Скопировать команду для параллельного выполнения"
          >
            <Zap className="h-4 w-4" />
            Parallel
          </Button>
        )}
      </div>

      {/* Instructions */}
      <p className="text-xs text-muted-foreground">
        Откройте терминал в папке проекта и вставьте команду
      </p>
    </div>
  )
})
