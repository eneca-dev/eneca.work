/**
 * CreateDeptLoadingModal — модалка создания загрузки (прототип)
 *
 * Только именные загрузки (безличные убраны).
 * Дерево: Проект → Объект/Раздел (leaf).
 * Этап — дропдаун.
 */

'use client'

import { useState, useMemo, useEffect, type ReactNode } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  FolderKanban,
  Box,
  ChevronDown,
  ChevronRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { MOCK_DEPARTMENTS, MOCK_EMPLOYEES } from '../../mock/data'

// ============================================================================
// Types
// ============================================================================

interface BreadcrumbItem {
  name: string
  icon: typeof FolderKanban
  iconColor: string
}

// ============================================================================
// Constants
// ============================================================================

const QUICK_RATES = [0.2, 0.25, 0.5, 0.75, 1.0]

const STAGE_OPTIONS = [
  'Концепция',
  'Моделирование',
  'Расчёты',
  'Проектирование',
  'Чертежи',
] as const

// ============================================================================
// TreeNode (sub-component)
// ============================================================================

function TreeNode({
  icon: Icon,
  iconClassName,
  label,
  isExpanded,
  isExpandable = true,
  isSelected = false,
  onToggle,
  onSelect,
  depth = 0,
  children,
}: {
  icon: typeof Building2
  iconClassName: string
  label: string
  isExpanded?: boolean
  isExpandable?: boolean
  isSelected?: boolean
  onToggle?: () => void
  onSelect?: () => void
  depth?: number
  children?: ReactNode
}) {
  return (
    <div>
      <button
        type="button"
        className={cn(
          'flex items-center gap-1.5 w-full py-1.5 px-2 rounded-md text-sm text-left transition-colors',
          isSelected
            ? 'bg-primary/10 text-primary font-medium'
            : 'hover:bg-muted/50 text-foreground'
        )}
        style={{ paddingLeft: depth * 16 + 8 }}
        onClick={isExpandable ? onToggle : onSelect}
      >
        {isExpandable ? (
          isExpanded ? (
            <ChevronDown className="h-3 w-3 text-muted-foreground flex-shrink-0" />
          ) : (
            <ChevronRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
          )
        ) : (
          <div className="w-3 flex-shrink-0" />
        )}
        <Icon className={cn('h-3.5 w-3.5 flex-shrink-0', iconClassName)} />
        <span className="truncate">{label}</span>
      </button>
      {isExpandable && isExpanded && children}
    </div>
  )
}

// ============================================================================
// Main Component
// ============================================================================

interface CreateDeptLoadingModalProps {
  open: boolean
  onClose: () => void
  /** Pre-select object/section when opening from a row */
  initialSectionId?: string | null
}

