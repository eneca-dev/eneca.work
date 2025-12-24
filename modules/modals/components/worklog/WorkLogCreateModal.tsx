'use client'

import React, { useEffect, useMemo, useState, KeyboardEvent } from 'react'
import { X, FileText, Loader2, Search, User, Wallet, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useHasPermission } from '@/modules/permissions'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { DatePicker } from '@/modules/projects/components/DatePicker'
import { useUsers, useCurrentUser, useWorkCategories, type CachedUser } from '@/modules/cache'
import { useBudgetsByEntity } from '@/modules/budgets'
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
  const { data: cachedBudgets = [], isLoading: budgetsLoading } = useBudgetsByEntity('section', isOpen ? sectionId : undefined)

  // Загружаем decomposition items через хук (Server Action)
  const { data: items = [], isLoading: itemsLoading } = useDecompositionItemsForWorkLog(sectionId, {
    enabled: isOpen,
  })

  const [selectedItemId, setSelectedItemId] = useState<string>(defaultItemId || '')
  const [workDate, setWorkDate] = useState<string>(new Date().toISOString().slice(0, 10))
  const [hours, setHours] = useState<string>('')
  const [rate, setRate] = useState<string>('')
  const [description, setDescription] = useState<string>('')
  const [search, setSearch] = useState<string>('')
  const [selectedUserId, setSelectedUserId] = useState<string>('')
  const [userSearch, setUserSearch] = useState<string>('')
  const [selectedBudgetId, setSelectedBudgetId] = useState<string>('')

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
      setWorkDate(new Date().toISOString().slice(0, 10))
      setHours('')
      setRate('')
      setDescription('')
      setSearch('')
      setSelectedUserId('')
      setUserSearch('')
      setSelectedBudgetId('')
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

  // Автовыбор бюджета если он один
  useEffect(() => {
    if (cachedBudgets.length === 1 && !selectedBudgetId) {
      setSelectedBudgetId(cachedBudgets[0].budget_id)
    }
  }, [cachedBudgets, selectedBudgetId])

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

  const selectedBudget = useMemo(() => {
    return cachedBudgets.find((b) => b.budget_id === selectedBudgetId)
  }, [cachedBudgets, selectedBudgetId])

  const canSave = useMemo(() => {
    const h = Number(hours)
    const r = Number(rate)
    const descOk = description.trim().length > 0
    const executorOk = !canEditExecutor || selectedUserId
    const rateOk = !isAdmin || (Number.isFinite(r) && r >= 0)
    const budgetOk = !!selectedBudgetId // бюджет обязателен
    return selectedItemId && Number.isFinite(h) && h > 0 && !!workDate && descOk && executorOk && rateOk && budgetOk
  }, [selectedItemId, hours, rate, workDate, description, isAdmin, selectedUserId, canEditExecutor, selectedBudgetId])

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && canSave && !saving) save()
  }

  const save = () => {
    if (!canSave) return

    createWorkLogMutation(
      {
        sectionId,
        decompositionItemId: selectedItemId,
        description: description.trim() || null,
        workDate,
        hours: Number(hours),
        hourlyRate: isAdmin ? Number(rate) : Number(rate) || 0,
        budgetId: selectedBudgetId,
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
            'bg-white/95 dark:bg-slate-900/95 backdrop-blur-md',
            'border border-slate-200 dark:border-slate-700/50',
            'rounded-lg shadow-2xl shadow-black/20 dark:shadow-black/50',
            'transform transition-all duration-200',
            isOpen ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
          )}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={onKey}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-200 dark:border-slate-700/50">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-green-500" />
              <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                Добавить отчёт
              </span>
              <span className="text-[10px] text-slate-400 dark:text-slate-500">·</span>
              <span
                className="text-[10px] text-slate-500 dark:text-slate-400 truncate max-w-[200px]"
                title={sectionName}
              >
                Раздел: {sectionName}
              </span>
            </div>
            <button
              onClick={onClose}
              className="p-1 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body */}
          <div className="px-4 py-3">
            {loading || budgetsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-slate-400 dark:text-slate-500" />
              </div>
            ) : (
              <div className="space-y-3">
                {/* Строка декомпозиции */}
                <div>
                  <label className="block text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">
                    Строка декомпозиции
                  </label>
                  {defaultItemId ? (
                    <div className="px-2.5 py-1.5 rounded text-xs bg-slate-100 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                      <span className="text-slate-400 dark:text-slate-500">
                        {categoryById.get(
                          items.find((i) => i.id === selectedItemId)?.work_category_id || ''
                        ) || '—'}
                      </span>
                      <span className="mx-2 text-slate-300 dark:text-slate-600">•</span>
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
                          'bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700',
                          'rounded text-slate-700 dark:text-slate-200',
                          'placeholder:text-slate-400 dark:placeholder:text-slate-600',
                          'focus:outline-none focus:border-slate-300 dark:focus:border-slate-600 focus:ring-1 focus:ring-slate-300/50 dark:focus:ring-slate-600/50',
                          'transition-colors'
                        )}
                      />
                      <select
                        value={selectedItemId}
                        onChange={(e) => setSelectedItemId(e.target.value)}
                        className={cn(
                          'w-full px-2.5 py-1.5 text-xs',
                          'bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700',
                          'rounded text-slate-700 dark:text-slate-200',
                          'focus:outline-none focus:border-slate-300 dark:focus:border-slate-600 focus:ring-1 focus:ring-slate-300/50 dark:focus:ring-slate-600/50',
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
                    <label className="block text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">
                      Исполнитель <span className="text-red-500">*</span>
                    </label>
                    {selectedUser ? (
                      <button
                        type="button"
                        className={cn(
                          'w-full text-left flex items-center gap-2.5 px-2.5 py-1.5',
                          'border border-slate-200 dark:border-slate-700 rounded',
                          'bg-slate-50 dark:bg-slate-800/50',
                          canEditExecutor
                            ? 'hover:bg-slate-100 dark:hover:bg-slate-700/50 cursor-pointer'
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
                          <AvatarFallback className="text-[10px] bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                            {selectedUser.first_name?.[0]}
                            {selectedUser.last_name?.[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium text-slate-700 dark:text-slate-200 truncate">
                            {selectedUser.full_name}
                          </div>
                          <div className="text-[10px] text-slate-400 dark:text-slate-500 truncate">
                            {selectedUser.email}
                          </div>
                        </div>
                        {canEditExecutor && (
                          <User className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500 flex-shrink-0" />
                        )}
                      </button>
                    ) : (
                      <div className="space-y-1.5">
                        <div className="relative">
                          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
                          <input
                            placeholder="Найти пользователя..."
                            value={userSearch}
                            onChange={(e) => setUserSearch(e.target.value)}
                            className={cn(
                              'w-full pl-8 pr-2.5 py-1.5 text-xs',
                              'bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700',
                              'rounded text-slate-700 dark:text-slate-200',
                              'placeholder:text-slate-400 dark:placeholder:text-slate-600',
                              'focus:outline-none focus:border-slate-300 dark:focus:border-slate-600 focus:ring-1 focus:ring-slate-300/50 dark:focus:ring-slate-600/50',
                              'transition-colors',
                              !canEditExecutor && 'cursor-not-allowed opacity-60'
                            )}
                            disabled={!canEditExecutor}
                            autoFocus
                          />
                        </div>
                        {filteredUsers.length > 0 && (
                          <div className="max-h-28 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-800">
                            {filteredUsers.slice(0, 5).map((user) => (
                              <div
                                key={user.user_id}
                                className={cn(
                                  'flex items-center gap-2.5 px-2.5 py-1.5',
                                  canEditExecutor
                                    ? 'hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer'
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
                                  <AvatarFallback className="text-[10px] bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                                    {user.first_name?.[0]}
                                    {user.last_name?.[0]}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="flex-1 min-w-0">
                                  <div className="text-xs font-medium text-slate-700 dark:text-slate-200 truncate">
                                    {user.full_name}
                                  </div>
                                  <div className="text-[10px] text-slate-400 dark:text-slate-500 truncate">
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

                {/* Выбор бюджета */}
                <div>
                  <label className="block text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">
                    Бюджет <span className="text-red-500">*</span>
                  </label>
                  {cachedBudgets.length === 0 ? (
                    <div className="flex items-center gap-2 px-2.5 py-2 rounded border border-amber-300 dark:border-amber-600/50 bg-amber-50 dark:bg-amber-900/20">
                      <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0" />
                      <span className="text-xs text-amber-700 dark:text-amber-400">
                        У раздела нет активных бюджетов. Сначала создайте бюджет.
                      </span>
                    </div>
                  ) : cachedBudgets.length === 1 ? (
                    <div className="flex items-center gap-2.5 px-2.5 py-1.5 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                      <div
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: selectedBudget?.type_color || '#6B7280' }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-slate-700 dark:text-slate-200 truncate">
                          {selectedBudget?.name}
                        </div>
                        <div className="text-[10px] text-slate-400 dark:text-slate-500">
                          {selectedBudget?.type_name}
                          {selectedBudget?.planned_amount != null && (
                            <span className="ml-2">
                              План: {Number(selectedBudget.planned_amount).toLocaleString('ru-RU')} BYN
                            </span>
                          )}
                        </div>
                      </div>
                      <Wallet className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 flex-shrink-0" />
                    </div>
                  ) : (
                    <select
                      value={selectedBudgetId}
                      onChange={(e) => setSelectedBudgetId(e.target.value)}
                      className={cn(
                        'w-full px-2.5 py-1.5 text-xs',
                        'bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700',
                        'rounded text-slate-700 dark:text-slate-200',
                        'focus:outline-none focus:border-slate-300 dark:focus:border-slate-600 focus:ring-1 focus:ring-slate-300/50 dark:focus:ring-slate-600/50',
                        'transition-colors'
                      )}
                    >
                      <option value="">Выберите бюджет...</option>
                      {cachedBudgets.map((b) => {
                        const remaining = b.planned_amount != null ? Number(b.planned_amount) - b.spent_amount : null
                        return (
                          <option key={b.budget_id} value={b.budget_id}>
                            {b.name} ({b.type_name})
                            {remaining != null && ` — Остаток: ${remaining.toLocaleString('ru-RU')} BYN`}
                          </option>
                        )
                      })}
                    </select>
                  )}
                  {selectedBudget && cachedBudgets.length > 1 && (
                    <div className="mt-1.5 flex items-center gap-2 text-[10px] text-slate-400 dark:text-slate-500">
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: selectedBudget.type_color || '#6B7280' }}
                      />
                      <span>
                        {selectedBudget.planned_amount != null && (
                          <>
                            План: {Number(selectedBudget.planned_amount).toLocaleString('ru-RU')} BYN
                            <span className="mx-1.5">·</span>
                            Потрачено: {selectedBudget.spent_amount.toLocaleString('ru-RU')} BYN
                            <span className="mx-1.5">·</span>
                            Остаток: {(Number(selectedBudget.planned_amount) - selectedBudget.spent_amount).toLocaleString('ru-RU')} BYN
                          </>
                        )}
                      </span>
                    </div>
                  )}
                </div>

                {/* Дата / Часы / Ставка - 3 колонки */}
                <div className="grid grid-cols-3 gap-2.5">
                  <div>
                    <label className="block text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">
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
                        'bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700',
                        'rounded text-slate-700 dark:text-slate-200',
                        'focus:outline-none focus:border-slate-300 dark:focus:border-slate-600 focus:ring-1 focus:ring-slate-300/50 dark:focus:ring-slate-600/50',
                        canEditDate ? 'cursor-pointer' : 'cursor-not-allowed opacity-60 pointer-events-none'
                      )}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">
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
                        'bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700',
                        'rounded text-slate-700 dark:text-slate-200',
                        'placeholder:text-slate-400 dark:placeholder:text-slate-600',
                        'focus:outline-none focus:border-slate-300 dark:focus:border-slate-600 focus:ring-1 focus:ring-slate-300/50 dark:focus:ring-slate-600/50',
                        'transition-colors',
                        '[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none'
                      )}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">
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
                          'bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700',
                          'rounded text-slate-700 dark:text-slate-200',
                          'placeholder:text-slate-400 dark:placeholder:text-slate-600',
                          'focus:outline-none focus:border-slate-300 dark:focus:border-slate-600 focus:ring-1 focus:ring-slate-300/50 dark:focus:ring-slate-600/50',
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
                      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 dark:text-slate-500">
                        BYN/ч
                      </span>
                    </div>
                  </div>
                </div>

                {/* Описание */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                      Описание
                    </label>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500">обязательно</span>
                  </div>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    placeholder="Что было сделано"
                    required
                    className={cn(
                      'w-full px-2.5 py-1.5 text-xs',
                      'bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700',
                      'rounded text-slate-700 dark:text-slate-200 resize-none',
                      'placeholder:text-slate-400 dark:placeholder:text-slate-600',
                      'focus:outline-none focus:border-slate-300 dark:focus:border-slate-600 focus:ring-1 focus:ring-slate-300/50 dark:focus:ring-slate-600/50',
                      'transition-colors'
                    )}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 px-4 py-2.5 border-t border-slate-200 dark:border-slate-700/50">
            <button
              onClick={onClose}
              disabled={saving}
              className={cn(
                'px-3 py-1.5 text-[11px] font-medium rounded',
                'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300',
                'border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600',
                'bg-white dark:bg-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800',
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
                'disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-300 dark:disabled:bg-slate-700 disabled:text-slate-500'
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
