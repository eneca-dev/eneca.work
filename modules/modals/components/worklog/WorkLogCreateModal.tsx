'use client'

import React, { useEffect, useMemo, useState, KeyboardEvent } from 'react'
import { formatMinskDate } from '@/lib/timezone-utils'
import { X, FileText, Loader2, Search, User } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useHasPermission } from '@/modules/permissions'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { DatePicker } from '@/modules/projects/components/DatePicker'
import { useUsers, useCurrentUser, useWorkCategories, type CachedUser } from '@/modules/cache'
import { useBudgets } from '@/modules/budgets'
import type { BaseModalProps } from '../../types'
import { ProgressUpdateDialog } from '../progress'
import {
  useDecompositionItemsForWorkLog,
  useUserHourlyRate,
  useCreateWorkLog,
} from '../../hooks'

// ============================================================================
// Types
// ============================================================================

export interface WorkLogCreateModalProps extends BaseModalProps {
  /** ID раздела (для загрузки decomposition_items) */
  sectionId: string
  /** Название раздела (для отображения в header) */
  sectionName: string
  /** Опционально: заранее выбранный decomposition_item_id */
  defaultItemId?: string | null
}

// UserOption теперь импортируется как CachedUser из @/modules/cache
type UserOption = CachedUser

// ============================================================================
// Component
// ============================================================================

