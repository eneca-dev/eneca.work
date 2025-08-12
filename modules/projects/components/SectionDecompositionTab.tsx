"use client"

import React, { useEffect, useMemo, useState, KeyboardEvent } from "react"
import { createClient } from "@/utils/supabase/client"
import { Loader2, MoreHorizontal, Pencil, Trash2, Check, X, PlusCircle } from "lucide-react"
import { useUiStore } from "@/stores/useUiStore"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import AddWorkLogModal from "./AddWorkLogModal"

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
          <div className="text-lg font-semibold dark:text-slate-100">{items.length}</div>
        </div>
        <div className="rounded-lg border dark:border-slate-700 p-3">
          <div className="text-xs text-slate-500 dark:text-slate-400">План (ч)</div>
          <div className="text-lg font-semibold dark:text-slate-100">{items.reduce((s, i) => s + Number(i.decomposition_item_planned_hours || 0), 0).toFixed(2)}</div>
        </div>
        <div className="rounded-lg border dark:border-slate-700 p-3">
          <div className="text-xs text-slate-500 dark:text-slate-400">Факт (ч)</div>
          <div className="text-lg font-semibold dark:text-slate-100">{(sectionTotals?.actual_hours ?? 0).toFixed(2)}</div>
        </div>
        <div className="rounded-lg border dark:border-slate-700 p-3">
          <div className="text-xs text-slate-500 dark:text-slate-400">Затраты (₽)</div>
          <div className="text-lg font-semibold dark:text-slate-100">{(sectionTotals?.actual_amount ?? 0).toLocaleString("ru-RU", { maximumFractionDigits: 0 })}</div>
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
          <h3 className="text-lg font-semibold dark:text-slate-200 text-slate-800">Декомпозиция раздела</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">Создавайте и управляйте строками декомпозиции. Все записи автоматически привязываются к текущему разделу.</p>
        </div>
      )}

      <div className="overflow-x-auto border rounded-lg dark:border-slate-700">
        <table className={compact ? "min-w-full text-xs table-fixed border-collapse" : "min-w-full text-sm table-fixed border-collapse"}>
          <colgroup>
            <col className="w-[64%]" />
            <col className="w-[18%]" />
            <col className="w-[7%]" />
            <col className="w-[9%]" />
            <col className="w-[2%]" />
          </colgroup>
          <thead className={compact ? "bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200" : "bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 sticky top-0 z-[1]"}>
            <tr>
              <th className="px-3 py-2 text-left border-b border-slate-200 dark:border-slate-700">Описание работ</th>
              <th className="px-3 py-2 text-left border-b border-slate-200 dark:border-slate-700">Категория</th>
              <th className="px-3 py-2 text-center border-b border-slate-200 dark:border-slate-700">План, ч</th>
              <th className="px-3 py-2 text-center border-b border-slate-200 dark:border-slate-700">Срок</th>
              <th className="px-3 py-2 text-right border-b border-slate-200 dark:border-slate-700"><span className="sr-only">Действия</span></th>
            </tr>
          </thead>
          <tbody>
            {items.map(item => (
              <tr key={item.decomposition_item_id} className="odd:bg-slate-50/40 dark:odd:bg-slate-800/40 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                {/* Описание */}
                <td className="px-3 py-2 align-top dark:text-slate-200 border-t border-slate-200 dark:border-slate-700" onClick={() => startEdit(item)}>
                  {editingId === item.decomposition_item_id ? (
                    <textarea
                      autoFocus
                      value={editDraft?.decomposition_item_description || ""}
                      onChange={e => setEditDraft(prev => prev ? { ...prev, decomposition_item_description: e.target.value } as DecompositionItemRow : prev)}
                      onKeyDown={handleEditKey}
                      maxLength={MAX_DESC_CHARS}
                      rows={3}
                      className="w-full px-2 py-1.5 border border-slate-300 dark:border-slate-600 rounded-md focus:ring-2 focus:ring-teal-500 focus:border-transparent dark:bg-slate-800 dark:text-white resize-y min-h-[2.5rem] max-h-40"
                    />
                  ) : (
                    <div
                      title={item.decomposition_item_description}
                      className="whitespace-pre-wrap"
                      style={{
                        display: "-webkit-box",
                        WebkitLineClamp: 3,
                        WebkitBoxOrient: "vertical" as const,
                        overflow: "hidden",
                        overflowWrap: "anywhere",
                        wordBreak: "break-word",
                      }}
                    >
                      {item.decomposition_item_description}
                    </div>
                  )}
                </td>
                {/* Категория */}
                <td className="px-3 py-2 dark:text-slate-200 border-t border-slate-200 dark:border-slate-700" onClick={() => startEdit(item)}>
                  {editingId === item.decomposition_item_id ? (
                    <select
                      value={editDraft?.decomposition_item_work_category_id || ""}
                      onChange={e => setEditDraft(prev => prev ? { ...prev, decomposition_item_work_category_id: e.target.value } as DecompositionItemRow : prev)}
                      onKeyDown={handleEditKey}
                      className="w-full px-2 py-1.5 border border-slate-300 dark:border-slate-600 rounded-md dark:bg-slate-800 dark:text-white"
                    >
                      {categories.map(c => (
                        <option key={c.work_category_id} value={c.work_category_id}>{c.work_category_name}</option>
                      ))}
                    </select>
                  ) : (
                    <span className="inline-block max-w-full truncate rounded-full px-2 py-0.5 text-xs font-medium bg-slate-200 text-slate-700 dark:bg-slate-700/60 dark:text-slate-100">
                      {categoryById.get(item.decomposition_item_work_category_id) || "—"}
                    </span>
                  )}
                </td>
                {/* Плановые часы */}
                <td className="px-3 py-2 dark:text-slate-200 text-center tabular-nums border-t border-slate-200 dark:border-slate-700" onClick={() => startEdit(item)}>
                  {editingId === item.decomposition_item_id ? (
                    <input
                      type="number"
                      step="0.25"
                      min={0}
                      value={editDraft?.decomposition_item_planned_hours ?? 0}
                      onChange={e => setEditDraft(prev => prev ? { ...prev, decomposition_item_planned_hours: Number(e.target.value) } as DecompositionItemRow : prev)}
                      onKeyDown={handleEditKey}
                      className="w-16 px-2 py-1.5 text-center tabular-nums border border-slate-300 dark:border-slate-600 rounded-md focus:ring-2 focus:ring-teal-500 focus:border-transparent dark:bg-slate-800 dark:text-white"
                    />
                  ) : (
                    Number(item.decomposition_item_planned_hours).toFixed(2)
                  )}
                </td>
                {/* Плановый срок */}
                <td className="px-3 py-2 dark:text-slate-200 text-center border-t border-slate-200 dark:border-slate-700" onClick={() => startEdit(item)}>
                  {editingId === item.decomposition_item_id ? (
                    <input
                      type="date"
                      value={editDraft?.decomposition_item_planned_due_date || ""}
                      onChange={e => setEditDraft(prev => prev ? { ...prev, decomposition_item_planned_due_date: e.target.value } as DecompositionItemRow : prev)}
                      onKeyDown={handleEditKey}
                      className="w-36 px-2 py-1.5 text-center border border-slate-300 dark:border-slate-600 rounded-md focus:ring-2 focus:ring-teal-500 focus:border-transparent dark:bg-slate-800 dark:text-white"
                    />
                  ) : (
                    item.decomposition_item_planned_due_date ? new Date(item.decomposition_item_planned_due_date).toLocaleDateString("ru-RU") : "—"
                  )}
                </td>
                {/* Действия */}
                <td className="px-3 py-2 text-right border-t border-slate-200 dark:border-slate-700">
                  {editingId === item.decomposition_item_id ? (
                    <div className="inline-flex items-center gap-1">
                      <button
                        title="Сохранить"
                        className="p-1 rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
                        onClick={saveEdit}
                        disabled={savingId === item.decomposition_item_id}
                      >
                        {savingId === item.decomposition_item_id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                      </button>
                      <button
                        title="Отмена"
                        className="p-1 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-600"
                        onClick={cancelEdit}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="inline-flex items-center gap-1">
                      <button
                        className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700"
                        title="Добавить отчёт"
                        onClick={() => { setSelectedForLog(item.decomposition_item_id); setIsLogModalOpen(true); }}
                      >
                        <PlusCircle className="h-4 w-4 text-emerald-600" />
                      </button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700"
                            title="Действия"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="min-w-[8rem]">
                          <DropdownMenuItem onClick={() => startEdit(item)}>
                            <Pencil className="h-4 w-4" /> Редактировать
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDelete(item.decomposition_item_id)}
                            className="text-red-600 focus:text-red-700"
                          >
                            {deletingId === item.decomposition_item_id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                            Удалить
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  )}
                </td>
              </tr>
            ))}

            {/* Row for adding new item */}
            <tr className="bg-slate-50/70 dark:bg-slate-800/40">
                <td className="px-3 py-1.5 border-t border-slate-200 dark:border-slate-700">
                <input
                  type="text"
                  value={newDescription}
                  onChange={e => setNewDescription(e.target.value)}
                  placeholder="Описание работ"
                    maxLength={MAX_DESC_CHARS}
                  className="w-full px-2 py-1.5 border border-slate-300 dark:border-slate-600 rounded-md focus:ring-2 focus:ring-teal-500 focus:border-transparent dark:bg-slate-800 dark:text-white"
                  onKeyDown={handleEditKey}
                />
              </td>
              <td className="px-3 py-1.5 border-t border-slate-200 dark:border-slate-700">
                <select
                  value={newCategoryId}
                  onChange={e => setNewCategoryId(e.target.value)}
                  className="w-full px-2 py-1.5 border border-slate-300 dark:border-slate-600 rounded-md dark:bg-slate-800 dark:text-white"
                  onKeyDown={handleEditKey}
                >
                  <option value="">Выберите категорию</option>
                  {categories.map(c => (
                    <option key={c.work_category_id} value={c.work_category_id}>
                      {c.work_category_name}
                    </option>
                  ))}
                </select>
              </td>
              <td className="px-3 py-1.5 border-t border-slate-200 dark:border-slate-700">
                <input
                  type="number"
                  step="0.25"
                  min="0"
                  value={newPlannedHours}
                  onChange={e => setNewPlannedHours(e.target.value)}
                  placeholder="0"
                  className="w-16 px-2 py-1.5 text-center tabular-nums border border-slate-300 dark:border-slate-600 rounded-md focus:ring-2 focus:ring-teal-500 focus:border-transparent dark:bg-slate-800 dark:text-white"
                  onKeyDown={handleEditKey}
                />
              </td>
              <td className="px-3 py-1.5 text-center border-t border-slate-200 dark:border-slate-700">
                <input
                  type="date"
                  value={newPlannedDueDate}
                  onChange={e => setNewPlannedDueDate(e.target.value)}
                  className="w-36 px-2 py-1.5 text-center border border-slate-300 dark:border-slate-600 rounded-md focus:ring-2 focus:ring-teal-500 focus:border-transparent dark:bg-slate-800 dark:text-white"
                  onKeyDown={handleEditKey}
                />
              </td>
              <td className="px-3 py-1.5 text-right border-t border-slate-200 dark:border-slate-700" />
            </tr>
          </tbody>
        </table>
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
        }}
      />
    </div>
  )
}

export default SectionDecompositionTab

