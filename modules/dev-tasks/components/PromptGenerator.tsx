'use client'

import { memo, useMemo, useState } from 'react'
import { Copy, Check, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import type { AggregatedTask } from '../types'

interface PromptGeneratorProps {
  tasks: AggregatedTask[]
  selectedTaskIds: Set<string>
}

export const PromptGenerator = memo(function PromptGenerator({
  tasks,
  selectedTaskIds,
}: PromptGeneratorProps) {
  const [copied, setCopied] = useState(false)

  const selectedTasks = useMemo(() => {
    return tasks.filter((t) => selectedTaskIds.has(t.id))
  }, [tasks, selectedTaskIds])

  const prompt = useMemo(() => {
    if (selectedTasks.length === 0) return ''

    // Group by module
    const byModule = new Map<string, AggregatedTask[]>()
    for (const task of selectedTasks) {
      const existing = byModule.get(task.moduleName) || []
      existing.push(task)
      byModule.set(task.moduleName, existing)
    }

    const lines: string[] = []
    lines.push('## Задачи для выполнения\n')

    for (const [moduleName, moduleTasks] of byModule) {
      const displayName = moduleTasks[0]?.moduleDisplayName || moduleName
      lines.push(`### Модуль: ${displayName} (modules/${moduleName}/)\n`)

      for (const task of moduleTasks) {
        lines.push(`**${task.id}: ${task.title}**`)
        if (task.description) {
          lines.push(`${task.description}`)
        }
        lines.push(`- Категория: ${task.category}`)
        lines.push(`- Приоритет: ${task.priority}`)
        if (task.blockedBy && task.blockedBy.length > 0) {
          lines.push(`- Зависит от: ${task.blockedBy.join(', ')}`)
        }
        lines.push('')
      }
    }

    lines.push('---\n')
    lines.push('## Общие правила\n')
    lines.push('- Следуй пайплайну из `docs/main-pipeline.md` (Quick/Full в зависимости от масштаба)')
    lines.push('- Вызывай агентов после написания кода (см. CLAUDE.md для списка)')
    lines.push('- НЕ создавай новые файлы без необходимости — предпочитай редактирование существующих')
    lines.push('- НЕ добавляй over-engineering: только то что нужно для задачи')
    lines.push('')

    // Add multi-module warning if tasks span multiple modules
    if (byModule.size > 1) {
      lines.push('⚠️ **Задачи затрагивают несколько модулей!**')
      lines.push('При изменении кода в модуле — обновляй его `module.meta.json`:')
      lines.push('- Добавь в `changelog` если есть значимые изменения')
      lines.push('- Обнови `dependencies` если добавлены новые зависимости')
      lines.push('- Обнови `hooks`/`actions`/`components` если добавлены новые публичные API')
      lines.push('')
    }

    lines.push('## Инструкции по задачам\n')
    lines.push('1. **Перед началом работы:**')
    lines.push('   - Измени статус задачи на `in-progress` в `module.meta.json`')
    lines.push('')
    lines.push('2. **После выполнения:**')
    lines.push('   - Измени статус на `done`')
    lines.push('   - Добавь запись в `changelog` модуля')
    lines.push('   - Перенеси задачу в `tasks.archive.json`')
    lines.push('   - **Если задача затрагивает другие модули** — обнови их метаданные тоже')
    lines.push('')
    lines.push('3. **Проверка:**')
    lines.push('   - Запусти `npm run build` и убедись что нет ошибок')
    lines.push('')
    lines.push('## Какие агенты вызывать\n')
    lines.push('| Что написано | Агенты |')
    lines.push('|--------------|--------|')
    lines.push('| Server Action | Cache Guardian, Security Guardian |')
    lines.push('| Компонент > 50 строк | Clean Code Guardian, Next.js Guardian |')
    lines.push('| Форма | Forms Guardian |')
    lines.push('| Store | Zustand Guardian |')
    lines.push('| Миграция | DB Architect |')
    lines.push('| Модалка | Modal Architect |')

    return lines.join('\n')
  }, [selectedTasks])

  const handleCopy = async () => {
    if (!prompt) return
    await navigator.clipboard.writeText(prompt)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (selectedTasks.length === 0) {
    return (
      <div className="rounded-lg border border-dashed bg-muted/30 p-6 text-center">
        <Sparkles className="mx-auto mb-2 h-8 w-8 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground">
          Выберите задачи для генерации промпта
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">
          Промпт для {selectedTasks.length} задач
        </h3>
        <Button
          size="sm"
          variant={copied ? 'default' : 'outline'}
          onClick={handleCopy}
          className="gap-2"
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
      </div>

      <Textarea
        value={prompt}
        readOnly
        className="h-64 resize-none font-mono text-xs"
      />

      <p className="text-xs text-muted-foreground">
        Скопируйте промпт и вставьте в новый чат Claude Code
      </p>
    </div>
  )
})