export function WorkLogCreateModal({
  isOpen,
  onClose,
  onSuccess,
  sectionId,
  sectionName,
  defaultItemId = null,
}: WorkLogCreateModalProps) {
  // Используем кешированные хуки для справочников
  const { data: cachedUsers = [], isLoading: usersLoading } = useUsers()
  const { data: currentUser } = useCurrentUser()
  const { data: cachedCategories = [], isLoading: categoriesLoading } = useWorkCategories()
  // Загружаем бюджеты для автоматического выбора бюджета задачи
  const { data: allBudgets = [] } = useBudgets({ is_active: true })

  // Загружаем decomposition items через хук (Server Action)
  const { data: items = [], isLoading: itemsLoading } = useDecompositionItemsForWorkLog(sectionId, {
    enabled: isOpen,
  })

  const [selectedItemId, setSelectedItemId] = useState<string>(defaultItemId || '')

  // Находим бюджет выбранной задачи (decomposition_item)
  const itemBudget = useMemo(() => {
    if (!selectedItemId) return null
    return allBudgets.find(
      (b) => b.entity_type === 'decomposition_item' && b.entity_id === selectedItemId
    ) || null
  }, [allBudgets, selectedItemId])

  // Проверяем есть ли бюджет и достаточно ли средств
  const hasBudget = itemBudget && itemBudget.total_amount > 0
  const budgetRemaining = itemBudget ? itemBudget.remaining_amount : 0

  // Используем дату по Минскому времени для дефолтного значения
  const [workDate, setWorkDate] = useState<string>(formatMinskDate(new Date()))
  const [hours, setHours] = useState<string>('')
  const [rate, setRate] = useState<string>('')

  // Вычисляем сумму отчёта и проверяем превышение бюджета
  const workLogAmount = useMemo(() => {
    const h = Number(hours) || 0
    const r = Number(rate) || 0
    return h * r
  }, [hours, rate])

  const exceedsBudget = hasBudget && workLogAmount > budgetRemaining
  const [description, setDescription] = useState<string>('')
  const [search, setSearch] = useState<string>('')
  const [selectedUserId, setSelectedUserId] = useState<string>('')
  const [userSearch, setUserSearch] = useState<string>('')

  // Состояние для диалога обновления готовности
  const [showProgressDialog, setShowProgressDialog] = useState(false)
  const [savedItemInfo, setSavedItemInfo] = useState<{
    id: string
    name: string
    progress: number
  } | null>(null)

  // Проверки разрешений
  const canEditRate = useHasPermission('work_logs.rate.edit')
  const canEditExecutor = useHasPermission('work_logs.executor.edit')
  const canEditDate = useHasPermission('work_logs.date.edit')
  const isAdmin = useHasPermission('users.admin_panel')

  // Мутация для создания work log
  const { mutate: createWorkLogMutation, isPending: saving } = useCreateWorkLog()

  // Загрузка ставки выбранного пользователя (если не текущий)
  const shouldLoadUserRate = canEditExecutor && selectedUserId && selectedUserId !== currentUser?.user_id
  const { data: selectedUserRate } = useUserHourlyRate(
    shouldLoadUserRate ? selectedUserId : undefined,
    { enabled: shouldLoadUserRate }
  )

  // Сброс формы при открытии
  useEffect(() => {
    if (isOpen) {
      setSelectedItemId(defaultItemId || '')
      setWorkDate(formatMinskDate(new Date()))
      setHours('')
      setRate('')
      setDescription('')
      setSearch('')
      setSelectedUserId('')
      setUserSearch('')
      setShowProgressDialog(false)
      setSavedItemInfo(null)
    }
  }, [isOpen, defaultItemId])

  // Устанавливаем текущего пользователя как исполнителя по умолчанию
  useEffect(() => {
    if (currentUser && !selectedUserId && isOpen) {
      setSelectedUserId(currentUser.user_id)
    }
  }, [currentUser, selectedUserId, isOpen])

  // Устанавливаем ставку из кешированного профиля текущего пользователя
  useEffect(() => {
    if (currentUser?.salary != null && isOpen && !rate) {
      setRate(String(currentUser.salary))
    }
  }, [currentUser, isOpen, rate])

  // Устанавливаем ставку при выборе другого пользователя
  useEffect(() => {
    if (selectedUserRate != null) {
      setRate(String(selectedUserRate))
    }
  }, [selectedUserRate])

  useEffect(() => {
    setSelectedItemId(defaultItemId || '')
  }, [defaultItemId])

  const categoryById = useMemo(() => {
    const map = new Map<string, string>()
    cachedCategories.forEach((c) => map.set(c.work_category_id, c.work_category_name))
    return map
  }, [cachedCategories])

  const filteredItems = useMemo(() => {
    const s = search.trim().toLowerCase()
    if (!s) return items
    return items.filter((i) => i.description.toLowerCase().includes(s))
  }, [items, search])

  // Используем кешированных пользователей или fallback на текущего
  const users = useMemo(() => {
    if (canEditExecutor && cachedUsers.length > 0) {
      return cachedUsers
    }
    // Если нет права редактировать исполнителя - показываем только текущего
    if (currentUser) {
      return [currentUser]
    }
    return []
  }, [cachedUsers, currentUser, canEditExecutor])

  const filteredUsers = useMemo(() => {
    if (!userSearch) return users
    return users.filter(
      (user) =>
        user.full_name.toLowerCase().includes(userSearch.toLowerCase()) ||
        user.email.toLowerCase().includes(userSearch.toLowerCase())
    )
  }, [users, userSearch])

  const selectedUser = useMemo(() => {
    return users.find((user) => user.user_id === selectedUserId)
  }, [users, selectedUserId])

  const canSave = useMemo(() => {
    const h = Number(hours)
    const r = Number(rate)
    const descOk = description.trim().length > 0
    const executorOk = !canEditExecutor || selectedUserId
    const rateOk = !isAdmin || (Number.isFinite(r) && r >= 0)
    const budgetOk = hasBudget // бюджет задачи должен существовать и быть > 0
    return selectedItemId && Number.isFinite(h) && h > 0 && !!workDate && descOk && executorOk && rateOk && budgetOk
  }, [selectedItemId, hours, rate, workDate, description, isAdmin, selectedUserId, canEditExecutor, hasBudget])

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && canSave && !saving) save()
  }

  const save = () => {
    if (!canSave || !itemBudget) return

    createWorkLogMutation(
      {
        sectionId,
        decompositionItemId: selectedItemId,
        description: description.trim() || null,
        workDate,
        hours: Number(hours),
        hourlyRate: isAdmin ? Number(rate) : Number(rate) || 0,
        budgetId: itemBudget.budget_id,
        executorId: canEditExecutor ? selectedUserId : undefined,
      },
      {
        onSuccess: () => {
          // Находим информацию о выбранной задаче для диалога обновления готовности
          const selectedItem = items.find((i) => i.id === selectedItemId)
          if (selectedItem) {
            setSavedItemInfo({
              id: selectedItem.id,
              name: selectedItem.description,
              progress: selectedItem.progress,
            })
            setShowProgressDialog(true)
          } else {
            // Если не нашли задачу (не должно быть), закрываем сразу
            onSuccess?.()
            onClose()
          }
        },
        onError: (error) => {
          console.error('Ошибка сохранения отчёта:', error)
        },
      }
    )
  }

  // Обработчик закрытия диалога обновления готовности
  const handleProgressDialogClose = () => {
    setShowProgressDialog(false)
    setSavedItemInfo(null)
    onSuccess?.()
    onClose()
  }

  const formatDateLocal = (d: Date) => {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }

  const loading = itemsLoading

  if (!isOpen) return null

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-50 bg-black/40 dark:bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          className={cn(
            'pointer-events-auto w-full max-w-xl',
            'bg-card/95 backdrop-blur-md',
            'border border-border/50',
            'rounded-lg shadow-2xl shadow-black/20 dark:shadow-black/50',
            'transform transition-all duration-200',
            isOpen ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
          )}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={onKey}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/50">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-green-500" />
              <span className="text-xs font-medium text-foreground">
                Добавить отчёт
              </span>
              <span className="text-[10px] text-muted-foreground">·</span>
              <span
                className="text-[10px] text-muted-foreground truncate max-w-[200px]"
                title={sectionName}
              >
                Раздел: {sectionName}
              </span>
            </div>
            <button
              onClick={onClose}
              className="p-1 text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body */}
          <div className="px-4 py-3">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="space-y-3">
                {/* Строка декомпозиции */}
                <div>
                  <label className="block text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1.5">
                    Строка декомпозиции
                  </label>
                  {defaultItemId ? (
                    <div className="px-2.5 py-1.5 rounded text-xs bg-muted text-foreground border border-border">
                      <span className="text-muted-foreground">
                        {categoryById.get(
                          items.find((i) => i.id === selectedItemId)?.work_category_id || ''
                        ) || '—'}
                      </span>
                      <span className="mx-2 text-muted-foreground">•</span>
                      <span>{items.find((i) => i.id === selectedItemId)?.description}</span>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <input
                        type="text"
                        placeholder="Поиск по описанию..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className={cn(
                          'w-full px-2.5 py-1.5 text-xs',
                          'bg-muted/50 border border-border',
                          'rounded text-foreground',
                          'placeholder:text-muted-foreground',
                          'focus:outline-none focus:border-border focus:ring-1 focus:ring-border/50',
                          'transition-colors'
                        )}
                      />
                      <select
                        value={selectedItemId}
                        onChange={(e) => setSelectedItemId(e.target.value)}
                        className={cn(
                          'w-full px-2.5 py-1.5 text-xs',
                          'bg-muted/50 border border-border',
                          'rounded text-foreground',
                          'focus:outline-none focus:border-border focus:ring-1 focus:ring-border/50',
                          'transition-colors'
                        )}
                      >
                        <option value="">Выберите строку...</option>
                        {filteredItems.map((i) => (
                          <option key={i.id} value={i.id}>
                            {categoryById.get(i.work_category_id) || 'Без категории'} •{' '}
                            {i.description?.slice(0, 80)}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                {/* Выбор исполнителя (только для админов) */}
                {isAdmin && (
                  <div>
                    <label className="block text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1.5">
                      Исполнитель <span className="text-red-500">*</span>
                    </label>
                    {selectedUser ? (
                      <button
                        type="button"
                        className={cn(
                          'w-full text-left flex items-center gap-2.5 px-2.5 py-1.5',
                          'border border-border rounded',
                          'bg-muted/50',
                          canEditExecutor
                            ? 'hover:bg-muted cursor-pointer'
                            : 'cursor-not-allowed opacity-60'
                        )}
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          if (canEditExecutor) setSelectedUserId('')
                        }}
                        title={
                          canEditExecutor
                            ? 'Нажмите, чтобы выбрать другого исполнителя'
                            : 'Недостаточно прав для изменения исполнителя'
                        }
                      >
                        <Avatar className="h-6 w-6">
                          <AvatarImage src={selectedUser.avatar_url || undefined} />
                          <AvatarFallback className="text-[10px] bg-muted text-foreground">
                            {selectedUser.first_name?.[0]}
                            {selectedUser.last_name?.[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium text-foreground truncate">
                            {selectedUser.full_name}
                          </div>
                          <div className="text-[10px] text-muted-foreground truncate">
                            {selectedUser.email}
                          </div>
                        </div>
                        {canEditExecutor && (
                          <User className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                        )}
                      </button>
                    ) : (
                      <div className="space-y-1.5">
                        <div className="relative">
                          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                          <input
                            placeholder="Найти пользователя..."
                            value={userSearch}
                            onChange={(e) => setUserSearch(e.target.value)}
                            className={cn(
                              'w-full pl-8 pr-2.5 py-1.5 text-xs',
                              'bg-muted/50 border border-border',
                              'rounded text-foreground',
                              'placeholder:text-muted-foreground',
                              'focus:outline-none focus:border-border focus:ring-1 focus:ring-border/50',
                              'transition-colors',
                              !canEditExecutor && 'cursor-not-allowed opacity-60'
                            )}
                            disabled={!canEditExecutor}
                            autoFocus
                          />
                        </div>
                        {filteredUsers.length > 0 && (
                          <div className="max-h-28 overflow-y-auto border border-border rounded bg-card">
                            {filteredUsers.slice(0, 5).map((user) => (
                              <div
                                key={user.user_id}
                                className={cn(
                                  'flex items-center gap-2.5 px-2.5 py-1.5',
                                  canEditExecutor
                                    ? 'hover:bg-muted cursor-pointer'
                                    : 'cursor-not-allowed opacity-60'
                                )}
                                onClick={() => {
                                  if (!canEditExecutor) return
                                  setSelectedUserId(user.user_id)
                                  setUserSearch('')
                                }}
                              >
                                <Avatar className="h-6 w-6">
                                  <AvatarImage src={user.avatar_url || undefined} />
                                  <AvatarFallback className="text-[10px] bg-muted text-foreground">
                                    {user.first_name?.[0]}
                                    {user.last_name?.[0]}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="flex-1 min-w-0">
                                  <div className="text-xs font-medium text-foreground truncate">
                                    {user.full_name}
                                  </div>
                                  <div className="text-[10px] text-muted-foreground truncate">
                                    {user.email}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Информация о бюджете задачи */}
                {selectedItemId && (
                  <div className={cn(
                    'flex items-center gap-2 px-2.5 py-2 rounded border',
                    hasBudget
                      ? 'border-green-300 dark:border-green-600/50 bg-green-50 dark:bg-green-900/20'
                      : 'border-amber-300 dark:border-amber-600/50 bg-amber-50 dark:bg-amber-900/20'
                  )}>
                    <span className={cn(
                      'text-xs',
                      hasBudget
                        ? 'text-green-600'
                        : 'text-amber-700 dark:text-amber-400'
                    )}>
                      {hasBudget ? (
                        <>
                          Бюджет задачи: {itemBudget!.total_amount.toLocaleString('ru-RU')} BYN
                          <span className="mx-1.5">·</span>
                          Остаток: {budgetRemaining.toLocaleString('ru-RU')} BYN
                        </>
                      ) : (
                        'У задачи нет бюджета. Сначала установите бюджет для задачи.'
                      )}
                    </span>
                  </div>
                )}

                {/* Предупреждение о превышении бюджета */}
                {exceedsBudget && (
                  <div className="flex items-center gap-2 px-2.5 py-2 rounded border border-red-300 dark:border-red-600/50 bg-red-50 dark:bg-red-900/20">
                    <span className="text-xs text-red-700 dark:text-red-400">
                      ⚠️ Сумма отчёта ({workLogAmount.toLocaleString('ru-RU')} BYN) превышает остаток бюджета ({budgetRemaining.toLocaleString('ru-RU')} BYN)
                    </span>
                  </div>
                )}

                {/* Дата / Часы / Ставка - 3 колонки */}
                <div className="grid grid-cols-3 gap-2.5">
                  <div>
                    <label className="block text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1.5">
                      Дата
                    </label>
                    <DatePicker
                      value={workDate ? new Date(workDate) : null}
                      onChange={(d) => setWorkDate(formatDateLocal(d))}
                      placeholder="Выберите"
                      calendarWidth="260px"
                      placement="right"
                      offsetY={-40}
                      inputClassName={cn(
                        'w-full px-2.5 py-1.5 text-xs',
                        'bg-muted/50 border border-border',
                        'rounded text-foreground',
                        'focus:outline-none focus:border-border focus:ring-1 focus:ring-border/50',
                        canEditDate ? 'cursor-pointer' : 'cursor-not-allowed opacity-60 pointer-events-none'
                      )}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1.5">
                      Часы
                    </label>
                    <input
                      type="number"
                      step="0.25"
                      min={0}
                      value={hours}
                      onChange={(e) => setHours(e.target.value)}
                      placeholder="0"
                      className={cn(
                        'w-full px-2.5 py-1.5 text-xs text-center font-mono',
                        'bg-muted/50 border border-border',
                        'rounded text-foreground',
                        'placeholder:text-muted-foreground',
                        'focus:outline-none focus:border-border focus:ring-1 focus:ring-border/50',
                        'transition-colors',
                        '[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none'
                      )}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1.5">
                      Ставка
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.01"
                        min={0}
                        value={rate}
                        onChange={(e) => setRate(e.target.value)}
                        placeholder="0"
                        className={cn(
                          'w-full px-2.5 py-1.5 pr-12 text-xs text-right font-mono',
                          'bg-muted/50 border border-border',
                          'rounded text-foreground',
                          'placeholder:text-muted-foreground',
                          'focus:outline-none focus:border-border focus:ring-1 focus:ring-border/50',
                          'transition-colors',
                          '[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none',
                          (!isAdmin || !canEditRate) && 'opacity-60'
                        )}
                        disabled={!isAdmin || !canEditRate}
                        readOnly={!isAdmin}
                        title={
                          !isAdmin
                            ? 'Только просмотр'
                            : canEditRate
                              ? undefined
                              : 'Недостаточно прав'
                        }
                      />
                      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">
                        BYN/ч
                      </span>
                    </div>
                  </div>
                </div>

                {/* Описание */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                      Описание
                    </label>
                    <span className="text-[10px] text-muted-foreground">обязательно</span>
                  </div>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    placeholder="Что было сделано"
                    required
                    className={cn(
                      'w-full px-2.5 py-1.5 text-xs',
                      'bg-muted/50 border border-border',
                      'rounded text-foreground resize-none',
                      'placeholder:text-muted-foreground',
                      'focus:outline-none focus:border-border focus:ring-1 focus:ring-border/50',
                      'transition-colors'
                    )}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 px-4 py-2.5 border-t border-border/50">
            <button
              onClick={onClose}
              disabled={saving}
              className={cn(
                'px-3 py-1.5 text-[11px] font-medium rounded',
                'text-muted-foreground hover:text-foreground',
                'border border-border hover:border-border',
                'bg-card hover:bg-muted',
                'transition-colors',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
              Отмена
            </button>
            <button
              onClick={save}
              disabled={!canSave || saving}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium rounded',
                'text-white bg-green-500 hover:bg-green-400',
                'transition-colors',
                'disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground'
              )}
            >
              {saving ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Сохранение...
                </>
              ) : (
                <>
                  <FileText className="w-3 h-3" />
                  Сохранить
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Диалог обновления готовности */}
      {savedItemInfo && (
        <ProgressUpdateDialog
          isOpen={showProgressDialog}
          onClose={handleProgressDialogClose}
          itemId={savedItemInfo.id}
          itemName={savedItemInfo.name}
          currentProgress={savedItemInfo.progress}
          onSuccess={handleProgressDialogClose}
        />
      )}
    </>
  )
}

export default WorkLogCreateModal
