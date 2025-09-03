"use client"

import React, { useEffect, useMemo, useState, KeyboardEvent, useRef } from "react"
import { createClient } from "@/utils/supabase/client"
import { Loader2, MoreHorizontal, Trash2, PlusCircle, Clock, LayoutTemplate } from "lucide-react"
import { useUiStore } from "@/stores/useUiStore"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import AddWorkLogModal from "./AddWorkLogModal"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { TemplatesPanel } from "@/modules/decomposition-templates"
// no slider for progress editing; using numeric input and a capsule view

interface SectionDecompositionTabProps {
  sectionId: string
  compact?: boolean
}

interface WorkCategory {
  work_category_id: string
  work_category_name: string
}

interface Profile {
  user_id: string
  first_name: string
  last_name: string
  email: string
}

interface SectionStatus {
  id: string
  name: string
  color: string
  description: string | null
}

interface DecompositionItemRow {
  decomposition_item_id: string
  decomposition_item_description: string
  decomposition_item_work_category_id: string
  decomposition_item_planned_hours: number
  decomposition_item_planned_due_date: string | null
  decomposition_item_order: number
  decomposition_item_responsible: string | null
  decomposition_item_status_id: string | null
  decomposition_item_progress: number
  responsible_profile?: Profile | null
  status?: SectionStatus | null
}

const supabase = createClient()

