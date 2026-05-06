/**
 * Bulk Shift Popover
 *
 * Попover для массового сдвига загрузок отдела по проекту.
 * 4 режима: сдвиг целиком, только начало, только конец, задать даты.
 */

'use client'

import { useState, useMemo, useEffect } from 'react'
import { MoveHorizontal, Loader2, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { DateRangePicker } from '@/modules/modals/components/loading-modal-new/DateRangePicker'
import { useBulkShiftLoadings } from '../../hooks'
import type { BulkShiftMode } from '../../hooks'
import { useBulkShiftSelectionStore } from '../../stores'
import type { Department } from '../../types'

const SHIFT_MODE_LABELS: Record<BulkShiftMode, string> = {
  both: 'Сдвинуть целиком',
  start: 'Сдвинуть начало',
  end: 'Сдвинуть конец',
  set: 'Задать даты',
}

interface ProjectInfo {
  id: string
  name: string
  loadingsCount: number
}

interface BulkShiftPopoverProps {
  department: Department
}

function formatLocalDate(date: Date | null): string {
  if (!date) return ''
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function extractProjects(department: Department): ProjectInfo[] {
  const projectMap = new Map<string, { name: string; count: number }>()

  for (const team of department.teams) {
    for (const employee of team.employees) {
      for (const loading of employee.loadings ?? []) {
        if (!loading.projectId || !loading.projectName) continue

        const existing = projectMap.get(loading.projectId)
        if (existing) {
          existing.count++
        } else {
          projectMap.set(loading.projectId, {
            name: loading.projectName,
            count: 1,
          })
        }
      }
    }
  }

  return Array.from(projectMap.entries())
    .map(([id, { name, count }]) => ({
      id,
      name,
      loadingsCount: count,
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

/**
 * Возвращает все loading_id указанного проекта в данном отделе.
 * Используется для кнопки «Все» в режиме выборочного применения.
 */
function extractProjectLoadingIds(department: Department, projectId: string): string[] {
  const ids: string[] = []
  for (const team of department.teams) {
    for (const employee of team.employees) {
      for (const loading of employee.loadings ?? []) {
        if (loading.projectId === projectId) {
          ids.push(loading.id)
        }
      }
    }
  }
  return ids
}

export function BulkShiftPopover({ department }: BulkShiftPopoverProps) {
  const [open, setOpen] = useState(false)
  const [selectedProjectId, setSelectedProjectId] = useState<string>('')
  const [shiftMode, setShiftMode] = useState<BulkShiftMode>('both')
  const [shiftDays, setShiftDays] = useState<string>('')
  const [setStartDate, setSetStartDate] = useState<string>('')
  const [setEndDate, setSetEndDate] = useState<string>('')
  const [partialWarning, setPartialWarning] = useState<string | null>(null)

  const bulkShiftMutation = useBulkShiftLoadings()

  const projects = useMemo(() => extractProjects(department), [department])

  // Подписка на selection store через узкие селекторы — минимизируем re-renders
  const isSelectionActiveForThisDept = useBulkShiftSelectionStore(
    (s) => s.activeDepartmentId === department.id
  )
  const selectionStoreActiveProjectId = useBulkShiftSelectionStore((s) => s.activeProjectId)
  const selectedLoadingIds = useBulkShiftSelectionStore((s) => s.selectedLoadingIds)
  const enterSelection = useBulkShiftSelectionStore((s) => s.enter)
  const exitSelection = useBulkShiftSelectionStore((s) => s.exit)
  const changeSelectionProject = useBulkShiftSelectionStore((s) => s.changeProject)
  const selectAllSelection = useBulkShiftSelectionStore((s) => s.selectAll)
  const clearSelection = useBulkShiftSelectionStore((s) => s.clear)

  const isManualMode = isSelectionActiveForThisDept
  const selectedCount = isManualMode ? selectedLoadingIds.size : 0

  // Все loading_id выбранного проекта в отделе (для кнопки «Все»)
  const projectLoadingIds = useMemo(
    () => (selectedProjectId ? extractProjectLoadingIds(department, selectedProjectId) : []),
    [department, selectedProjectId]
  )

  // Cleanup: если этот отдел был в режиме выбора и компонент unmount'ится — сбросить режим
  // (например, отдел исчез из-за фильтра)
  useEffect(() => {
    return () => {
      // Берём актуальное значение через .getState() (а не из замыкания), чтобы избежать stale state
      const current = useBulkShiftSelectionStore.getState()
      if (current.activeDepartmentId === department.id) {
        current.exit()
      }
    }
  }, [department.id])

  const selectedProject = projects.find((p) => p.id === selectedProjectId)

  const dateRangeValue = useMemo(() => ({
    from: setStartDate ? new Date(setStartDate) : null,
    to: setEndDate ? new Date(setEndDate) : null,
  }), [setStartDate, setEndDate])

  const daysNum = parseInt(shiftDays, 10)
  const isSetMode = shiftMode === 'set'

  const isValid = selectedProjectId && (
    isSetMode
      ? setStartDate && setEndDate && setStartDate <= setEndDate
      : !isNaN(daysNum) && daysNum !== 0
  ) && (!isManualMode || selectedCount > 0)

  const resetForm = () => {
    setShiftDays('')
    setSelectedProjectId('')
    setShiftMode('both')
    setSetStartDate('')
    setSetEndDate('')
  }

  const handleShift = async () => {
    if (!isValid) return
    setPartialWarning(null)

    try {
      const result = await bulkShiftMutation.mutateAsync({
        departmentId: department.id,
        projectId: selectedProjectId,
        shiftDays: isSetMode ? 0 : daysNum,
        shiftMode,
        ...(isSetMode && { setStartDate, setEndDate }),
        ...(isManualMode && { loadingIds: Array.from(selectedLoadingIds) }),
      })

      if (result.skippedCount > 0 || result.shiftedCount < result.totalFound) {
        // Частичный успех — оставляем поп открытым с warning, но режим выбора сбрасываем
        const parts: string[] = []
        if (result.skippedCount > 0) {
          parts.push(`${result.skippedCount} пропущено (начало оказалось позже конца)`)
        }
        const failedCount = result.totalFound - result.shiftedCount - result.skippedCount
        if (failedCount > 0) {
          parts.push(`${failedCount} не удалось обновить`)
        }
        setPartialWarning(
          `Обновлено ${result.shiftedCount} из ${result.totalFound}. ${parts.join(', ')}.`
        )
        if (isManualMode) {
          exitSelection()
        }
      } else {
        // Полный успех
        if (isManualMode) {
          exitSelection()
        }
        resetForm()
        setOpen(false)
      }
    } catch {
      // mutateAsync выбрасывает ошибку, которую отображает bulkShiftMutation.isError ниже
    }
  }

  if (projects.length === 0) return null

  const directionLabel =
    !isSetMode && !isNaN(daysNum) && daysNum !== 0
      ? daysNum > 0
        ? `вперёд на ${daysNum} дн.`
        : `назад на ${Math.abs(daysNum)} дн.`
      : null

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <button
              type="button"
              className={cn(
                'p-1 rounded-sm transition-colors',
                'text-muted-foreground hover:text-foreground hover:bg-accent'
              )}
              onClick={(e) => e.stopPropagation()}
            >
              <MoveHorizontal className="h-3.5 w-3.5" />
            </button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent side="top">
          <p>Сдвинуть загрузки по проекту</p>
        </TooltipContent>
      </Tooltip>
      </TooltipProvider>

      <PopoverContent
        className="w-80"
        align="start"
        side="bottom"
        onClick={(e) => e.stopPropagation()}
        onEscapeKeyDown={() => {
          // ESC закрывает поп (default Radix), и одновременно сбрасывает режим выбора
          if (isSelectionActiveForThisDept) {
            exitSelection()
          }
        }}
        onInteractOutside={(e) => {
          // В режиме выбора: клик по selectable bar НЕ должен закрывать поп
          const target = e.target as HTMLElement | null
          if (isSelectionActiveForThisDept && target?.closest('[data-bulk-selectable="true"]')) {
            e.preventDefault()
          }
        }}
      >
        <div className="space-y-4">
          <div>
            <h4 className="font-medium text-sm">Массовое изменение загрузок</h4>
            <p className="text-xs text-muted-foreground mt-0.5">
              {department.name}
            </p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Проект</Label>
            <Select
              value={selectedProjectId}
              onValueChange={(newProjectId) => {
                setSelectedProjectId(newProjectId)
                // Если режим выбора активен — переключить scope на новый проект (сбрасывает выбор)
                if (isSelectionActiveForThisDept && newProjectId !== selectionStoreActiveProjectId) {
                  changeSelectionProject(newProjectId)
                }
              }}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Выберите проект" />
              </SelectTrigger>
              <SelectContent>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id} className="text-xs">
                    {project.name}
                    <span className="text-muted-foreground ml-1">
                      ({project.loadingsCount})
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Чекбокс «Выбрать вручную» */}
          <div className="flex items-start gap-2">
            <Checkbox
              id={`bulk-shift-manual-${department.id}`}
              checked={isManualMode}
              disabled={!selectedProjectId}
              onCheckedChange={(checked) => {
                if (checked && selectedProjectId) {
                  enterSelection(department.id, selectedProjectId)
                } else {
                  exitSelection()
                }
              }}
              className="mt-0.5"
            />
            <div className="flex-1 space-y-1.5">
              <Label
                htmlFor={`bulk-shift-manual-${department.id}`}
                className={cn(
                  'text-xs cursor-pointer leading-tight',
                  !selectedProjectId && 'text-muted-foreground cursor-not-allowed'
                )}
              >
                Выбрать вручную
                {!selectedProjectId && (
                  <span className="block text-[10px] text-muted-foreground mt-0.5">
                    Сначала выберите проект
                  </span>
                )}
              </Label>

              {isManualMode && selectedProject && (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] text-muted-foreground">
                    Выбрано: <span className="font-medium text-foreground tabular-nums">{selectedCount}</span>
                    {' из '}
                    <span className="tabular-nums">{selectedProject.loadingsCount}</span>
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => selectAllSelection(projectLoadingIds)}
                      className="text-[11px] text-primary hover:underline"
                    >
                      Все
                    </button>
                    <span className="text-[11px] text-muted-foreground">·</span>
                    <button
                      type="button"
                      onClick={() => clearSelection()}
                      className="text-[11px] text-muted-foreground hover:text-foreground hover:underline"
                    >
                      Сбросить
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Операция</Label>
            <Select value={shiftMode} onValueChange={(v) => setShiftMode(v as BulkShiftMode)}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.entries(SHIFT_MODE_LABELS) as [BulkShiftMode, string][]).map(([value, label]) => (
                  <SelectItem key={value} value={value} className="text-xs">
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isSetMode ? (
            <div className="space-y-1.5">
              <Label className="text-xs">Период загрузки</Label>
              <DateRangePicker
                value={dateRangeValue}
                onChange={(range) => {
                  setSetStartDate(formatLocalDate(range?.from ?? null))
                  setSetEndDate(formatLocalDate(range?.to ?? null))
                }}
                placeholder="дд.мм.гггг - дд.мм.гггг"
                hideSingleDateActions
                inputClassName="h-8 text-xs"
              />
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label className="text-xs">Сдвиг (дни)</Label>
              <Input
                type="number"
                value={shiftDays}
                onChange={(e) => setShiftDays(e.target.value)}
                placeholder="например: 7 или -14"
                className="h-8 text-xs"
              />
              <p className="text-[11px] text-muted-foreground">
                Положительное — вперёд, отрицательное — назад
              </p>
            </div>
          )}

          {selectedProject && (directionLabel || (isSetMode && setStartDate && setEndDate)) && (() => {
            const effectiveCount = isManualMode ? selectedCount : selectedProject.loadingsCount
            const effectiveWord = effectiveCount === 1 ? 'загрузка' : effectiveCount < 5 ? 'загрузки' : 'загрузок'
            return (
              <div className="rounded-md bg-muted px-3 py-2 text-xs">
                <span className="font-medium tabular-nums">{effectiveCount}</span>{' '}
                {effectiveWord}
                {isManualMode && (
                  <span className="text-muted-foreground"> (из {selectedProject.loadingsCount})</span>
                )}
                {isSetMode ? (
                  <> — даты будут заменены на{' '}
                    <span className="font-medium">{setStartDate} — {setEndDate}</span>
                  </>
                ) : (
                  <>
                    {' — '}
                    {SHIFT_MODE_LABELS[shiftMode].toLowerCase()}{' '}
                    <span className="font-medium">{directionLabel}</span>
                  </>
                )}
              </div>
            )
          })()}

          <Button
            size="sm"
            className="w-full h-8 text-xs"
            disabled={!isValid || bulkShiftMutation.isPending}
            onClick={handleShift}
          >
            {bulkShiftMutation.isPending ? (
              <>
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                {isSetMode ? 'Применяю...' : 'Сдвигаю...'}
              </>
            ) : (
              isSetMode ? 'Применить' : 'Сдвинуть'
            )}
          </Button>

          {partialWarning && (
            <div className="flex items-start gap-1.5 rounded-md bg-amber-50 dark:bg-amber-950/30 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
              <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
              <span>{partialWarning}</span>
            </div>
          )}

          {bulkShiftMutation.isError && (
            <p className="text-xs text-destructive">
              {bulkShiftMutation.error?.message || 'Ошибка при изменении загрузок'}
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
