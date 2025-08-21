"use client"

import React, { useEffect, useMemo, useState, KeyboardEvent, useRef } from "react"
import { createClient } from "@/utils/supabase/client"
import { Loader2, MoreHorizontal, Pencil, Trash2, Check, X, PlusCircle, Clock, Calendar as CalendarIcon, LayoutTemplate } from "lucide-react"
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

interface SectionDecompositionTabProps {
  sectionId: string
  compact?: boolean
}

interface WorkCategory {
  work_category_id: string
  work_category_name: string
}

interface DecompositionItemRow {
  decomposition_item_id: string
  decomposition_item_description: string
  decomposition_item_work_category_id: string
  decomposition_item_planned_hours: number
  decomposition_item_planned_due_date: string | null
  decomposition_item_order: number
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
  const [sectionTotals, setSectionTotals] = useState<{ planned_hours: number; actual_hours: number; actual_amount: number } | null>(null)

  const [newDescription, setNewDescription] = useState("")
  const [newCategoryId, setNewCategoryId] = useState("")
  const [newPlannedHours, setNewPlannedHours] = useState("")
  const [newPlannedDueDate, setNewPlannedDueDate] = useState("")

  // Inline edit state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<DecompositionItemRow | null>(null)
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
        const [cats, rows, totals] = await Promise.all([
          supabase
            .from("work_categories")
            .select("work_category_id, work_category_name")
            .order("work_category_name", { ascending: true }),
          supabase
            .from("decomposition_items")
            .select(
              "decomposition_item_id, decomposition_item_description, decomposition_item_work_category_id, decomposition_item_planned_hours, decomposition_item_planned_due_date, decomposition_item_order"
            )
            .eq("decomposition_item_section_id", sectionId)
            .order("decomposition_item_order", { ascending: true })
            .order("decomposition_item_created_at", { ascending: true }),
          supabase
            .from("view_section_decomposition_totals")
            .select("planned_hours, actual_hours, actual_amount")
            .eq("section_id", sectionId)
            .single()
        ])

        if (cats.error) throw cats.error
        if (rows.error) throw rows.error
        if (!totals.error) {
          setSectionTotals({
            planned_hours: Number(totals.data?.planned_hours || 0),
            actual_hours: Number(totals.data?.actual_hours || 0),
            actual_amount: Number(totals.data?.actual_amount || 0),
          })
        }