export function SectionDecompositionTab({ sectionId, compact = false }: SectionDecompositionTabProps) {
  const { setNotification } = useUiStore()
  const MAX_DESC_CHARS = 500
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [categories, setCategories] = useState<WorkCategory[]>([])
  const [items, setItems] = useState<DecompositionItemRow[]>([])
  const [actualByItemId, setActualByItemId] = useState<Record<string, number>>({})
  const [logsCountByItemId, setLogsCountByItemId] = useState<Record<string, number>>({})
  const [sectionTotals, setSectionTotals] = useState<{ planned_hours: number; actual_hours: number; actual_amount: number } | null>(null)

  const [newDescription, setNewDescription] = useState("")
  const [newCategoryId, setNewCategoryId] = useState("")
  const [newPlannedHours, setNewPlannedHours] = useState("")
  const [newPlannedDueDate, setNewPlannedDueDate] = useState("")
  const [newResponsibleSearch, setNewResponsibleSearch] = useState("")
  const [newProgress, setNewProgress] = useState("0")

  // Состояние для работы с профилями
  const [profiles, setProfiles] = useState<Profile[]>([])
  
  // Состояние для работы со статусами
  const [statuses, setStatuses] = useState<SectionStatus[]>([])
  const [newStatusId, setNewStatusId] = useState("")

  // Состояния для ответственного (убираем поиск и dropdown, как у категории)

  // Inline edit state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<DecompositionItemRow | null>(null)
  const [responsibleSearch, setResponsibleSearch] = useState<string>("")
  const [savingId, setSavingId] = useState<string | null>(null)
  const [isLogModalOpen, setIsLogModalOpen] = useState(false)
  const [selectedForLog, setSelectedForLog] = useState<string | null>(null)
  const [isTemplatesOpen, setIsTemplatesOpen] = useState(false)
  const [departmentId, setDepartmentId] = useState<string | null>(null)
  const [sectionStartDate, setSectionStartDate] = useState<string | null>(null)

  useEffect(() => {
    if (!sectionId) return
    const init = async () => {
      setLoading(true)
      try {
        const [cats, rows, totals, profilesRes, statusesRes] = await Promise.all([
          supabase
            .from("work_categories")
            .select("work_category_id, work_category_name")
            .order("work_category_name", { ascending: true }),
          supabase
            .from("decomposition_items")
            .select(`
              decomposition_item_id, 
              decomposition_item_description, 
              decomposition_item_work_category_id, 
              decomposition_item_planned_hours, 
              decomposition_item_planned_due_date, 
              decomposition_item_order,
              decomposition_item_responsible,
              decomposition_item_status_id,
              decomposition_item_progress,
              profiles!decomposition_item_responsible (
                user_id,
                first_name,
                last_name,
                email
              ),
              section_statuses!decomposition_item_status_id (
                id,
                name,
                color,
                description
              )
            `)
            .eq("decomposition_item_section_id", sectionId)
            .order("decomposition_item_order", { ascending: true })
            .order("decomposition_item_created_at", { ascending: true }),
          supabase
            .from("view_section_decomposition_totals")
            .select("planned_hours, actual_hours, actual_amount")
            .eq("section_id", sectionId)
            .single(),
          supabase
            .from("profiles")
            .select("user_id, first_name, last_name, email")
            .order("first_name", { ascending: true }),
          supabase
            .from("section_statuses")
            .select("id, name, color, description")
            .order("name", { ascending: true })
        ])

        if (cats.error) throw cats.error
        if (rows.error) throw rows.error
        if (profilesRes.error) throw profilesRes.error
        if (statusesRes.error) throw statusesRes.error
        
        if (!totals.error) {
          setSectionTotals({
            planned_hours: Number(totals.data?.planned_hours || 0),
            actual_hours: Number(totals.data?.actual_hours || 0),
            actual_amount: Number(totals.data?.actual_amount || 0),
          })
        }

        setCategories(cats.data || [])
        setProfiles(profilesRes.data || [])
        setStatuses(statusesRes.data || [])
        
        // Устанавливаем статус по умолчанию "План" для новых строк
        const defaultStatus = statusesRes.data?.find((s: any) => s.name === "План")
        if (defaultStatus) {
          setNewStatusId(defaultStatus.id)
        }
        
        // Обрабатываем данные и нормализуем profiles и статусы
        const normalizedItems = (rows.data || []).map((item: any) => ({
          ...item,
          responsible_profile: item.profiles || null,
          status: item.section_statuses || null
        })) as DecompositionItemRow[]
        
        setItems(normalizedItems)
      } catch (error) {
        console.error("Ошибка загрузки декомпозиции:", error)
        setNotification("Ошибка загрузки декомпозиции")
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [sectionId, setNotification])

  useEffect(() => {
    const loadSectionMeta = async () => {
      if (!sectionId) return
      const { data, error } = await supabase
        .from('view_section_hierarchy')
        .select('section_id, section_start_date, responsible_department_id')
        .eq('section_id', sectionId)
        .single()
      if (!error && data) {
        setDepartmentId((data as any).responsible_department_id || null)
        setSectionStartDate((data as any).section_start_date || null)
      }
    }
    loadSectionMeta()
  }, [sectionId])

  // Загрузка фактических часов из view для видимых итемов
  useEffect(() => {
    const loadActuals = async () => {
      if (!items || items.length === 0) {
        setActualByItemId({})
        setLogsCountByItemId({})
        return
      }
      const ids = items.map(i => i.decomposition_item_id)
      const { data, error } = await supabase
        .from('view_decomposition_item_actuals')
        .select('decomposition_item_id, actual_hours')
        .in('decomposition_item_id', ids)

      if (error) {
        console.error('Ошибка загрузки факта из view:', error)
      } else {
        const agg: Record<string, number> = {}
        for (const row of (data as any[]) || []) {
          const key = row.decomposition_item_id as string
          const hours = Number(row.actual_hours || 0)
          agg[key] = hours
        }
        setActualByItemId(agg)
      }

      // Загружаем количество отчётов по этим же строкам
      try {
        const { data: logs, error: logsErr } = await supabase
          .from('view_work_logs_enriched')
          .select('decomposition_item_id, work_log_id')
          .in('decomposition_item_id', ids)
        if (logsErr) throw logsErr
        const counts: Record<string, number> = {}
        for (const row of (logs as any[]) || []) {
          const key = row.decomposition_item_id as string
          counts[key] = (counts[key] || 0) + 1
        }
        setLogsCountByItemId(counts)
      } catch (e) {
        console.error('Ошибка загрузки количества отчётов:', e)
        setLogsCountByItemId({})
      }
    }
    loadActuals()
  }, [items])

  const categoryById = useMemo(() => {
    const map = new Map<string, string>()
    categories.forEach(c => map.set(c.work_category_id, c.work_category_name))
    return map
  }, [categories])

  // Агрегаты для нижней панели итогов
  const plannedTotal = useMemo(() => {
    return items.reduce((sum, i) => sum + Number(i.decomposition_item_planned_hours || 0), 0)
  }, [items])

  const actualTotal = useMemo(() => {
    return Number(sectionTotals?.actual_hours || 0)
  }, [sectionTotals])

  const completionPercent = useMemo(() => {
    if (plannedTotal <= 0) return 0
    const pct = (actualTotal / plannedTotal) * 100
    return Math.max(0, Math.min(100, Math.round(pct)))
  }, [plannedTotal, actualTotal])

  const dateRange = useMemo(() => {
    const dates = items
      .map(i => i.decomposition_item_planned_due_date)
      .filter((d): d is string => Boolean(d))
      .map(d => new Date(d as string).getTime())
    if (dates.length === 0) return null
    const min = new Date(Math.min(...dates))
    const max = new Date(Math.max(...dates))
    return {
      minText: min.toLocaleDateString('ru-RU'),
      maxText: max.toLocaleDateString('ru-RU')
    }
  }, [items])

  // Utility функции для работы с профилями
  const getProfileName = (profile: Profile) => {
    const fullName = `${profile.first_name} ${profile.last_name}`.trim()
    return fullName || profile.email
  }

  const getResponsibleName = (item: DecompositionItemRow) => {
    if (!item.decomposition_item_responsible || !item.responsible_profile) return ""
    return getProfileName(item.responsible_profile)
  }

  // Простая функция для получения имени ответственного (как у категории)



  const canAdd = useMemo(() => {
    const hours = Number(newPlannedHours)
    return (
      newDescription.trim().length > 0 &&
      newCategoryId &&
      Number.isFinite(hours) &&
      hours >= 0
    )
  }, [newDescription, newCategoryId, newPlannedHours])

  const handleAdd = async () => {
    if (!canAdd) return
    setSaving(true)
    try {
      const { data: userResp } = await supabase.auth.getUser()
      const userId = userResp.user?.id
      if (!userId) throw new Error("Пользователь не найден")

      const nextOrder = (items[items.length - 1]?.decomposition_item_order ?? -1) + 1
      // Поиск ответственного по введённому тексту
      let responsibleId: string | null = null
      if (newResponsibleSearch.trim().length > 0) {
        const val = newResponsibleSearch.trim().toLowerCase()
        const match = profiles.find(p => getProfileName(p).toLowerCase() === val) ||
                      profiles.find(p => getProfileName(p).toLowerCase().startsWith(val)) ||
                      profiles.find(p => getProfileName(p).toLowerCase().includes(val))
        responsibleId = match ? match.user_id : null
      }
      const { error } = await supabase
        .from("decomposition_items")
        .insert({
          decomposition_item_section_id: sectionId,
          decomposition_item_description: newDescription.trim(),
          decomposition_item_work_category_id: newCategoryId,
          decomposition_item_planned_hours: Number(newPlannedHours),
          decomposition_item_planned_due_date: newPlannedDueDate || null,
          decomposition_item_responsible: responsibleId,
          decomposition_item_status_id: newStatusId || null,
          decomposition_item_progress: Number(newProgress) || 0,
          decomposition_item_order: nextOrder,
          decomposition_item_created_by: userId,
        })

      if (error) throw error

      // Reload
      const { data, error: reloadErr } = await supabase
        .from("decomposition_items")
        .select(`
          decomposition_item_id, 
          decomposition_item_description, 
          decomposition_item_work_category_id, 
          decomposition_item_planned_hours, 
          decomposition_item_planned_due_date, 
          decomposition_item_order,
          decomposition_item_responsible,
          decomposition_item_status_id,
          decomposition_item_progress,
          profiles!decomposition_item_responsible (
            user_id,
            first_name,
            last_name,
            email
          ),
          section_statuses!decomposition_item_status_id (
            id,
            name,
            color,
            description
          )
        `)
        .eq("decomposition_item_section_id", sectionId)
        .order("decomposition_item_order", { ascending: true })
        .order("decomposition_item_created_at", { ascending: true })

      if (reloadErr) throw reloadErr
      
      // Обрабатываем данные и нормализуем profiles и статусы
      const normalizedReloadItems = (data || []).map((item: any) => ({
        ...item,
        responsible_profile: item.profiles || null,
        status: item.section_statuses || null
      })) as DecompositionItemRow[]
      
      setItems(normalizedReloadItems)

      setNewDescription("")
      setNewCategoryId("")
      setNewPlannedHours("")
      setNewPlannedDueDate("")
      setNewResponsibleSearch("")
      setNewProgress("0")
      // Сбрасываем статус на "План" (по умолчанию)
      const defaultStatus = statuses.find(s => s.name === "План")
      if (defaultStatus) {
        setNewStatusId(defaultStatus.id)
      }
      setNotification("Строка декомпозиции добавлена")
    } catch (error) {
      console.error("Ошибка добавления строки декомпозиции:", error)
      setNotification("Ошибка добавления строки декомпозиции")
    } finally {
      setSaving(false)
    }
  }

  const startEdit = (item: DecompositionItemRow) => {
    setEditingId(item.decomposition_item_id)
    setEditDraft({ ...item })
    setResponsibleSearch(getResponsibleName(item) || "")
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditDraft(null)
  }

  const handleEditKey = (e: KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault()
      if (editingId) {
        saveEdit()
      } else if (canAdd) {
        handleAdd()
      }
    }
  }

  const saveEdit = async () => {
    await saveEditWithPatch()
  }

  // Мгновенное сохранение отдельных полей (категория/ответственный/статус)
  const updateItemFields = async (
    id: string,
    patch: Partial<Pick<DecompositionItemRow,
      'decomposition_item_work_category_id' | 'decomposition_item_responsible' | 'decomposition_item_status_id'>>
  ) => {
    try {
      setSavingId(id)
      const { error } = await supabase
        .from('decomposition_items')
        .update(patch)
        .eq('decomposition_item_id', id)
      if (error) throw error
      // Добавляем производные поля для локального отображения
      const derived: Partial<DecompositionItemRow> = {}
      if (patch && Object.prototype.hasOwnProperty.call(patch, 'decomposition_item_responsible')) {
        const rid = patch.decomposition_item_responsible as (string | null | undefined)
        derived.responsible_profile = rid ? (profiles.find(p => p.user_id === rid) || null) : null
      }
      if (patch && Object.prototype.hasOwnProperty.call(patch, 'decomposition_item_status_id')) {
        const sid = patch.decomposition_item_status_id as (string | null | undefined)
        derived.status = sid ? (statuses.find(s => s.id === sid) || null) : null
      }
      setItems(prev => prev.map(i => i.decomposition_item_id === id ? { ...i, ...(patch || {}), ...derived } : i))
      if (editDraft && editDraft.decomposition_item_id === id) setEditDraft({ ...editDraft, ...(patch || {}) } as DecompositionItemRow)
      setNotification('Изменения сохранены')
    } catch (e) {
      console.error('Ошибка сохранения поля:', e)
      setNotification('Ошибка сохранения')
    } finally {
      setSavingId(null)
    }
  }

  // Сохранение с объединением патча (чтобы избежать гонок setState)
  const saveEditWithPatch = async (patch?: Partial<DecompositionItemRow>) => {
    if (!editingId || !editDraft) return
    const merged: DecompositionItemRow = { ...editDraft, ...(patch || {}) } as DecompositionItemRow
    setSavingId(editingId)
    try {
      const { error } = await supabase
        .from('decomposition_items')
        .update({
          decomposition_item_description: merged.decomposition_item_description,
          decomposition_item_work_category_id: merged.decomposition_item_work_category_id,
          decomposition_item_planned_hours: Number(merged.decomposition_item_planned_hours),
          decomposition_item_planned_due_date: merged.decomposition_item_planned_due_date,
          decomposition_item_responsible: merged.decomposition_item_responsible,
          decomposition_item_status_id: merged.decomposition_item_status_id,
          decomposition_item_progress: Number(merged.decomposition_item_progress) || 0,
        })
        .eq('decomposition_item_id', editingId)
      if (error) throw error

      const enriched: DecompositionItemRow = {
        ...merged,
        responsible_profile: merged.decomposition_item_responsible
          ? (profiles.find(p => p.user_id === merged.decomposition_item_responsible) || null)
          : null,
        status: merged.decomposition_item_status_id
          ? (statuses.find(s => s.id === merged.decomposition_item_status_id) || null)
          : null,
      }
      setItems(prev => prev.map(i => (i.decomposition_item_id === editingId ? enriched : i)))
      setNotification('Изменения сохранены')
    } catch (e) {
      console.error('Ошибка сохранения строки:', e)
      setNotification('Ошибка сохранения строки')
    } finally {
      setSavingId(null)
      cancelEdit()
    }
  }

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    try {
      const { error } = await supabase
        .from("decomposition_items")
        .delete()
        .eq("decomposition_item_id", id)
      if (error) throw error

      setItems(prev => prev.filter(i => i.decomposition_item_id !== id))
      setNotification("Строка удалена")
    } catch (error) {
      console.error("Ошибка удаления строки декомпозиции:", error)
      setNotification("Ошибка удаления строки")
    } finally {
      setDeletingId(null)
    }
  }

  // Фиксированная сетка колонок для стабильной вёрстки (Notion-стиль)
  // Единая сетка колонок для идеального выравнивания
  // [шаблон/лог/плюс, описание (растяжение), категория, ответственный, статус, процент, план, факт, срок]
  // Первая колонка max-content: вмещает кнопку "Шаблон" в шапке и иконку лога в строках
  const rowGridClass = compact
    ? "grid grid-cols-[max-content_1fr_160px_150px_100px_64px_72px_88px_136px]"
    : "grid grid-cols-[max-content_1fr_200px_180px_120px_80px_96px_96px_160px]"

  if (loading) {
    return (
      <div className={compact ? "flex items-center justify-center h-16" : "flex items-center justify-center h-24"}>
        <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
      </div>
    )
  }

  return (
    <div className={compact ? "h-full flex flex-col" : "h-full flex flex-col"}>
      {/* Статистика по декомпозиции */}
      {!compact && (
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div className="rounded-lg border dark:border-slate-700 p-3">
          <div className="text-xs text-slate-500 dark:text-slate-400">Строк</div>
          <div className="text-base xl:text-lg font-semibold dark:text-slate-100">{items.length}</div>
        </div>
        <div className="rounded-lg border dark:border-slate-700 p-3">
          <div className="text-xs text-slate-500 dark:text-slate-400">Выполнение плана</div>
          <div className="flex items-center gap-3 mt-1">
            <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
              <div
                className="h-full rounded-full bg-emerald-500"
                style={{ width: `${Math.max(0, Math.min(100, plannedTotal > 0 ? (actualTotal / plannedTotal) * 100 : 0))}%` }}
              />
            </div>
            <div className="text-sm font-medium dark:text-slate-100 tabular-nums min-w-[52px] text-right">
              {Math.max(0, Math.min(100, plannedTotal > 0 ? Math.round((actualTotal / plannedTotal) * 100) : 0))}%
            </div>
          </div>
          <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
            {actualTotal.toFixed(2)} / {plannedTotal.toFixed(2)} ч
          </div>
        </div>
        <div className="rounded-lg border dark:border-slate-700 p-3">
          <div className="text-xs text-slate-500 dark:text-slate-400">Затраты (BYN)</div>
          <div className="text-base xl:text-lg font-semibold dark:text-slate-100">{(sectionTotals?.actual_amount ?? 0).toLocaleString('ru-BY', { style: 'currency', currency: 'BYN', maximumFractionDigits: 0 })}</div>
        </div>
      </div>
      )}

      {/* Диапазон сроков */}
      {!compact && items.length > 0 && (
        <div className="text-xs text-slate-500 dark:text-slate-400">
          Сроки: {(() => {
            const dates = items
              .map(i => i.decomposition_item_planned_due_date)
              .filter(Boolean) as string[]
            if (dates.length === 0) return 'не указаны'
            const min = new Date(Math.min(...dates.map(d => new Date(d).getTime())))
            const max = new Date(Math.max(...dates.map(d => new Date(d).getTime())))
            return `${min.toLocaleDateString('ru-RU')} — ${max.toLocaleDateString('ru-RU')}`
          })()}
        </div>
      )}
      {!compact && (
        <div>
          <h3 className="text-base xl:text-lg font-semibold dark:text-slate-200 text-slate-800">Декомпозиция раздела</h3>
          <p className="text-xs xl:text-sm text-slate-500 dark:text-slate-400">Создавайте и управляйте строками декомпозиции. Все записи автоматически привязываются к текущему разделу.</p>
        </div>
      )}

      <div className="overflow-x-auto">
        <div className={(compact ? "text-[11px] " : "text-sm ") + "w-full min-w-[1120px] border border-slate-200 dark:border-slate-700 rounded-md bg-white dark:bg-slate-900 overflow-hidden"}>
          {/* Шапка */}
          <div className={(compact ? "text-[11px] " : "text-[12px] xl:text-[13px] ") + `sticky top-0 z-[1] bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 ${rowGridClass} items-center ${compact ? 'px-2.5 py-1.5' : 'px-3 py-2'} border-b border-slate-200 dark:border-slate-700`}>
            <div className="flex items-center">
              <button onClick={() => setIsTemplatesOpen(true)} className={`inline-flex items-center ${compact ? 'gap-1.5 h-6 text-[11px]' : 'gap-2 h-7 text-[12px]'} px-2 rounded bg-slate-200/70 hover:bg-slate-300 dark:bg-slate-700/70 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-100`} title="Открыть шаблоны">
                <LayoutTemplate className={compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
                Шаблон
              </button>
            </div>
            <div className="px-2 flex items-center font-medium">{compact ? 'Описание' : 'Описание работ'}</div>
            <div className="px-2 flex items-center font-medium">{compact ? 'Кат.' : 'Категория'}</div>
            <div className="px-2 flex items-center font-medium">{compact ? 'Отв.' : 'Ответственный'}</div>
            <div className="px-2 flex items-center font-medium">{compact ? 'Стат.' : 'Статус'}</div>
            <div className="px-2 text-center flex items-center justify-center font-medium">%</div>
            <div className="px-2 text-center flex items-center justify-center font-medium">План</div>
            <div className="px-2 text-center flex items-center justify-center font-medium">Факт</div>
            <div className="px-2 flex items-center font-medium">Срок</div>
          </div>

          {/* Строки */}
          <div className="divide-y divide-slate-200 dark:divide-slate-700">
            {items.map(item => (
              <div key={item.decomposition_item_id} className={`${rowGridClass} items-center ${compact ? 'px-2.5 py-1.5' : 'px-3 py-2'} hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors`}>
                <div className="flex items-center justify-center relative">
                  <button className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700" title="Добавить отчёт" onClick={() => { setSelectedForLog(item.decomposition_item_id); setIsLogModalOpen(true); }}>
                    <Clock className={compact ? 'h-3.5 w-3.5 text-emerald-600' : 'h-4 w-4 text-emerald-600'} />
                  </button>
                  {logsCountByItemId[item.decomposition_item_id] ? (
                    <span className="absolute -top-1 -right-1 inline-flex items-center justify-center min-w-[14px] h-[14px] rounded-full bg-emerald-600 text-white text-[10px] leading-none px-[4px]">
                      {Math.min(99, logsCountByItemId[item.decomposition_item_id])}
                    </span>
                  ) : null}
                </div>
                <div className={`px-2 dark:text-slate-200 ${compact ? 'text-[12px]' : 'text-[12px] xl:text-[14px]'} hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer rounded transition-colors`} onClick={() => startEdit(item)}>
                  {editingId === item.decomposition_item_id ? (
                    <textarea autoFocus value={editDraft?.decomposition_item_description || ""} onChange={e => setEditDraft(prev => prev ? { ...prev, decomposition_item_description: e.target.value } as DecompositionItemRow : prev)} onKeyDown={handleEditKey} maxLength={MAX_DESC_CHARS} rows={3} className="w-full px-2 py-1.5 border border-slate-300 dark:border-slate-600 rounded-md focus:ring-2 focus:ring-teal-500 focus:border-transparent dark:bg-slate-800 dark:text-white resize-y min-h-[2.5rem] max-h-40" />
                  ) : (
                    <div title={item.decomposition_item_description} className="whitespace-pre-wrap" style={{ display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical" as const, overflow: "hidden", overflowWrap: "anywhere", wordBreak: "break-word" }}>
                      {item.decomposition_item_description}
                    </div>
                  )}
                </div>
                <div className={`px-2 dark:text-slate-200 ${compact ? 'text-[11px]' : 'text-[11px] xl:text-[13px]'} hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer rounded transition-colors`} onClick={() => startEdit(item)}>
                  {editingId === item.decomposition_item_id ? (
                    <select value={editDraft?.decomposition_item_work_category_id || ""} onChange={e => { const v = e.target.value; setEditDraft(prev => prev ? { ...prev, decomposition_item_work_category_id: v } as DecompositionItemRow : prev); updateItemFields(item.decomposition_item_id, { decomposition_item_work_category_id: v }); }} onKeyDown={handleEditKey} className="w-full pl-2 pr-8 py-1.5 border border-slate-300 dark:border-slate-600 rounded-md dark:bg-slate-800 dark:text-white">
                      {categories.map(c => (
                        <option key={c.work_category_id} value={c.work_category_id}>{c.work_category_name}</option>
                      ))}
                    </select>
                  ) : (
                    <span className="inline-block max-w-full truncate rounded-full px-2 py-0.5 text-xs font-medium bg-slate-200 text-slate-700 dark:bg-slate-700/60 dark:text-slate-100">{categoryById.get(item.decomposition_item_work_category_id) || "—"}</span>
                  )}
                </div>
                {/* Колонка ответственного с поиском (Command) */}
                <div className={`px-2 dark:text-slate-200 ${compact ? 'text-[11px]' : 'text-[11px] xl:text-[13px]'} hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer rounded transition-colors`} onClick={() => startEdit(item)}>
                  {editingId === item.decomposition_item_id ? (
                    <div className="relative">
                      <input
                        list={`profiles-${item.decomposition_item_id}`}
                        className="w-full pl-2 pr-2 py-1.5 border border-slate-300 dark:border-slate-600 rounded-md dark:bg-slate-800 dark:text-white text-[11px]"
                        placeholder="Начните вводить имя"
                        value={responsibleSearch}
                        onChange={(e) => setResponsibleSearch(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            const val = responsibleSearch.trim().toLowerCase()
                            const match = profiles.find(p => getProfileName(p).toLowerCase() === val) ||
                                          profiles.find(p => getProfileName(p).toLowerCase().startsWith(val)) ||
                                          profiles.find(p => getProfileName(p).toLowerCase().includes(val))
                            const selectedId = match ? match.user_id : null
                            setEditDraft(prev => prev ? { ...prev, decomposition_item_responsible: selectedId } as DecompositionItemRow : prev)
                            saveEditWithPatch({ decomposition_item_responsible: selectedId })
                          }
                        }}
                      />
                      <datalist id={`profiles-${item.decomposition_item_id}`}>
                        <option value="" />
                        {profiles.map(p => (
                          <option key={p.user_id} value={getProfileName(p)} />
                        ))}
                      </datalist>
                    </div>
                  ) : (
                    <span className="inline-block max-w-full truncate text-[11px]">
                      {getResponsibleName(item) || "—"}
                    </span>
                  )}
                </div>
                
                {/* Колонка статуса */}
                <div className="px-2 dark:text-slate-200 text-[11px] xl:text-[13px] hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer rounded transition-colors" onClick={() => startEdit(item)}>
                  {editingId === item.decomposition_item_id ? (
                    <select 
                      value={editDraft?.decomposition_item_status_id || ""} 
                      onChange={e => { const v = e.target.value || null; setEditDraft(prev => prev ? { ...prev, decomposition_item_status_id: v } as DecompositionItemRow : prev); updateItemFields(item.decomposition_item_id, { decomposition_item_status_id: v }); }} 
                      onKeyDown={handleEditKey} 
                      className="w-full pl-2 pr-8 py-1.5 border border-slate-300 dark:border-slate-600 rounded-md dark:bg-slate-800 dark:text-white text-[11px]"
                    >
                      {statuses.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  ) : (
                    <span 
                      className="inline-block max-w-full truncate rounded-full px-2 py-0.5 text-[10px] font-medium"
                      style={{ 
                        backgroundColor: item.status?.color || '#6c757d', 
                        color: 'white' 
                      }}
                    >
                      {item.status?.name || "—"}
                    </span>
                  )}
                              </div>
                
                {/* Колонка процента готовности */}
                <div className={`px-2 dark:text-slate-200 text-center tabular-nums ${compact ? 'text-[11px]' : 'text-[11px] xl:text-[13px]'} hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer rounded transition-colors`} onClick={() => startEdit(item)}>
                  {editingId === item.decomposition_item_id ? (
                    <div className="flex items-center justify-center">
                      <input 
                        type="number" 
                        min={0} 
                        max={100} 
                        value={editDraft?.decomposition_item_progress ?? 0} 
                        onChange={e => setEditDraft(prev => prev ? { ...prev, decomposition_item_progress: Math.min(100, Math.max(0, Number(e.target.value))) } as DecompositionItemRow : prev)} 
                        onKeyDown={handleEditKey} 
                        className="w-12 px-1 py-1.5 text-center tabular-nums border border-slate-300 dark:border-slate-600 rounded-md focus:ring-2 focus:ring-teal-500 focus:border-transparent dark:bg-slate-800 dark:text-white text-[11px]" 
                      />
                      <span className="ml-1 text-[10px] text-slate-500">%</span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-20 h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-emerald-500"
                          style={{ width: `${Math.min(100, Math.max(0, Number(item.decomposition_item_progress || 0)))}%` }}
                        />
                      </div>
                      <span className="text-[11px] w-8 text-right">{item.decomposition_item_progress || 0}%</span>
                    </div>
                  )}
                </div>

                <div className={`px-2 dark:text-slate-200 text-center tabular-nums ${compact ? 'text-[11px]' : 'text-[11px] xl:text-[13px]'} hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer rounded transition-colors`} onClick={() => startEdit(item)}>
                  {editingId === item.decomposition_item_id ? (
                    <input type="number" step="0.25" min={0} value={editDraft?.decomposition_item_planned_hours ?? 0} onChange={e => setEditDraft(prev => prev ? { ...prev, decomposition_item_planned_hours: Number(e.target.value) } as DecompositionItemRow : prev)} onKeyDown={handleEditKey} className="w-14 px-2 py-1.5 text-center tabular-nums border border-slate-300 dark:border-slate-600 rounded-md focus:ring-2 focus:ring-teal-500 focus:border-transparent dark:bg-slate-800 dark:text-white" />
                  ) : (
                    Number(item.decomposition_item_planned_hours).toFixed(2)
                  )}
                </div>
                <div className="px-2 dark:text-slate-200 text-center tabular-nums text-[11px] xl:text-[13px]">
                  {(() => {
                    const actual = Number(actualByItemId[item.decomposition_item_id] || 0)
                    const planned = Number(item.decomposition_item_planned_hours || 0)
                    const ratio = planned > 0 ? actual / planned : 0
                    const nearLimit = ratio >= 0.9 && ratio < 1
                    const exceed = ratio >= 1
                    return (
                      <div className="inline-flex items-center justify-center gap-1">
                        <span>{actual.toFixed(2)}</span>
                        {nearLimit && <span title="Достигнуто 90% плана" className="inline-block h-1.5 w-1.5 rounded-full bg-amber-400" />}
                        {exceed && <span title="Превышение плана" className="inline-block h-1.5 w-1.5 rounded-full bg-red-500" />}
                      </div>
                    )
                  })()}
                </div>
                <div className={`px-2 dark:text-slate-200 ${compact ? 'text-[11px]' : 'text-[11px] xl:text-[13px]'} whitespace-nowrap hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer rounded transition-colors`} onClick={() => startEdit(item)}>
                  {editingId === item.decomposition_item_id ? (
                    <div className="flex items-center gap-2 w-full" onClick={e => e.stopPropagation()}>
                      <input 
                        type="date" 
                        value={editDraft?.decomposition_item_planned_due_date || ""} 
                        onChange={e => setEditDraft(prev => prev ? { ...prev, decomposition_item_planned_due_date: e.target.value } as DecompositionItemRow : prev)} 
                        onKeyDown={handleEditKey} 
                        onBlur={saveEdit}
                        className="flex-1 px-2 py-1.5 text-[11px] border border-slate-300 dark:border-slate-600 rounded-md dark:bg-slate-800 dark:text-white"
                      />
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 w-full" onClick={e => e.stopPropagation()}>
                      <span className="truncate">{item.decomposition_item_planned_due_date ? new Date(item.decomposition_item_planned_due_date).toLocaleDateString("ru-RU") : "—"}</span>
                      <div className="ml-auto">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 inline-flex" title="Действия">
                              <MoreHorizontal className="h-4 w-4" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="min-w-[8rem]">
                            <DropdownMenuItem onClick={() => handleDelete(item.decomposition_item_id)} className="text-red-600 focus:text-red-700">
                              {deletingId === item.decomposition_item_id ? (<Loader2 className="h-4 w-4 animate-spin" />) : (<Trash2 className="h-4 w-4" />)}
                              Удалить
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Новая строка */}
            <div className={`${rowGridClass} items-center px-3 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800/60`}>
              {/* Кнопка добавления слева, как в Notion */}
              <div className="flex items-center justify-center">
                <button
                  type="button"
                  disabled={!canAdd}
                  onClick={handleAdd}
                  title={canAdd ? "Добавить строку" : "Введите описание и план"}
                  className="h-7 w-7 inline-flex items-center justify-center rounded-md text-slate-400 hover:text-slate-600 disabled:opacity-40"
                >
                  <PlusCircle className="h-4 w-4" />
                </button>
              </div>
              {/* Описание — плоское поле без рамок */}
              <div className="px-2">
                <input
                  type="text"
                  value={newDescription}
                  onChange={e => setNewDescription(e.target.value)}
                  placeholder="Новая строка — введите описание"
                  maxLength={MAX_DESC_CHARS}
                  className="w-full bg-transparent px-1 py-1.5 border border-transparent focus:border-slate-300 focus:ring-0 rounded-md dark:text-white"
                  onKeyDown={handleEditKey}
                />
              </div>
              {/* Категория — лаконичный select */}
              <div className="px-2">
                <select
                  value={newCategoryId}
                  onChange={e => setNewCategoryId(e.target.value)}
                  className="w-full bg-transparent pl-2 pr-6 py-1.5 border border-transparent focus:border-slate-300 rounded-md text-slate-600 dark:text-slate-200"
                  onKeyDown={handleEditKey}
                >
                  <option value="">Категория</option>
                  {categories.map(c => (
                    <option key={c.work_category_id} value={c.work_category_id}>{c.work_category_name}</option>
                  ))}
                </select>
              </div>
              {/* Ответственный — поиск по тексту */}
              <div className="px-2">
                <input
                  list="new-row-profiles"
                  className="w-full bg-transparent pl-2 pr-2 py-1.5 border border-transparent focus:border-slate-300 rounded-md text-slate-600 dark:text-slate-200"
                  placeholder="Ответственный"
                  value={newResponsibleSearch}
                  onChange={(e) => setNewResponsibleSearch(e.target.value)}
                  onKeyDown={handleEditKey}
                />
                <datalist id="new-row-profiles">
                  <option value="" />
                  {profiles.map(p => (
                    <option key={p.user_id} value={getProfileName(p)} />
                  ))}
                </datalist>
              </div>
              {/* Статус — простой select */}
              <div className="px-2">
                <select
                  value={newStatusId}
                  onChange={e => setNewStatusId(e.target.value)}
                  className="w-full bg-transparent pl-2 pr-6 py-1.5 border border-transparent focus:border-slate-300 rounded-md text-slate-600 dark:text-slate-200"
                  onKeyDown={handleEditKey}
                >
                  {statuses.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
                  </div>
              
              {/* Процент готовности — компактный инпут */}
              <div className="px-2">
                <div className="flex items-center justify-center">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={newProgress}
                    onChange={e => setNewProgress(Math.min(100, Math.max(0, Number(e.target.value))).toString())}
                    placeholder="0"
                    className="w-12 text-center tabular-nums bg-transparent px-1 py-1.5 border border-transparent focus:border-slate-300 rounded-md dark:text-white text-[11px]"
                    onKeyDown={handleEditKey}
                  />
                  <span className="ml-1 text-[10px] text-slate-500">%</span>
                </div>
              </div>

              {/* План, ч — компактный инпут */}
              <div className="px-2">
                <input
                  type="number"
                  step="0.25"
                  min="0"
                  value={newPlannedHours}
                  onChange={e => setNewPlannedHours(e.target.value)}
                  placeholder="0"
                  className="w-[72px] text-center tabular-nums bg-transparent px-2 py-1.5 border border-transparent focus:border-slate-300 rounded-md dark:text-white"
                  onKeyDown={handleEditKey}
                />
              </div>
              {/* Факт для новой строки */}
              <div className="px-2 text-center text-slate-400">—</div>
              {/* Дата — плоский date input */}
              <div className="px-2">
                <input
                  type="date"
                  value={newPlannedDueDate}
                  onChange={e => setNewPlannedDueDate(e.target.value)}
                  className="bg-transparent px-2 py-1.5 border border-transparent focus:border-slate-300 rounded-md text-slate-600 dark:text-slate-200"
                  onKeyDown={handleEditKey}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
      {!compact && (
        <div className="mt-2 flex items-center justify-start">
          <div className="text-xs text-slate-500 dark:text-slate-400">Подсказка: кликните по любому полю для редактирования. Enter — сохранить изменения.</div>
        </div>
      )}

      {/* Нижняя фиксированная панель итогов */}
      <div className="mt-3 sticky bottom-0 z-[1] bg-white/95 dark:bg-slate-900/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 dark:supports-[backdrop-filter]:bg-slate-900/80 border-t border-slate-200 dark:border-slate-700">
        <div className="px-3 py-2">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <div className="rounded-md border dark:border-slate-700 p-2">
              <div className="text-[10px] text-slate-500 dark:text-slate-400">Всего строк</div>
              <div className="text-sm font-semibold dark:text-slate-100">{items.length}</div>
            </div>
            <div className="rounded-md border dark:border-slate-700 p-2">
              <div className="text-[10px] text-slate-500 dark:text-slate-400">План/Факт</div>
              <div className="flex items-center gap-2">
                <div className="w-24 h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                  <div className="h-full rounded-full bg-emerald-500" style={{ width: `${completionPercent}%` }} />
                </div>
                <div className="text-sm font-medium dark:text-slate-100 tabular-nums">{actualTotal.toFixed(2)} / {plannedTotal.toFixed(2)} ч</div>
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">{completionPercent}% выполнено</div>
            </div>
            <div className="rounded-md border dark:border-slate-700 p-2">
              <div className="text-[10px] text-slate-500 dark:text-slate-400">Сроки</div>
              <div className="text-sm font-semibold dark:text-slate-100">{dateRange ? `${dateRange.minText} — ${dateRange.maxText}` : 'не указаны'}</div>
            </div>
            <div className="rounded-md border dark:border-slate-700 p-2">
              <div className="text-[10px] text-slate-500 dark:text-slate-400">Бюджет, BYN</div>
              <div className="text-sm font-semibold dark:text-slate-100">{(sectionTotals?.actual_amount ?? 0).toLocaleString('ru-BY', { style: 'currency', currency: 'BYN', maximumFractionDigits: 0 })}</div>
            </div>
          </div>
        </div>
      </div>

      <AddWorkLogModal
        isOpen={isLogModalOpen}
        onClose={() => setIsLogModalOpen(false)}
        sectionId={sectionId}
        defaultItemId={selectedForLog}
        onSuccess={async () => {
          // Обновим статистику и список
          const { data, error } = await supabase
            .from("decomposition_items")
            .select(`
              decomposition_item_id,
              decomposition_item_description,
              decomposition_item_work_category_id,
              decomposition_item_planned_hours,
              decomposition_item_planned_due_date,
              decomposition_item_order,
              decomposition_item_responsible,
              decomposition_item_status_id,
              decomposition_item_progress,
              profiles!decomposition_item_responsible (
                user_id,
                first_name,
                last_name,
                email
              ),
              section_statuses!decomposition_item_status_id (
                id,
                name,
                color,
                description
              )
            `)
            .eq("decomposition_item_section_id", sectionId)
            .order("decomposition_item_order", { ascending: true })
            .order("decomposition_item_created_at", { ascending: true })
          if (!error) {
            const normalized = ((data as any[]) || []).map((item: any) => ({
              ...item,
              responsible_profile: item.profiles || null,
              status: item.section_statuses || null,
            }))
            setItems(normalized as any)
          }
          // Обновим сводные по секции
          const totals = await supabase
            .from('view_section_decomposition_totals')
            .select('planned_hours, actual_hours, actual_amount')
            .eq('section_id', sectionId)
            .single()
          if (!totals.error) {
            setSectionTotals({
              planned_hours: Number(totals.data?.planned_hours || 0),
              actual_hours: Number(totals.data?.actual_hours || 0),
              actual_amount: Number(totals.data?.actual_amount || 0),
            })
          }
        }}
      />

      <Dialog open={isTemplatesOpen} onOpenChange={setIsTemplatesOpen}>
        <DialogContent className="w-[96vw] max-w-[1400px]">
          <DialogHeader>
            <DialogTitle>Шаблоны декомпозиции</DialogTitle>
          </DialogHeader>
          <TemplatesPanel
            departmentId={departmentId}
            sectionId={sectionId}
            onApplied={async ({ inserted }) => {
              // Перезагрузка списка после применения шаблона
              const { data, error } = await supabase
                .from("decomposition_items")
                .select(`
                  decomposition_item_id,
                  decomposition_item_description,
                  decomposition_item_work_category_id,
                  decomposition_item_planned_hours,
                  decomposition_item_planned_due_date,
                  decomposition_item_order,
                  decomposition_item_responsible,
                  decomposition_item_status_id,
                  decomposition_item_progress,
                  profiles!decomposition_item_responsible (
                    user_id,
                    first_name,
                    last_name,
                    email
                  ),
                  section_statuses!decomposition_item_status_id (
                    id,
                    name,
                    color,
                    description
                  )
                `)
                .eq("decomposition_item_section_id", sectionId)
                .order("decomposition_item_order", { ascending: true })
                .order("decomposition_item_created_at", { ascending: true })
              if (!error) {
                const normalized = ((data as any[]) || []).map((item: any) => ({
                  ...item,
                  responsible_profile: item.profiles || null,
                  status: item.section_statuses || null,
                }))
                setItems(normalized as any)
              }
              // Обновим сводные по секции
              const totals = await supabase
                .from('view_section_decomposition_totals')
                .select('planned_hours, actual_hours, actual_amount')
                .eq('section_id', sectionId)
                .single()
              if (!totals.error) {
                setSectionTotals({
                  planned_hours: Number(totals.data?.planned_hours || 0),
                  actual_hours: Number(totals.data?.actual_hours || 0),
                  actual_amount: Number(totals.data?.actual_amount || 0),
                })
              }
              setIsTemplatesOpen(false)
              setNotification(`Шаблон применён. Добавлено строк: ${inserted}`)
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default SectionDecompositionTab

