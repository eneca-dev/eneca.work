"use client"

import React, { useEffect, useMemo, useState, KeyboardEvent } from "react"
import { createClient } from "@/utils/supabase/client"
import { Modal, ModalButton } from "@/components/modals"
import { Loader2, Search, User } from "lucide-react"
import { useHasPermission } from "@/modules/permissions"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import { DatePicker } from "@/modules/projects/components/DatePicker"

interface AddWorkLogModalProps {
  isOpen: boolean
  onClose: () => void
  sectionId: string
  defaultItemId?: string | null
  onSuccess?: () => void
}

interface ItemOption {
  id: string
  description: string
  work_category_id: string
}

interface WorkCategory {
  work_category_id: string
  work_category_name: string
}

interface UserOption {
  user_id: string
  first_name: string
  last_name: string
  email: string
  avatar_url?: string
  full_name: string
}

const supabase = createClient()

export function AddWorkLogModal({ isOpen, onClose, sectionId, defaultItemId = null, onSuccess }: AddWorkLogModalProps) {
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  const [items, setItems] = useState<ItemOption[]>([])
  const [categories, setCategories] = useState<WorkCategory[]>([])
  const [users, setUsers] = useState<UserOption[]>([])

  const [selectedItemId, setSelectedItemId] = useState<string>(defaultItemId || "")
  const [workDate, setWorkDate] = useState<string>(new Date().toISOString().slice(0, 10))
  const [hours, setHours] = useState<string>("")  
  const [rate, setRate] = useState<string>("")  
  const [description, setDescription] = useState<string>("")  
  const [search, setSearch] = useState<string>("")  
  const [selectedUserId, setSelectedUserId] = useState<string>("") // ID выбранного исполнителя
  const [userSearch, setUserSearch] = useState<string>("") // Поиск пользователей

  // Проверки разрешений
  const canEditRate = useHasPermission('work_logs.rate.edit')
  const isAdmin = useHasPermission('users.admin_panel') // Проверка роли администратора

  useEffect(() => {
    if (isOpen) {
      setSelectedItemId(defaultItemId || "")
      setWorkDate(new Date().toISOString().slice(0, 10))
      setHours("")
      setRate("")
      setDescription("")
      setSearch("")
      setSelectedUserId("") // Сбрасываем выбранного исполнителя
      setUserSearch("") // Сбрасываем поиск пользователей
    }
  }, [isOpen, defaultItemId])

  useEffect(() => {
    if (!isOpen) return
    const load = async () => {
      setLoading(true)
      try {
        const [itemsRes, catsRes, lastLogRes] = await Promise.all([
          supabase
            .from("decomposition_items")
            .select("decomposition_item_id, decomposition_item_description, decomposition_item_work_category_id")
            .eq("decomposition_item_section_id", sectionId)
            .order("decomposition_item_order", { ascending: true }),
          supabase
            .from("work_categories")
            .select("work_category_id, work_category_name")
            .order("work_category_name"),
          supabase
            .from("work_logs")
            .select("work_log_hourly_rate")
            .order("work_log_created_at", { ascending: false })
            .limit(1)
        ])

        if (!itemsRes.error && itemsRes.data) {
          setItems(
            itemsRes.data.map((r: any) => ({
              id: r.decomposition_item_id,
              description: r.decomposition_item_description,
              work_category_id: r.decomposition_item_work_category_id,
            }))
          )
        }
        if (!catsRes.error && catsRes.data) setCategories(catsRes.data as WorkCategory[])

        // Подставляем ставку из профиля пользователя; если нет, используем последнюю из work_logs
        try {
          const { data: authData } = await supabase.auth.getUser()
          const userId = authData?.user?.id
          if (userId) {
            const { data: profileData } = await supabase
              .from('profiles')
              .select('salary, is_hourly')
              .eq('user_id', userId)
              .single()

            if (profileData && profileData.salary != null) {
              setRate(String(profileData.salary))
            } else if (!lastLogRes.error && lastLogRes.data && lastLogRes.data[0]) {
              const lastRate = lastLogRes.data[0].work_log_hourly_rate
              if (lastRate != null) setRate(String(lastRate))
            }
          }
        } catch {}

        // Загружаем пользователей только для админов
        if (isAdmin) {
          const { data: usersData, error: usersError } = await supabase
            .from("view_users")
            .select(`
              user_id,
              first_name,
              last_name,
              email,
              avatar_url
            `)
            .order("first_name")

          if (usersError) {
            console.error("Ошибка загрузки пользователей:", usersError)
          } else {
            const userOptions: UserOption[] = usersData.map(user => ({
              user_id: user.user_id,
              first_name: user.first_name || "",
              last_name: user.last_name || "",
              email: user.email,
              avatar_url: user.avatar_url,
              full_name: `${user.first_name || ""} ${user.last_name || ""}`.trim()
            }))
            setUsers(userOptions)
          }
        }
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [isOpen, sectionId, isAdmin])

  useEffect(() => {
    // Если пришёл новый defaultItemId — проставим
    setSelectedItemId(defaultItemId || "")
  }, [defaultItemId])

  const categoryById = useMemo(() => {
    const map = new Map<string, string>()
    categories.forEach(c => map.set(c.work_category_id, c.work_category_name))
    return map
  }, [categories])

  const filteredItems = useMemo(() => {
    const s = search.trim().toLowerCase()
    if (!s) return items
    return items.filter(i => i.description.toLowerCase().includes(s))
  }, [items, search])

  // Фильтрация пользователей по поиску
  const filteredUsers = useMemo(() => {
    if (!userSearch) return users
    return users.filter(user => 
      user.full_name.toLowerCase().includes(userSearch.toLowerCase()) ||
      user.email.toLowerCase().includes(userSearch.toLowerCase())
    )
  }, [users, userSearch])

  // Получение выбранного пользователя
  const selectedUser = useMemo(() => {
    return users.find(user => user.user_id === selectedUserId)
  }, [users, selectedUserId])

  const canSave = useMemo(() => {
    const h = Number(hours)
    const r = Number(rate)
    const descOk = description.trim().length > 0
    const executorOk = !isAdmin || selectedUserId // Для админов нужен выбор исполнителя
    const rateOk = !isAdmin || (Number.isFinite(r) && r >= 0) // Для админов нужна валидная ставка
    return selectedItemId && Number.isFinite(h) && h > 0 && !!workDate && descOk && executorOk && rateOk
  }, [selectedItemId, hours, rate, workDate, description, isAdmin, selectedUserId])

  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Enter" && canSave && !saving) save()
  }

  const save = async () => {
    if (!canSave) return
    setSaving(true)
    try {
      const { data: userResp } = await supabase.auth.getUser()
      const userId = userResp.user?.id
      if (!userId) throw new Error("Пользователь не найден")

      const payload = {
        decomposition_item_id: selectedItemId,
        work_log_description: description || null,
        work_log_created_by: isAdmin ? selectedUserId : userId, // Для админов - выбранный исполнитель, для пользователей - текущий
        work_log_date: workDate,
        work_log_hours: Number(hours),
        work_log_hourly_rate: isAdmin ? Number(rate) : (Number(rate) || 0), // Для обычных пользователей ставка может быть 0
      }
      const { error } = await supabase
        .from("work_logs")
        .insert(payload)
      if (error) {
        console.error("Supabase insert error:", { message: error.message, details: (error as any).details, hint: (error as any).hint })
        throw new Error(error.message || "Не удалось сохранить отчёт")
      }

      onSuccess?.()
      onClose()
    } catch (e) {
      console.error("Ошибка сохранения отчёта:", e)
    } finally {
      setSaving(false)
    }
  }

  const formatDateLocal = (d: Date) => {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="sm" className="min-h-[520px]">
      <Modal.Header title="Добавить отчёт" subtitle="Привяжите отчёт к строке декомпозиции" />
      <Modal.Body className="overflow-visible">
        {loading ? (
          <div className="flex items-center justify-center h-20">
            <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
          </div>
        ) : (
          <div className="space-y-3 text-sm" onKeyDown={onKey}>
            {/* Строка декомпозиции */}
            <div className="space-y-1">
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">Строка декомпозиции</label>
              {defaultItemId ? (
                <div className="px-2.5 py-1.5 rounded-md bg-slate-100 dark:bg-slate-800 text-sm">
                  {categoryById.get(items.find(i => i.id === selectedItemId)?.work_category_id || "") || "—"}
                  <span className="mx-2 text-slate-400">•</span>
                  <span className="text-slate-700 dark:text-slate-200">
                    {items.find(i => i.id === selectedItemId)?.description}
                  </span>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <input
                    type="text"
                    placeholder="Поиск по описанию..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-slate-300 dark:border-slate-700 rounded-md dark:bg-slate-800 dark:text-white"
                  />
                  <select
                    value={selectedItemId}
                    onChange={e => setSelectedItemId(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-slate-300 dark:border-slate-700 rounded-md dark:bg-slate-800 dark:text-white"
                  >
                    <option value="">Выберите строку...</option>
                    {filteredItems.map(i => (
                      <option key={i.id} value={i.id}>
                        {categoryById.get(i.work_category_id) || "Без категории"} • {i.description?.slice(0, 80)}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Выбор исполнителя (только для админов) */}
            {isAdmin && (
              <div className="space-y-1">
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">
                  Исполнитель <span className="text-red-500">*</span>
                </label>
                {selectedUser ? (
                  <div 
                    className="flex items-center gap-3 p-2.5 border border-slate-300 dark:border-slate-700 rounded-md bg-slate-50 dark:bg-slate-800 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700"
                    onClick={() => setSelectedUserId("")}
                  >
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={selectedUser.avatar_url || undefined} />
                      <AvatarFallback className="text-xs">
                        {selectedUser.first_name?.[0]}{selectedUser.last_name?.[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="text-sm font-medium">{selectedUser.full_name}</div>
                      <div className="text-xs text-slate-500">{selectedUser.email}</div>
                    </div>
                    <User className="h-4 w-4 text-slate-400" />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                      <Input
                        placeholder="Найти пользователя..."
                        value={userSearch}
                        onChange={e => setUserSearch(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                    {filteredUsers.length > 0 && (
                      <div className="max-h-32 overflow-y-auto border border-slate-300 dark:border-slate-700 rounded-md">
                        {filteredUsers.slice(0, 5).map((user) => (
                          <div
                            key={user.user_id}
                            className="flex items-center gap-3 p-2.5 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer"
                            onClick={() => {
                              setSelectedUserId(user.user_id)
                              setUserSearch("")
                            }}
                          >
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={user.avatar_url || undefined} />
                              <AvatarFallback className="text-xs">
                                {user.first_name?.[0]}{user.last_name?.[0]}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1">
                              <div className="text-sm font-medium">{user.full_name}</div>
                              <div className="text-xs text-slate-500">{user.email}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Дата / Часы / Ставка */}
            <div className={`grid gap-2.5 grid-cols-3`}>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Дата</label>
                <DatePicker
                  value={workDate ? new Date(workDate) : null}
                  onChange={(d) => setWorkDate(formatDateLocal(d))}
                  placeholder="Выберите дату"
                  calendarWidth="260px"
                  placement="right"
                  offsetY={-40}
                  inputClassName="cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Часы</label>
                <input
                  type="number"
                  step="0.25"
                  min={0}
                  value={hours}
                  onChange={e => setHours(e.target.value)}
                  placeholder="0"
                  className="w-full px-2.5 py-1.5 border border-slate-300 dark:border-slate-700 rounded-md text-center dark:bg-slate-800 dark:text-white"
                />
              </div>
              {/* Ставка — видна всем, редактируема только для админов */}
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Ставка, BYN/ч</label>
                <input
                  type="number"
                  step="0.01"
                  min={0}
                  value={rate}
                  onChange={e => setRate(e.target.value)}
                  placeholder="0"
                  className="w-full px-2.5 py-1.5 border border-slate-300 dark:border-slate-700 rounded-md text-center dark:bg-slate-800 dark:text-white disabled:opacity-60"
                  disabled={!isAdmin || !canEditRate}
                  readOnly={!isAdmin}
                  title={!isAdmin ? 'Только просмотр' : (canEditRate ? undefined : 'Недостаточно прав для изменения ставки')}
                />
              </div>
            </div>

            {/* Описание — обязательно */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">Описание</label>
                <span className="text-[11px] text-slate-400">обязательно</span>
              </div>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={3}
                placeholder="Что было сделано"
                required
                className="w-full px-2.5 py-2 border border-slate-300 dark:border-slate-700 rounded-md dark:bg-slate-800 dark:text-white min-h-[120px]"
              />
            </div>
          </div>
        )}
      </Modal.Body>
      <Modal.Footer>
        <ModalButton variant="cancel" onClick={onClose}>Отмена</ModalButton>
        <ModalButton variant="success" onClick={save} disabled={!canSave || saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Сохранить
        </ModalButton>
      </Modal.Footer>
    </Modal>
  )
}

export default AddWorkLogModal

