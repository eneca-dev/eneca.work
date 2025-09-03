"use client"

import React, { useEffect, useMemo, useState, KeyboardEvent } from "react"
import { createClient } from "@/utils/supabase/client"
import { Modal, ModalButton } from "@/components/modals"
import { Loader2 } from "lucide-react"
import { useHasPermission } from "@/modules/permissions"

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

const supabase = createClient()

export function AddWorkLogModal({ isOpen, onClose, sectionId, defaultItemId = null, onSuccess }: AddWorkLogModalProps) {
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  const [items, setItems] = useState<ItemOption[]>([])
  const [categories, setCategories] = useState<WorkCategory[]>([])

  const [selectedItemId, setSelectedItemId] = useState<string>(defaultItemId || "")
  const [workDate, setWorkDate] = useState<string>(new Date().toISOString().slice(0, 10))
  const [hours, setHours] = useState<string>("")
  const [rate, setRate] = useState<string>("")
  const [description, setDescription] = useState<string>("")
  const [search, setSearch] = useState<string>("")

  // Проверка разрешения на редактирование ставки
  const canEditRate = useHasPermission('work_logs.rate.edit')

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
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [isOpen, sectionId])

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

  const canSave = useMemo(() => {
    const h = Number(hours)
    const r = Number(rate)
    const descOk = description.trim().length > 0
    return selectedItemId && Number.isFinite(h) && h > 0 && Number.isFinite(r) && r >= 0 && !!workDate && descOk
  }, [selectedItemId, hours, rate, workDate, description])

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
        work_log_created_by: userId,
        work_log_date: workDate,
        work_log_hours: Number(hours),
        work_log_hourly_rate: Number(rate),
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

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="sm">
      <Modal.Header title="Добавить отчёт" subtitle="Привяжите отчёт к строке декомпозиции" />
      <Modal.Body>
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

            {/* Дата / Часы / Ставка */}
            <div className="grid grid-cols-3 gap-2.5">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Дата</label>
                <input
                  type="date"
                  value={workDate}
                  onChange={e => setWorkDate(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 dark:border-slate-700 rounded-md dark:bg-slate-800 dark:text-white"
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
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Ставка</label>
                <input
                  type="number"
                  step="0.01"
                  min={0}
                  value={rate}
                  onChange={e => setRate(e.target.value)}
                  placeholder="0"
                  className="w-full px-2.5 py-1.5 border border-slate-300 dark:border-slate-700 rounded-md text-center dark:bg-slate-800 dark:text-white disabled:opacity-60"
                  disabled={!canEditRate}
                  title={canEditRate ? undefined : 'Недостаточно прав для изменения ставки'}
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
                className="w-full px-2.5 py-2 border border-slate-300 dark:border-slate-700 rounded-md dark:bg-slate-800 dark:text-white"
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

