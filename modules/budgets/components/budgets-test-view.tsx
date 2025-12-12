'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSectionBudgetSummary, useBudgetsByEntity, useCreateBudget, useUpdateBudgetAmount, useBudgetTypes } from '../hooks'
import { getProjects } from '@/modules/cache/actions/projects'
import type { SectionBudgetSummary, BudgetCurrent } from '../types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Progress } from '@/components/ui/progress'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  AlertCircle,
  Wallet,
  Plus,
  Pencil,
  Loader2,
  ChevronRight,
  RefreshCw,
  Filter,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'

/**
 * Форматирование суммы в BYN
 */
function formatAmount(amount: number): string {
  return new Intl.NumberFormat('ru-BY', {
    style: 'currency',
    currency: 'BYN',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount)
}

/**
 * Хук для получения списка проектов
 */
function useProjectsList() {
  return useQuery({
    queryKey: ['projects', 'list-for-filter'],
    queryFn: async () => {
      const result = await getProjects()
      if (!result.success) throw new Error(result.error)
      return result.data
    },
    staleTime: 5 * 60 * 1000, // 5 минут
  })
}

/**
 * Компонент карточки раздела с бюджетами
 */
function SectionCard({
  section,
  onSelect,
  isSelected,
}: {
  section: SectionBudgetSummary
  onSelect: () => void
  isSelected: boolean
}) {
  return (
    <Card
      className={`cursor-pointer transition-all hover:shadow-md ${
        isSelected ? 'ring-2 ring-primary' : ''
      }`}
      onClick={onSelect}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <CardTitle className="text-base font-medium truncate">
            {section.section_name}
          </CardTitle>
          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
        </div>
        <CardDescription className="text-xs">
          {section.budget_count} бюджет(ов)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Прогресс расхода */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Расход</span>
            <span className="font-medium">{section.spent_percentage.toFixed(1)}%</span>
          </div>
          <Progress
            value={Math.min(section.spent_percentage, 100)}
            className="h-2"
          />
        </div>

        {/* Суммы */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <span className="text-muted-foreground">План:</span>
            <div className="font-medium">{formatAmount(section.total_planned)}</div>
          </div>
          <div>
            <span className="text-muted-foreground">Остаток:</span>
            <div className={`font-medium ${section.remaining < 0 ? 'text-red-500' : ''}`}>
              {formatAmount(section.remaining)}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

/**
 * Компонент бюджета раздела
 */
function BudgetCard({
  budget,
  onEdit,
}: {
  budget: BudgetCurrent
  onEdit: () => void
}) {
  const percentage = budget.spent_percentage

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base">{budget.name}</CardTitle>
            {budget.version_comment && (
              <CardDescription className="text-xs mt-1">
                {budget.version_comment}
              </CardDescription>
            )}
          </div>
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={onEdit}>
            <Pencil className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Тип бюджета */}
        {budget.type_name && (
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              style={{ borderColor: budget.type_color || undefined, color: budget.type_color || undefined }}
            >
              {budget.type_name}
            </Badge>
          </div>
        )}

        {/* Прогресс */}
        <div className="space-y-1">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Израсходовано</span>
            <span className={`font-medium ${percentage >= 100 ? 'text-red-500' : ''}`}>
              {percentage.toFixed(1)}%
            </span>
          </div>
          <Progress value={Math.min(percentage, 100)} className="h-2" />
        </div>

        {/* Суммы */}
        <div className="grid grid-cols-3 gap-2 text-sm">
          <div>
            <div className="text-muted-foreground text-xs">План</div>
            <div className="font-semibold">{formatAmount(budget.planned_amount)}</div>
          </div>
          <div>
            <div className="text-muted-foreground text-xs">Расход</div>
            <div className="font-semibold text-orange-600">
              {formatAmount(budget.spent_amount)}
            </div>
          </div>
          <div>
            <div className="text-muted-foreground text-xs">Остаток</div>
            <div className={`font-semibold ${budget.remaining_amount < 0 ? 'text-red-500' : 'text-green-600'}`}>
              {formatAmount(budget.remaining_amount)}
            </div>
          </div>
        </div>

        {/* Даты */}
        <div className="text-xs text-muted-foreground">
          Версия от {new Date(budget.effective_from).toLocaleDateString('ru-RU')}
        </div>
      </CardContent>
    </Card>
  )
}

/**
 * Диалог создания бюджета
 */
function CreateBudgetDialog({
  open,
  onOpenChange,
  sectionId,
  sectionName,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  sectionId: string
  sectionName: string
}) {
  const [selectedTypeId, setSelectedTypeId] = useState<string>('')
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [comment, setComment] = useState('')
  const [nameManuallySet, setNameManuallySet] = useState(false)
  const createBudget = useCreateBudget()
  const { data: budgetTypes } = useBudgetTypes()

  // Автозаполнение названия из типа
  const handleTypeChange = (typeId: string) => {
    setSelectedTypeId(typeId)
    // Если пользователь не менял название вручную, подставляем из типа
    if (!nameManuallySet && budgetTypes) {
      const selectedType = budgetTypes.find(t => t.type_id === typeId)
      if (selectedType) {
        setName(selectedType.name)
      }
    }
  }

  const handleNameChange = (value: string) => {
    setName(value)
    setNameManuallySet(true)
  }

  const handleSubmit = () => {
    if (!selectedTypeId || !amount) return

    const finalName = name.trim() || budgetTypes?.find(t => t.type_id === selectedTypeId)?.name || 'Бюджет'

    createBudget.mutate(
      {
        entity_type: 'section',
        entity_id: sectionId,
        name: finalName,
        planned_amount: parseFloat(amount),
        comment: comment.trim() || undefined,
        budget_type_id: selectedTypeId,
      },
      {
        onSuccess: () => {
          onOpenChange(false)
          setSelectedTypeId('')
          setName('')
          setAmount('')
          setComment('')
          setNameManuallySet(false)
        },
      }
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Создать бюджет</DialogTitle>
          <DialogDescription>
            Новый бюджет для раздела: {sectionName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Тип бюджета - ОБЯЗАТЕЛЬНОЕ поле */}
          <div className="space-y-2">
            <Label htmlFor="budget-type">
              Тип бюджета <span className="text-destructive">*</span>
            </Label>
            {budgetTypes && budgetTypes.length > 0 ? (
              <Select
                value={selectedTypeId || ''}
                onValueChange={handleTypeChange}
              >
                <SelectTrigger id="budget-type">
                  <SelectValue placeholder="Выберите тип бюджета" />
                </SelectTrigger>
                <SelectContent>
                  {budgetTypes.map((type) => (
                    <SelectItem key={type.type_id} value={type.type_id}>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: type.color }}
                        />
                        <span>{type.name}</span>
                        {type.description && (
                          <span className="text-xs text-muted-foreground ml-1">
                            — {type.description}
                          </span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="text-sm text-muted-foreground">
                Загрузка типов бюджетов...
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">
              Название (необязательно)
            </Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder={budgetTypes?.find(t => t.type_id === selectedTypeId)?.name || 'Название бюджета'}
            />
            <p className="text-xs text-muted-foreground">
              По умолчанию будет использовано название типа
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount">
              Сумма (BYN) <span className="text-destructive">*</span>
            </Label>
            <Input
              id="amount"
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="10000"
              min="0"
              step="0.01"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="comment">Комментарий (необязательно)</Label>
            <Input
              id="comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Начальный бюджет"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!selectedTypeId || !amount || createBudget.isPending}
          >
            {createBudget.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Создать
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Диалог обновления суммы бюджета
 */
function UpdateBudgetDialog({
  open,
  onOpenChange,
  budget,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  budget: BudgetCurrent | null
}) {
  const [amount, setAmount] = useState('')
  const [comment, setComment] = useState('')
  const updateBudget = useUpdateBudgetAmount()

  const handleSubmit = () => {
    if (!budget || !amount) return

    updateBudget.mutate(
      {
        budget_id: budget.budget_id,
        planned_amount: parseFloat(amount),
        comment: comment.trim() || undefined,
      },
      {
        onSuccess: () => {
          onOpenChange(false)
          setAmount('')
          setComment('')
        },
      }
    )
  }

  // Reset form when dialog opens with new budget
  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen && budget) {
      setAmount(budget.planned_amount.toString())
      setComment('')
    }
    onOpenChange(newOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Изменить сумму бюджета</DialogTitle>
          <DialogDescription>
            {budget?.name} - текущая сумма: {budget ? formatAmount(budget.planned_amount) : ''}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="new-amount">Новая сумма (BYN)</Label>
            <Input
              id="new-amount"
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="15000"
              min="0"
              step="0.01"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="update-comment">Причина изменения</Label>
            <Input
              id="update-comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Увеличение бюджета по согласованию"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!amount || updateBudget.isPending}
          >
            {updateBudget.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Сохранить
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Типы для этапов и задач
 */
interface DecompositionStage {
  decomposition_stage_id: string
  decomposition_stage_name: string
  decomposition_stage_section_id: string
}

interface DecompositionItem {
  decomposition_item_id: string
  decomposition_item_description: string
  decomposition_item_stage_id: string
  decomposition_item_section_id: string
}

/**
 * Хуки для загрузки этапов и задач
 */
function useDecompositionStages(sectionId: string) {
  return useQuery({
    queryKey: ['decomposition-stages', sectionId],
    queryFn: async () => {
      const supabase = (await import('@/utils/supabase/client')).createClient()
      const { data, error } = await supabase
        .from('decomposition_stages')
        .select('decomposition_stage_id, decomposition_stage_name, decomposition_stage_section_id')
        .eq('decomposition_stage_section_id', sectionId)
        .order('decomposition_stage_order')

      if (error) throw error
      return data as DecompositionStage[]
    },
  })
}

function useDecompositionItems(stageId: string | null) {
  return useQuery({
    queryKey: ['decomposition-items', stageId],
    queryFn: async () => {
      if (!stageId) return []
      const supabase = (await import('@/utils/supabase/client')).createClient()
      const { data, error } = await supabase
        .from('decomposition_items')
        .select('decomposition_item_id, decomposition_item_description, decomposition_item_stage_id, decomposition_item_section_id')
        .eq('decomposition_item_stage_id', stageId)
        .order('decomposition_item_order')

      if (error) throw error
      return data as DecompositionItem[]
    },
    enabled: !!stageId,
  })
}

/**
 * Диалог создания отчёта (work_log)
 */
function CreateWorkLogDialog({
  open,
  onOpenChange,
  itemId,
  itemDescription,
  budgets,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  itemId: string
  itemDescription: string
  budgets: BudgetCurrent[]
}) {
  const [description, setDescription] = useState('')
  const [hours, setHours] = useState('')
  const [rate, setRate] = useState('')
  const [budgetId, setBudgetId] = useState<string>('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (!hours || !rate) return

    setIsSubmitting(true)
    try {
      const supabase = (await import('@/utils/supabase/client')).createClient()
      const amount = parseFloat(hours) * parseFloat(rate)

      // Получаем текущего пользователя
      const { data: { user } } = await supabase.auth.getUser()

      const insertData: Record<string, unknown> = {
        decomposition_item_id: itemId,
        work_log_description: description.trim() || itemDescription,
        work_log_hours: parseFloat(hours),
        work_log_hourly_rate: parseFloat(rate),
        work_log_amount: amount,
      }

      // Добавляем created_by если пользователь авторизован
      if (user) {
        insertData.work_log_created_by = user.id
      }

      // Добавляем budget_id только если он выбран (и не "_none")
      if (budgetId && budgetId !== '_none') {
        insertData.budget_id = budgetId
      }

      const { error } = await supabase
        .from('work_logs')
        .insert(insertData)

      if (error) {
        console.error('Error creating work log:', error)
        throw error
      }

      // Reset form
      setDescription('')
      setHours('')
      setRate('')
      setBudgetId('')
      onOpenChange(false)

      // Простое обновление страницы для тестовой версии
      window.location.reload()
    } catch (error) {
      console.error('Error creating work log:', error)
      const errorMessage = error instanceof Error ? error.message : 'Неизвестная ошибка'
      alert(`Ошибка при создании отчёта: ${errorMessage}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Внести отчёт</DialogTitle>
          <DialogDescription>{itemDescription}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="work-description">Описание работы</Label>
            <Input
              id="work-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={itemDescription}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="hours">
                Часы <span className="text-destructive">*</span>
              </Label>
              <Input
                id="hours"
                type="number"
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                placeholder="8"
                min="0"
                step="0.5"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="rate">
                Ставка (BYN/ч) <span className="text-destructive">*</span>
              </Label>
              <Input
                id="rate"
                type="number"
                value={rate}
                onChange={(e) => setRate(e.target.value)}
                placeholder="25"
                min="0"
                step="0.01"
              />
            </div>
          </div>

          {hours && rate && (
            <div className="text-sm text-muted-foreground">
              Сумма: {formatAmount(parseFloat(hours) * parseFloat(rate))}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="budget">Бюджет (необязательно)</Label>
            <Select value={budgetId} onValueChange={setBudgetId}>
              <SelectTrigger id="budget">
                <SelectValue placeholder="Без привязки к бюджету" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">Без привязки</SelectItem>
                {budgets.map((budget) => (
                  <SelectItem key={budget.budget_id} value={budget.budget_id}>
                    {budget.name} ({formatAmount(budget.remaining_amount)} осталось)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button onClick={handleSubmit} disabled={!hours || !rate || isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Сохранить
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Панель с бюджетами выбранного раздела
 */
function SectionBudgetsPanel({
  section,
  onClose,
}: {
  section: SectionBudgetSummary
  onClose: () => void
}) {
  const { data: budgets, isLoading, error, refetch } = useBudgetsByEntity('section', section.section_id)
  const [createOpen, setCreateOpen] = useState(false)
  const [editBudget, setEditBudget] = useState<BudgetCurrent | null>(null)

  // Для работы с этапами и задачами
  const { data: stages } = useDecompositionStages(section.section_id)
  const [selectedStageId, setSelectedStageId] = useState<string | null>(null)
  const { data: items } = useDecompositionItems(selectedStageId)
  const [workLogItem, setWorkLogItem] = useState<DecompositionItem | null>(null)

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">{section.section_name}</h3>
          <p className="text-sm text-muted-foreground">
            {section.budget_count} бюджет(ов)
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => refetch()}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Добавить
          </Button>
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <Skeleton key={i} className="h-40 w-full" />
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-4 w-4" />
              <span>{error.message}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Budgets list */}
      {budgets && budgets.length > 0 && (
        <div className="space-y-3">
          {budgets.map((budget) => (
            <BudgetCard
              key={budget.budget_id}
              budget={budget}
              onEdit={() => setEditBudget(budget)}
            />
          ))}
        </div>
      )}

      {/* Empty state */}
      {budgets && budgets.length === 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center text-muted-foreground">
              <Wallet className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>Нет бюджетов</p>
              <Button
                variant="link"
                className="mt-2"
                onClick={() => setCreateOpen(true)}
              >
                Создать первый бюджет
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Decomposition stages and items - TEST SECTION */}
      {budgets && budgets.length > 0 && stages && stages.length > 0 && (
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle className="text-sm">Тестирование: Внести отчёт</CardTitle>
            <CardDescription className="text-xs">
              Выберите этап и задачу, чтобы внести отчёт и проверить влияние на бюджет
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Stage selector */}
            <div className="space-y-2">
              <Label className="text-xs">Этап декомпозиции</Label>
              <Select
                value={selectedStageId || ''}
                onValueChange={(v) => setSelectedStageId(v || null)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Выберите этап" />
                </SelectTrigger>
                <SelectContent>
                  {stages.map((stage) => (
                    <SelectItem key={stage.decomposition_stage_id} value={stage.decomposition_stage_id}>
                      {stage.decomposition_stage_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Items list */}
            {selectedStageId && items && items.length > 0 && (
              <div className="space-y-2">
                <Label className="text-xs">Задачи ({items.length})</Label>
                <div className="space-y-1 max-h-[200px] overflow-y-auto">
                  {items.map((item) => (
                    <div
                      key={item.decomposition_item_id}
                      className="flex items-center justify-between p-2 text-sm border rounded hover:bg-accent cursor-pointer"
                      onClick={() => setWorkLogItem(item)}
                    >
                      <span className="text-xs truncate">{item.decomposition_item_description}</span>
                      <Button size="sm" variant="ghost" className="h-6 px-2 text-xs">
                        Отчёт
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {selectedStageId && items && items.length === 0 && (
              <div className="text-xs text-muted-foreground text-center py-4">
                Нет задач в этом этапе
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Dialogs */}
      <CreateBudgetDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        sectionId={section.section_id}
        sectionName={section.section_name}
      />

      <UpdateBudgetDialog
        open={!!editBudget}
        onOpenChange={(open) => !open && setEditBudget(null)}
        budget={editBudget}
      />

      {workLogItem && budgets && (
        <CreateWorkLogDialog
          open={!!workLogItem}
          onOpenChange={(open) => !open && setWorkLogItem(null)}
          itemId={workLogItem.decomposition_item_id}
          itemDescription={workLogItem.decomposition_item_description}
          budgets={budgets}
        />
      )}
    </div>
  )
}

/**
 * Компонент фильтра по проекту
 */
function ProjectFilter({
  value,
  onChange,
}: {
  value: string | undefined
  onChange: (value: string | undefined) => void
}) {
  const { data: projects, isLoading } = useProjectsList()

  return (
    <div className="flex items-center gap-2">
      <Filter className="h-4 w-4 text-muted-foreground" />
      <Select
        value={value ?? 'all'}
        onValueChange={(v) => onChange(v === 'all' ? undefined : v)}
      >
        <SelectTrigger className="w-[280px]">
          <SelectValue placeholder="Все проекты" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Все проекты</SelectItem>
          {isLoading && (
            <SelectItem value="_loading" disabled>
              Загрузка...
            </SelectItem>
          )}
          {projects?.map((project) => (
            <SelectItem key={project.project_id} value={project.project_id}>
              {project.project_name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

/**
 * Основной компонент тестовой страницы бюджетов
 */
export function BudgetsTestView() {
  const [selectedProjectId, setSelectedProjectId] = useState<string | undefined>(undefined)
  const { data: sections, isLoading, error, refetch } = useSectionBudgetSummary(selectedProjectId)
  const [selectedSection, setSelectedSection] = useState<SectionBudgetSummary | null>(null)

  // Сбрасываем выбранный раздел при смене проекта
  const handleProjectChange = (projectId: string | undefined) => {
    setSelectedProjectId(projectId)
    setSelectedSection(null)
  }

  return (
    <div className="space-y-4">
      {/* Filter */}
      <div className="flex items-center justify-between">
        <ProjectFilter value={selectedProjectId} onChange={handleProjectChange} />
        <Button size="sm" variant="outline" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-1" />
          Обновить
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left panel - Sections list */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">
            Разделы с бюджетами
            {sections && sections.length > 0 && (
              <span className="text-muted-foreground font-normal ml-2">
                ({sections.length})
              </span>
            )}
          </h2>

          {/* Loading */}
          {isLoading && (
            <div className="grid gap-3">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-32 w-full" />
              ))}
            </div>
          )}

          {/* Error */}
          {error && (
            <Card className="border-destructive">
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  <span>{error.message}</span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Sections list */}
          {sections && sections.length > 0 && (
            <div className="grid gap-3 max-h-[600px] overflow-y-auto pr-2">
              {sections.map((section) => (
                <SectionCard
                  key={section.section_id}
                  section={section}
                  onSelect={() => setSelectedSection(section)}
                  isSelected={selectedSection?.section_id === section.section_id}
                />
              ))}
            </div>
          )}

          {/* Empty state */}
          {sections && sections.length === 0 && (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center text-muted-foreground">
                  <Wallet className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p className="font-medium">Нет разделов с бюджетами</p>
                  <p className="text-sm mt-1">
                    {selectedProjectId
                      ? 'В выбранном проекте нет разделов с бюджетами'
                      : 'Создайте бюджет для любого раздела, чтобы начать отслеживание'}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right panel - Selected section budgets */}
        <div>
          {selectedSection ? (
            <SectionBudgetsPanel
              key={selectedSection.section_id}
              section={selectedSection}
              onClose={() => setSelectedSection(null)}
            />
          ) : (
            <Card className="h-full min-h-[300px]">
              <CardContent className="h-full flex items-center justify-center">
                <div className="text-center text-muted-foreground">
                  <ChevronRight className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>Выберите раздел слева</p>
                  <p className="text-sm mt-1">
                    для просмотра и управления бюджетами
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