        setCategories(cats.data || [])
        setItems((rows.data as DecompositionItemRow[]) || [])
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
        return
      }
      const ids = items.map(i => i.decomposition_item_id)
      const { data, error } = await supabase
        .from('view_decomposition_item_actuals')
        .select('decomposition_item_id, actual_hours')
        .in('decomposition_item_id', ids)

      if (error) {
        console.error('Ошибка загрузки факта из view:', error)
        return
      }
      const agg: Record<string, number> = {}
      for (const row of (data as any[]) || []) {
        const key = row.decomposition_item_id as string
        const hours = Number(row.actual_hours || 0)
        agg[key] = hours
      }
      setActualByItemId(agg)
    }
    loadActuals()
  }, [items])

  const categoryById = useMemo(() => {
    const map = new Map<string, string>()
    categories.forEach(c => map.set(c.work_category_id, c.work_category_name))
    return map
  }, [categories])

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
      const { error } = await supabase
        .from("decomposition_items")
        .insert({
          decomposition_item_section_id: sectionId,
          decomposition_item_description: newDescription.trim(),
          decomposition_item_work_category_id: newCategoryId,
          decomposition_item_planned_hours: Number(newPlannedHours),
          decomposition_item_planned_due_date: newPlannedDueDate || null,
          decomposition_item_order: nextOrder,
          decomposition_item_created_by: userId,
        })

      if (error) throw error

      // Reload
      const { data, error: reloadErr } = await supabase
        .from("decomposition_items")
        .select(
          "decomposition_item_id, decomposition_item_description, decomposition_item_work_category_id, decomposition_item_planned_hours, decomposition_item_planned_due_date, decomposition_item_order"
        )
        .eq("decomposition_item_section_id", sectionId)
        .order("decomposition_item_order", { ascending: true })
        .order("decomposition_item_created_at", { ascending: true })

      if (reloadErr) throw reloadErr
      setItems((data as DecompositionItemRow[]) || [])

      setNewDescription("")
      setNewCategoryId("")
      setNewPlannedHours("")
      setNewPlannedDueDate("")
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
    if (!editingId || !editDraft) return
    setSavingId(editingId)
    try {
      const { error } = await supabase
        .from("decomposition_items")
        .update({
          decomposition_item_description: editDraft.decomposition_item_description,
          decomposition_item_work_category_id: editDraft.decomposition_item_work_category_id,
          decomposition_item_planned_hours: Number(editDraft.decomposition_item_planned_hours),
          decomposition_item_planned_due_date: editDraft.decomposition_item_planned_due_date,
        })
        .eq("decomposition_item_id", editingId)

      if (error) throw error

      setItems(prev => prev.map(i => (i.decomposition_item_id === editingId ? { ...editDraft } : i)))
      setNotification("Изменения сохранены")
    } catch (error) {
      console.error("Ошибка сохранения строки:", error)
      setNotification("Ошибка сохранения строки")
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
  // [шаблон/лог/плюс, описание (растяжение), категория, план, факт, срок]
  // Первая колонка max-content: вмещает кнопку "Шаблон" в шапке и иконку лога в строках
  const rowGridClass = "grid grid-cols-[max-content_1fr_240px_96px_96px_160px]"

  if (loading) {
    return (
      <div className={compact ? "flex items-center justify-center h-16" : "flex items-center justify-center h-24"}>
        <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
      </div>
    )
  }

  return (
    <div className={compact ? "space-y-3" : "space-y-6"}>
      {/* Статистика по декомпозиции */}
      {!compact && (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-lg border dark:border-slate-700 p-3">
          <div className="text-xs text-slate-500 dark:text-slate-400">Строк</div>
          <div className="text-base xl:text-lg font-semibold dark:text-slate-100">{items.length}</div>
        </div>
        <div className="rounded-lg border dark:border-slate-700 p-3">
          <div className="text-xs text-slate-500 dark:text-slate-400">План (ч)</div>
          <div className="text-base xl:text-lg font-semibold dark:text-slate-100">{items.reduce((s, i) => s + Number(i.decomposition_item_planned_hours || 0), 0).toFixed(2)}</div>
        </div>
        <div className="rounded-lg border dark:border-slate-700 p-3">
          <div className="text-xs text-slate-500 dark:text-slate-400">Факт (ч)</div>
          <div className="text-base xl:text-lg font-semibold dark:text-slate-100">{(sectionTotals?.actual_hours ?? 0).toFixed(2)}</div>
        </div>
        <div className="rounded-lg border dark:border-slate-700 p-3">
          <div className="text-xs text-slate-500 dark:text-slate-400">Затраты (₽)</div>
          <div className="text-base xl:text-lg font-semibold dark:text-slate-100">{(sectionTotals?.actual_amount ?? 0).toLocaleString("ru-RU", { maximumFractionDigits: 0 })}</div>
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
        <div className={(compact ? "text-xs " : "text-sm ") + "w-full min-w-[960px] border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 overflow-hidden"}>
          {/* Шапка */}
          <div className={(compact ? "text-[12px] " : "text-[12px] xl:text-[13px] ") + `sticky top-0 z-[1] bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 ${rowGridClass} items-center px-3 py-2 border-b border-slate-200 dark:border-slate-700`}>
            <div className="flex items-center">
              <button onClick={() => setIsTemplatesOpen(true)} className="inline-flex items-center gap-2 h-7 px-2 rounded-md bg-slate-200/70 hover:bg-slate-300 dark:bg-slate-700/70 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-100 text-[12px]" title="Открыть шаблоны">
                <LayoutTemplate className="h-4 w-4" />
                Шаблон
              </button>
            </div>
            <div className="px-2 flex items-center font-medium">Описание работ</div>
            <div className="px-2 flex items-center font-medium">Категория</div>
            <div className="px-2 text-center flex items-center justify-center font-medium">План</div>
            <div className="px-2 text-center flex items-center justify-center font-medium">Факт</div>
            <div className="px-2 flex items-center font-medium">Срок</div>
          </div>

          {/* Строки */}
          <div className="divide-y divide-slate-200 dark:divide-slate-700">
            {items.map(item => (
              <div key={item.decomposition_item_id} className={`${rowGridClass} items-center px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors`}>
                <div className="flex items-center justify-center">
                  <button className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700" title="Добавить отчёт" onClick={() => { setSelectedForLog(item.decomposition_item_id); setIsLogModalOpen(true); }}>
                    <Clock className="h-4 w-4 text-emerald-600" />
                  </button>
                </div>
                <div className="px-2 dark:text-slate-200 text-[12px] xl:text-[14px]" onClick={() => startEdit(item)}>
                  {editingId === item.decomposition_item_id ? (
                    <textarea autoFocus value={editDraft?.decomposition_item_description || ""} onChange={e => setEditDraft(prev => prev ? { ...prev, decomposition_item_description: e.target.value } as DecompositionItemRow : prev)} onKeyDown={handleEditKey} maxLength={MAX_DESC_CHARS} rows={3} className="w-full px-2 py-1.5 border border-slate-300 dark:border-slate-600 rounded-md focus:ring-2 focus:ring-teal-500 focus:border-transparent dark:bg-slate-800 dark:text-white resize-y min-h-[2.5rem] max-h-40" />
                  ) : (
                    <div title={item.decomposition_item_description} className="whitespace-pre-wrap" style={{ display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical" as const, overflow: "hidden", overflowWrap: "anywhere", wordBreak: "break-word" }}>
                      {item.decomposition_item_description}
                    </div>
                  )}
                </div>
                <div className="px-2 dark:text-slate-200 text-[11px] xl:text-[13px]" onClick={() => startEdit(item)}>
                  {editingId === item.decomposition_item_id ? (
                    <select value={editDraft?.decomposition_item_work_category_id || ""} onChange={e => setEditDraft(prev => prev ? { ...prev, decomposition_item_work_category_id: e.target.value } as DecompositionItemRow : prev)} onKeyDown={handleEditKey} className="w-full pl-2 pr-8 py-1.5 border border-slate-300 dark:border-slate-600 rounded-md dark:bg-slate-800 dark:text-white">
                      {categories.map(c => (
                        <option key={c.work_category_id} value={c.work_category_id}>{c.work_category_name}</option>
                      ))}
                    </select>
                  ) : (
                    <span className="inline-block max-w-full truncate rounded-full px-2 py-0.5 text-xs font-medium bg-slate-200 text-slate-700 dark:bg-slate-700/60 dark:text-slate-100">{categoryById.get(item.decomposition_item_work_category_id) || "—"}</span>
                  )}
                </div>
                <div className="px-2 dark:text-slate-200 text-center tabular-nums text-[11px] xl:text-[13px]" onClick={() => startEdit(item)}>
                  {editingId === item.decomposition_item_id ? (
                    <input type="number" step="0.25" min={0} value={editDraft?.decomposition_item_planned_hours ?? 0} onChange={e => setEditDraft(prev => prev ? { ...prev, decomposition_item_planned_hours: Number(e.target.value) } as DecompositionItemRow : prev)} onKeyDown={handleEditKey} className="w-16 px-2 py-1.5 text-center tabular-nums border border-slate-300 dark:border-slate-600 rounded-md focus:ring-2 focus:ring-teal-500 focus:border-transparent dark:bg-slate-800 dark:text-white" />
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
                <div className="px-2 dark:text-slate-200 text-[11px] xl:text-[13px] whitespace-nowrap" onClick={() => startEdit(item)}>
                  {editingId === item.decomposition_item_id ? (
                    <div className="flex items-center gap-2 w-full" onClick={e => e.stopPropagation()}>
                      <button type="button" onClick={(e) => { const input = (e.currentTarget.nextSibling as HTMLInputElement | null); input?.showPicker?.(); input?.focus() }} title="Выбрать дату" className="inline-flex items-center justify-center h-8 w-8 rounded-md border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700">
                        <CalendarIcon className="h-4 w-4" />
                      </button>
                      <input type="date" value={editDraft?.decomposition_item_planned_due_date || ""} onChange={e => setEditDraft(prev => prev ? { ...prev, decomposition_item_planned_due_date: e.target.value } as DecompositionItemRow : prev)} onKeyDown={handleEditKey} className="sr-only" />
                      <div className="ml-auto flex items-center gap-1">
                        <button title="Сохранить" className="p-1 rounded text-emerald-600 hover:bg-emerald-50 disabled:opacity-50" onClick={saveEdit} disabled={savingId === item.decomposition_item_id}>
                          {savingId === item.decomposition_item_id ? (<Loader2 className="h-4 w-4 animate-spin" />) : (<Check className="h-4 w-4" />)}
                        </button>
                        <button title="Отмена" className="p-1 rounded text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700" onClick={cancelEdit}>
                          <X className="h-4 w-4" />
                        </button>
                      </div>
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
                            <DropdownMenuItem onClick={() => startEdit(item)}>
                              <Pencil className="h-4 w-4" /> Редактировать
                            </DropdownMenuItem>
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
        <div className="flex items-center justify-between">
          <div className="text-xs text-slate-500 dark:text-slate-400">Подсказка: нажмите Enter, чтобы сохранить изменения или добавить новую строку.</div>
          <button
            onClick={() => { setSelectedForLog(null); setIsLogModalOpen(true); }}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm rounded-md bg-emerald-600 text-white hover:bg-emerald-700"
          >
            <PlusCircle className="h-4 w-4" /> Добавить отчёт
          </button>
        </div>
      )}

      <AddWorkLogModal
        isOpen={isLogModalOpen}
        onClose={() => setIsLogModalOpen(false)}
        sectionId={sectionId}
        defaultItemId={selectedForLog}
        onSuccess={async () => {
          // Обновим статистику и список
          const { data, error } = await supabase
            .from("decomposition_items")
            .select(
              "decomposition_item_id, decomposition_item_description, decomposition_item_work_category_id, decomposition_item_planned_hours, decomposition_item_planned_due_date, decomposition_item_order"
            )
            .eq("decomposition_item_section_id", sectionId)
            .order("decomposition_item_order", { ascending: true })
            .order("decomposition_item_created_at", { ascending: true })
          if (!error) setItems((data as any) || [])
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
        <DialogContent className="max-w-3xl">
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
                .select(
                  "decomposition_item_id, decomposition_item_description, decomposition_item_work_category_id, decomposition_item_planned_hours, decomposition_item_planned_due_date, decomposition_item_order"
                )
                .eq("decomposition_item_section_id", sectionId)
                .order("decomposition_item_order", { ascending: true })
                .order("decomposition_item_created_at", { ascending: true })
              if (!error) setItems((data as any) || [])
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