export function CreateDeptLoadingModal({ open, onClose, initialSectionId }: CreateDeptLoadingModalProps) {
  // --- Form state ---
  const [selectedOsId, setSelectedOsId] = useState<string | null>(null)
  const [employeeId, setEmployeeId] = useState<string>('')
  const [stageName, setStageName] = useState('')
  const [rate, setRate] = useState(1)
  const [customRate, setCustomRate] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [comment, setComment] = useState('')

  // --- Tree state ---
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set())

  const toggleNode = (id: string) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // --- Flatten all projects from all departments ---
  const allProjects = useMemo(() => {
    return MOCK_DEPARTMENTS.flatMap((dept) => dept.projects)
  }, [])

  // --- Auto-select when opened from timeline row ---
  useEffect(() => {
    if (!open || !initialSectionId) return

    for (const proj of allProjects) {
      for (const os of proj.objectSections) {
        if (os.id === initialSectionId) {
          setSelectedOsId(initialSectionId)
          setExpandedNodes(new Set([proj.id]))
          return
        }
      }
    }
  }, [open, initialSectionId, allProjects])

  // --- Derived data ---

  const { selectedOs, breadcrumbs } = useMemo(() => {
    if (!selectedOsId) return { selectedOs: null, breadcrumbs: [] }

    for (const proj of allProjects) {
      for (const os of proj.objectSections) {
        if (os.id === selectedOsId) {
          return {
            selectedOs: os,
            breadcrumbs: [
              { name: proj.name, icon: FolderKanban, iconColor: 'text-amber-500' },
              { name: `${os.objectName} / ${os.sectionName}`, icon: Box, iconColor: 'text-cyan-500' },
            ] as BreadcrumbItem[],
          }
        }
      }
    }
    return { selectedOs: null, breadcrumbs: [] }
  }, [selectedOsId, allProjects])

  // --- Handlers ---

  const handleQuickRate = (r: number) => {
    setRate(r)
    setCustomRate('')
  }

  const handleCustomRate = (value: string) => {
    const processed = value.replace(',', '.')
    if (processed === '') {
      setCustomRate('')
      return
    }
    if (!/^\d/.test(processed)) return
    if (!/^\d(\.\d{0,2})?$/.test(processed)) return
    setCustomRate(processed)
    const parsed = parseFloat(processed)
    if (!isNaN(parsed)) setRate(parsed)
  }

  const resetForm = () => {
    setSelectedOsId(null)
    setEmployeeId('')
    setStageName('')
    setRate(1)
    setCustomRate('')
    setStartDate('')
    setEndDate('')
    setComment('')
    setExpandedNodes(new Set())
  }

  const handleClose = () => {
    resetForm()
    onClose()
  }

  const handleCreate = () => {
    console.log('[Prototype] Create loading:', {
      objectSectionId: selectedOsId,
      employeeId,
      stageName: stageName || undefined,
      rate,
      startDate,
      endDate,
      comment: comment || undefined,
    })
    handleClose()
  }

  // --- Validation ---

  const isValid = useMemo(() => {
    if (!selectedOsId) return false
    if (!employeeId) return false
    if (!startDate || !endDate) return false
    if (rate < 0.01 || rate > 2.0) return false
    return true
  }, [selectedOsId, employeeId, startDate, endDate, rate])

  const isQuickRateSelected = (r: number) => Math.abs(rate - r) < 0.001 && !customRate

  // =========================================================================
  // Render
  // =========================================================================

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="max-w-5xl h-[80vh] flex flex-col p-0">
        <DialogHeader className="px-6 py-4 border-b">
          <DialogTitle>Создание загрузки</DialogTitle>
        </DialogHeader>

        <div className="flex-1 flex overflow-hidden">
          {/* ===================== LEFT PANEL — Tree ===================== */}
          <div className="w-[340px] border-r flex flex-col overflow-hidden bg-card">
            <div className="flex-1 overflow-y-auto p-2">
              {allProjects.map((proj) => (
                <TreeNode
                  key={proj.id}
                  icon={FolderKanban}
                  iconClassName="text-amber-500"
                  label={proj.name}
                  isExpanded={expandedNodes.has(proj.id)}
                  onToggle={() => toggleNode(proj.id)}
                  depth={0}
                >
                  {proj.objectSections.map((os) => (
                    <TreeNode
                      key={os.id}
                      icon={Box}
                      iconClassName="text-cyan-500"
                      label={`${os.objectName} / ${os.sectionName}`}
                      isExpandable={false}
                      isSelected={selectedOsId === os.id}
                      onSelect={() => setSelectedOsId(os.id)}
                      depth={1}
                    />
                  ))}
                </TreeNode>
              ))}
            </div>
          </div>

          {/* ===================== RIGHT PANEL — Form ===================== */}
          <div className="flex-1 flex flex-col overflow-y-auto">
            {!selectedOs ? (
              <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-3">
                <Box className="h-12 w-12 opacity-30" />
                <div className="text-center">
                  <p className="text-sm font-medium">Выберите объект/раздел</p>
                  <p className="text-xs mt-1">
                    Выберите объект/раздел в дереве слева для создания загрузки
                  </p>
                </div>
              </div>
            ) : (
              <div className="p-6 space-y-5">
                {/* Breadcrumbs */}
                <div>
                  <span className="text-xs text-muted-foreground">
                    Выбрано для загрузки:
                  </span>
                  <div className="flex items-center gap-1 mt-1 flex-wrap">
                    {breadcrumbs.map((item, i) => {
                      const Icon = item.icon
                      return (
                        <div key={i} className="flex items-center gap-1">
                          {i > 0 && (
                            <ChevronRight className="h-3 w-3 text-muted-foreground" />
                          )}
                          <Icon className={cn('h-3 w-3', item.iconColor)} />
                          <span className="text-xs font-medium">{item.name}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Employee */}
                <div>
                  <Label className="text-sm font-medium">Сотрудник</Label>
                  <Select value={employeeId} onValueChange={setEmployeeId}>
                    <SelectTrigger className="mt-1.5">
                      <SelectValue placeholder="Выберите сотрудника" />
                    </SelectTrigger>
                    <SelectContent>
                      {MOCK_EMPLOYEES.map((emp) => (
                        <SelectItem key={emp.id} value={emp.id}>
                          {emp.name}
                          <span className="text-muted-foreground ml-2">
                            — {emp.position}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Stage name (optional dropdown) */}
                <div>
                  <Label className="text-sm font-medium">
                    Этап{' '}
                    <span className="text-muted-foreground font-normal">
                      (необязательно)
                    </span>
                  </Label>
                  <Select value={stageName} onValueChange={setStageName}>
                    <SelectTrigger className="mt-1.5">
                      <SelectValue placeholder="Выберите этап" />
                    </SelectTrigger>
                    <SelectContent>
                      {STAGE_OPTIONS.map((stage) => (
                        <SelectItem key={stage} value={stage}>
                          {stage}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Rate */}
                <div>
                  <Label className="text-sm font-medium">Ставка загрузки</Label>
                  <div className="flex gap-2 mt-1.5">
                    {QUICK_RATES.map((r) => (
                      <Button
                        key={r}
                        type="button"
                        variant={isQuickRateSelected(r) ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => handleQuickRate(r)}
                        className={cn(
                          'flex-1',
                          isQuickRateSelected(r) &&
                            'bg-teal-500 text-white hover:bg-teal-600 dark:bg-teal-600 dark:hover:bg-teal-700'
                        )}
                      >
                        {r}
                      </Button>
                    ))}
                  </div>
                  <div className="mt-2">
                    <span className="text-xs text-muted-foreground">
                      Или введите своё значение:
                    </span>
                    <Input
                      placeholder="1.25"
                      value={customRate}
                      onChange={(e) => handleCustomRate(e.target.value)}
                      className="mt-1"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Введите значение от 0.01 до 2.0
                    </p>
                  </div>
                </div>

                {/* Date range */}
                <div>
                  <Label className="text-sm font-medium">Период загрузки</Label>
                  <div className="flex items-center gap-2 mt-1.5">
                    <Input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="flex-1"
                    />
                    <span className="text-muted-foreground text-sm shrink-0">—</span>
                    <Input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="flex-1"
                    />
                  </div>
                </div>

                {/* Comment */}
                <div>
                  <Label className="text-sm font-medium">
                    Комментарий{' '}
                    <span className="text-muted-foreground font-normal">
                      (необязательно)
                    </span>
                  </Label>
                  <Textarea
                    placeholder="Добавьте комментарий к загрузке..."
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    className="mt-1.5 min-h-[80px]"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="px-6 py-4 border-t">
          <Button variant="outline" onClick={handleClose}>
            Отмена
          </Button>
          <Button onClick={handleCreate} disabled={!isValid}>
            Создать
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
