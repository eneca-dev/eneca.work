"use client"

import React, { useEffect, useMemo, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { useDecompositionStore } from "@/modules/decomposition/store"
import type { DecompositionStage } from "@/modules/decomposition/types"
import { createClient } from "@/utils/supabase/client"
import { Clock } from "lucide-react"
import AddWorkLogModal from "./AddWorkLogModal"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useHasPermission } from "@/modules/permissions"
import { DatePicker as ProjectDatePicker } from "@/modules/projects/components/DatePicker"

interface SectionStagesTabProps {
  sectionId: string
}

interface ItemRow {
  id: string
  description: string
  categoryId: string | null
  categoryName: string
  responsibleId: string | null
  responsibleName: string
  statusId: string | null
  statusName: string
  statusColor: string | null
  progress: number
  planned: number
  actual: number
  dueDate: string | null
  stageId: string | null
  logsCount: number
}

export function SectionStagesTab({ sectionId }: SectionStagesTabProps) {
  const supabase = useMemo(() => createClient(), [])
  const {
    stages,
    fetchStages,
    createStage,
  } = useDecompositionStore()

  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState<ItemRow[]>([])
  const [isLogModalOpen, setIsLogModalOpen] = useState(false)
  const [selectedForLog, setSelectedForLog] = useState<string | null>(null)

  // Inline edit state for items
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<ItemRow | null>(null)
  const editDescRef = useRef<HTMLTextAreaElement | null>(null)

  // Dictionaries
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([])
  const [profiles, setProfiles] = useState<{ id: string; name: string; email: string }[]>([])
  const [statuses, setStatuses] = useState<{ id: string; name: string; color: string }[]>([])
  const [respFilter, setRespFilter] = useState("")

  // Permissions similar to decomposition tab
  const canEditDueDate = useHasPermission('dec.items.edit_due_date')
  const canEditPlannedHours = useHasPermission('dec.items.edit_planned_hours')
  const canEditResponsible = useHasPermission('dec.items.edit_responsible')
  const canEditStatus = useHasPermission('dec.items.edit_status')
  const canEditProgress = useHasPermission('dec.items.edit_progress')

  useEffect(() => {
    if (!sectionId) return
    fetchStages(sectionId)
  }, [sectionId, fetchStages])

  useEffect(() => {
    if (!sectionId) return
    const load = async () => {
      setLoading(true)
      try {
        const [catsRes, profRes, statRes] = await Promise.all([
          supabase.from('work_categories').select('work_category_id, work_category_name').order('work_category_name', { ascending: true }),
          supabase.from('profiles').select('user_id, first_name, last_name, email').order('first_name', { ascending: true }),
          supabase.from('section_statuses').select('id, name, color').order('name', { ascending: true }),
        ])
        if (!catsRes.error) setCategories((catsRes.data as any[]).map(c => ({ id: c.work_category_id as string, name: c.work_category_name as string })))
        if (!profRes.error) setProfiles((profRes.data as any[]).map(p => ({ id: p.user_id as string, name: `${p.first_name || ''} ${p.last_name || ''}`.trim() || p.email, email: p.email as string })))
        if (!statRes.error) setStatuses((statRes.data as any[]).map(s => ({ id: s.id as string, name: s.name as string, color: s.color as string })))

        const { data, error } = await supabase
          .from("decomposition_items")
          .select(`
            decomposition_item_id,
            decomposition_item_description,
            decomposition_item_planned_hours,
            decomposition_item_planned_due_date,
            decomposition_item_progress,
            decomposition_item_stage_id,
            decomposition_item_work_category_id,
            decomposition_item_responsible,
            decomposition_item_status_id,
            work_categories:decomposition_item_work_category_id(work_category_name),
            profiles:decomposition_item_responsible(user_id, first_name, last_name, email),
            section_statuses:decomposition_item_status_id(id, name, color)
          `)
          .eq("decomposition_item_section_id", sectionId)
          .order("decomposition_item_order", { ascending: true })
          .order("decomposition_item_created_at", { ascending: true })

        if (error) throw error

        const ids = (data || []).map((r: any) => r.decomposition_item_id)
        const [actuals, logs] = await Promise.all([
          supabase
            .from("view_decomposition_item_actuals")
            .select("decomposition_item_id, actual_hours")
            .in("decomposition_item_id", ids),
          supabase
            .from("view_work_logs_enriched")
            .select("decomposition_item_id, work_log_id")
            .in("decomposition_item_id", ids),
        ])

        const actualById: Record<string, number> = {}
        if (!actuals.error) {
          for (const row of (actuals.data as any[]) || []) {
            actualById[row.decomposition_item_id] = Number(row.actual_hours || 0)
          }
        }
        const logsCountById: Record<string, number> = {}
        if (!logs.error) {
          for (const row of (logs.data as any[]) || []) {
            const key = row.decomposition_item_id as string
            logsCountById[key] = (logsCountById[key] || 0) + 1
          }
        }

        const mapped: ItemRow[] = (data || []).map((r: any) => {
          const pname = (() => {
            if (!r.profiles) return ""
            const full = `${r.profiles.first_name || ''} ${r.profiles.last_name || ''}`.trim()
            return full || r.profiles.email || ""
          })()
          return {
            id: r.decomposition_item_id,
            description: r.decomposition_item_description || "",
            categoryId: r.decomposition_item_work_category_id || null,
            categoryName: r.work_categories?.work_category_name || "—",
            responsibleId: r.decomposition_item_responsible || null,
            responsibleName: pname,
            statusId: r.decomposition_item_status_id || null,
            statusName: r.section_statuses?.name || "—",
            statusColor: r.section_statuses?.color || null,
            progress: Number(r.decomposition_item_progress || 0),
            planned: Number(r.decomposition_item_planned_hours || 0),
            actual: actualById[r.decomposition_item_id] || 0,
            dueDate: r.decomposition_item_planned_due_date || null,
            stageId: r.decomposition_item_stage_id || null,
            logsCount: logsCountById[r.decomposition_item_id] || 0,
          }
        })

        setRows(mapped)
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error("Error loading stage items:", e)
        setRows([])
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [sectionId, supabase])

  const rowsByStage = useMemo(() => {
    const map = new Map<string, ItemRow[]>()
    for (const it of rows) {
      const sid = it.stageId || "__no_stage__"
      if (!map.has(sid)) map.set(sid, [])
      map.get(sid)!.push(it)
    }
    return map
  }, [rows])

  const unassigned = rowsByStage.get("__no_stage__") || []

  const startEdit = (row: ItemRow) => {
    setEditingId(row.id)
    setEditDraft({ ...row })
  }

  useEffect(() => {
    if (!editingId || !editDescRef.current) return
    const el = editDescRef.current
    el.style.height = 'auto'
    el.style.height = Math.min(160, Math.max(28, el.scrollHeight)) + 'px'
  }, [editingId, editDraft?.description])

  const formatISO = (d: Date): string => {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }

  const saveItemPatch = async (id: string, patch: Partial<ItemRow>) => {
    const upd: any = {}
    if (patch.description != null) upd.decomposition_item_description = patch.description
    if (patch.categoryId !== undefined) upd.decomposition_item_work_category_id = patch.categoryId
    if (patch.responsibleId !== undefined && canEditResponsible) upd.decomposition_item_responsible = patch.responsibleId
    if (patch.statusId !== undefined && canEditStatus) upd.decomposition_item_status_id = patch.statusId
    if (patch.progress !== undefined && canEditProgress) upd.decomposition_item_progress = Number(patch.progress) || 0
    if (patch.planned !== undefined && canEditPlannedHours) upd.decomposition_item_planned_hours = Number(patch.planned) || 0
    if (patch.dueDate !== undefined && canEditDueDate) upd.decomposition_item_planned_due_date = patch.dueDate

    if (Object.keys(upd).length === 0) return
    const { error } = await supabase.from('decomposition_items').update(upd).eq('decomposition_item_id', id)
    if (!error) {
      setRows(prev => prev.map(r => r.id === id ? { ...r, ...patch } : r))
      if (editingId === id && editDraft) setEditDraft({ ...editDraft, ...patch } as ItemRow)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Этапы и декомпозиции</h3>
        <Button
          variant="outline"
          size="sm"
          onClick={() => createStage(sectionId, { name: "Новый этап" })}
        >
          Добавить этап
        </Button>
      </div>

      <div className="border rounded-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1120px]">
            <colgroup>
              <col className="w-[44px]" />
              <col className="w-[30%]" />
              <col className="w-[18%]" />
              <col className="w-[16%]" />
              <col className="w-[10%]" />
              <col className="w-[8%]" />
              <col className="w-[9%]" />
              <col className="w-[9%]" />
              <col className="w-[12%]" />
              <col className="w-[36px]" />
            </colgroup>
            <thead className="bg-muted">
              <tr>
                <th className="px-2 py-2 text-left">Отчет</th>
                <th className="px-2 py-2 text-left">Описание работ</th>
                <th className="px-2 py-2 text-left">Категория</th>
                <th className="px-2 py-2 text-left">Ответственный</th>
                <th className="px-2 py-2 text-left">Статус</th>
                <th className="px-2 py-2 text-center">%</th>
                <th className="px-2 py-2 text-center">План, ч</th>
                <th className="px-2 py-2 text-center">Факт, ч</th>
                <th className="px-2 py-2 text-left">Срок</th>
                <th className="px-2 py-2 text-center">…</th>
              </tr>
            </thead>
            <tbody>
              {stages.map((stage: DecompositionStage, idx: number) => {
                const list = rowsByStage.get(stage.decomposition_stage_id) || []
                const plannedSum = list.reduce((s, r) => s + (Number(r.planned) || 0), 0)
                const actualSum = list.reduce((s, r) => s + (Number(r.actual) || 0), 0)
                return (
                  <React.Fragment key={stage.decomposition_stage_id}>
                    <tr className="border-t bg-slate-50 dark:bg-slate-800/40">
                      <td className="px-2 py-2 align-top text-sm">{idx + 1}</td>
                      <td className="px-2 py-2 align-top font-medium" colSpan={3}>
                        {stage.decomposition_stage_name}
                        <div className="text-xs text-muted-foreground mt-1">
                          {(stage.decomposition_stage_start || "—")} → {(stage.decomposition_stage_finish || "—")}
                        </div>
                      </td>
                      <td className="px-2 py-2 align-top text-xs text-muted-foreground" colSpan={2}>
                        {stage.decomposition_stage_description || ""}
                      </td>
                      <td className="px-2 py-2 align-top text-center tabular-nums font-medium">{plannedSum.toFixed(2)}</td>
                      <td className="px-2 py-2 align-top text-center tabular-nums font-medium">{actualSum.toFixed(2)}</td>
                      <td className="px-2 py-2 align-top text-xs text-muted-foreground" colSpan={2}></td>
                    </tr>
                    {list.length === 0 ? (
                      <tr className="border-t">
                        <td colSpan={10} className="px-2 py-2 text-sm text-muted-foreground">Нет строк декомпозиции</td>
                      </tr>
                    ) : (
                      list.map((it) => (
                        <tr key={it.id} className="border-t">
                          {/* Отчет */}
                          <td className="px-2 py-2 align-middle">
                            <div className="relative flex items-center justify-center">
                              <button className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700" title="Добавить отчет" onClick={() => { setSelectedForLog(it.id); setIsLogModalOpen(true) }}>
                                <Clock className={'h-4 w-4 text-emerald-600'} />
                              </button>
                              {it.logsCount ? (
                                <span className="absolute -top-1 -right-1 inline-flex items-center justify-center min-w-[14px] h-[14px] rounded-full bg-emerald-600 text-white text-[10px] leading-none px-[4px]">
                                  {Math.min(99, it.logsCount)}
                                </span>
                              ) : null}
                            </div>
                          </td>
                          {/* Описание */}
                          <td className="px-2 py-2 align-middle" onClick={() => startEdit(it)}>
                            {editingId === it.id ? (
                              <textarea
                                ref={editDescRef}
                                value={editDraft?.description || ''}
                                onChange={(e) => setEditDraft(prev => prev ? { ...prev, description: e.target.value } : prev)}
                                onBlur={() => { if (editDraft) saveItemPatch(it.id, { description: editDraft.description }); setEditingId(null); }}
                                rows={1}
                                className="w-full px-1 py-[6px] bg-transparent border-0 focus:ring-0 focus:border-0 outline-none dark:bg-transparent dark:text-white resize-none"
                              />
                            ) : (
                              <div title={it.description} className="whitespace-pre-wrap line-clamp-3 break-words overflow-hidden">{it.description}</div>
                            )}
                          </td>
                          {/* Категория */}
                          <td className="px-2 py-2 align-middle" onClick={() => startEdit(it)}>
                            {editingId === it.id ? (
                              <Popover>
                                <PopoverTrigger asChild>
                                  <button className="inline-flex flex-wrap items-center text-left whitespace-normal break-words rounded-full px-2 py-0.5 text-xs font-medium bg-slate-200 text-slate-700 dark:bg-slate-700/60 dark:text-slate-100">
                                    {categories.find(c => c.id === (editDraft?.categoryId ?? it.categoryId))?.name || 'Выбрать'}
                                  </button>
                                </PopoverTrigger>
                                <PopoverContent align="start" sideOffset={6} className="p-0 w-[220px] text-[12px] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm">
                                  <ScrollArea className="max-h-[240px]">
                                    <div className="py-1">
                                      {categories.map(c => (
                                        <button key={c.id} className="w-full text-left px-2 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-700/60" onClick={() => { setEditDraft(prev => prev ? { ...prev, categoryId: c.id, categoryName: c.name } : prev); saveItemPatch(it.id, { categoryId: c.id, categoryName: c.name }); }}>
                                          {c.name}
                                        </button>
                                      ))}
                                    </div>
                                  </ScrollArea>
                                </PopoverContent>
                              </Popover>
                            ) : (
                              <span className="inline-block max-w-full whitespace-normal break-words rounded-full px-2 py-0.5 text-xs font-medium bg-slate-200 text-slate-700 dark:bg-slate-700/60 dark:text-slate-100">{it.categoryName || '—'}</span>
                            )}
                          </td>
                          {/* Ответственный */}
                          <td className={`px-2 py-2 align-middle ${canEditResponsible ? '' : 'opacity-70'}`} onClick={() => { if (canEditResponsible) startEdit(it) }}>
                            {editingId === it.id ? (
                              canEditResponsible ? (
                                <Popover>
                                  <PopoverTrigger asChild>
                                    <button className="w-full h-7 px-2 rounded bg-transparent text-left text-[12px] hover:bg-slate-100 dark:hover:bg-slate-800">{editDraft?.responsibleName || it.responsibleName || 'Выбрать'}</button>
                                  </PopoverTrigger>
                                  <PopoverContent align="start" sideOffset={6} className="p-0 w-[260px] text-[12px] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm">
                                    <div className="p-2">
                                      <input value={respFilter} onChange={(e) => setRespFilter(e.target.value)} placeholder="Поиск" className="w-full h-7 px-2 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 outline-none text-[12px]" />
                                    </div>
                                    <ScrollArea className="max-h-[240px]">
                                      <div className="py-1">
                                        {profiles.filter(p => {
                                          const q = respFilter.trim().toLowerCase()
                                          if (!q) return true
                                          return (p.name || p.email).toLowerCase().includes(q)
                                        }).map(p => (
                                          <button key={p.id} className="w-full text-left px-2 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-700/60" onClick={() => { setEditDraft(prev => prev ? { ...prev, responsibleId: p.id, responsibleName: p.name || p.email } : prev); saveItemPatch(it.id, { responsibleId: p.id, responsibleName: p.name || p.email }); setRespFilter('') }}>
                                            {p.name || p.email}
                                          </button>
                                        ))}
                                      </div>
                                    </ScrollArea>
                                  </PopoverContent>
                                </Popover>
                              ) : (
                                <span className="inline-block max-w-full truncate text-[11px]">{it.responsibleName || '—'}</span>
                              )
                            ) : (
                              <span className="inline-block max-w-full truncate text-[11px]">{it.responsibleName || '—'}</span>
                            )}
                          </td>
                          {/* Статус */}
                          <td className={`px-2 py-2 align-middle ${canEditStatus ? '' : 'opacity-70'}`} onClick={() => { if (canEditStatus) startEdit(it) }}>
                            {editingId === it.id ? (
                              canEditStatus ? (
                                <Popover>
                                  <PopoverTrigger asChild>
                                    <button className="inline-flex flex-wrap items-center text-left whitespace-normal break-words rounded-full px-2 py-0.5 text-xs font-medium bg-slate-200 text-slate-700 dark:bg-slate-700/60 dark:text-slate-100">
                                      {statuses.find(s => s.id === (editDraft?.statusId ?? it.statusId))?.name || 'Выбрать'}
                                    </button>
                                  </PopoverTrigger>
                                  <PopoverContent align="start" sideOffset={6} className="p-0 w-[220px] text-[12px] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm">
                                    <div className="py-1">
                                      {statuses.map(s => (
                                        <button key={s.id} className="w-full text-left px-2 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-700/60" onClick={() => { setEditDraft(prev => prev ? { ...prev, statusId: s.id, statusName: s.name, statusColor: s.color } : prev); saveItemPatch(it.id, { statusId: s.id, statusName: s.name, statusColor: s.color }); }}>
                                          {s.name}
                                        </button>
                                      ))}
                                    </div>
                                  </PopoverContent>
                                </Popover>
                              ) : (
                                <span className="inline-block max-w-full whitespace-normal break-words rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ backgroundColor: it.statusColor || '#6c757d', color: 'white' }}>{it.statusName}</span>
                              )
                            ) : (
                              <span className="inline-block max-w-full whitespace-normal break-words rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ backgroundColor: it.statusColor || '#6c757d', color: 'white' }}>{it.statusName}</span>
                            )}
                          </td>
                          {/* % */}
                          <td className={`px-2 py-2 align-middle text-center tabular-nums ${canEditProgress ? '' : 'opacity-70'}`} onClick={() => { if (canEditProgress) startEdit(it) }}>
                            {editingId === it.id ? (
                              canEditProgress ? (
                                <input type="text" value={editDraft?.progress ?? 0} onChange={e => { const v = e.target.value.replace(/[^0-9]/g, ''); const num = Math.max(0, Math.min(100, Number(v || 0))); setEditDraft(prev => prev ? { ...prev, progress: num } : prev) }} onBlur={() => { if (editDraft) saveItemPatch(it.id, { progress: editDraft.progress }) }} className="w-12 px-1 py-1 text-center tabular-nums bg-transparent border-0 outline-none focus:outline-none focus:ring-0 focus:border-0 dark:bg-transparent dark:text-white text-[12px]" />
                              ) : (
                                <div className="flex items-center justify-center gap-2"><div className="w-20 h-2 rounded-full bg-slate-600/30 overflow-hidden"><div className="h-2 bg-emerald-500" style={{ width: `${Math.max(0, Math.min(100, Number(it.progress || 0)))}%` }} /></div><span className="text-[11px] w-8 text-right">{Math.max(0, Math.min(100, Number(it.progress || 0)))}%</span></div>
                              )
                            ) : (
                              <div className="flex items-center justify-center gap-2"><div className="w-20 h-2 rounded-full bg-slate-600/30 overflow-hidden"><div className="h-2 bg-emerald-500" style={{ width: `${Math.max(0, Math.min(100, Number(it.progress || 0)))}%` }} /></div><span className="text-[11px] w-8 text-right">{Math.max(0, Math.min(100, Number(it.progress || 0)))}%</span></div>
                            )}
                          </td>
                          {/* План */}
                          <td className={`px-2 py-2 align-middle text-center tabular-nums ${canEditPlannedHours ? '' : 'opacity-70'}`} onClick={() => { if (canEditPlannedHours) startEdit(it) }}>
                            {editingId === it.id ? (
                              canEditPlannedHours ? (
                                <input type="text" value={editDraft?.planned ?? 0} onChange={e => { const raw = e.target.value.replace(',', '.'); let cleaned = raw.replace(/[^0-9.]/g, ''); const parts = cleaned.split('.'); if (parts.length > 2) cleaned = parts[0] + '.' + parts.slice(1).join(''); const num = Math.max(0, Number(cleaned || 0)); setEditDraft(prev => prev ? { ...prev, planned: num } : prev) }} onBlur={() => { if (editDraft) saveItemPatch(it.id, { planned: editDraft.planned }) }} className="w-14 px-1 py-1 text-center tabular-nums bg-transparent border-0 outline-none focus:outline-none focus:ring-0 focus:border-0 dark:bg-transparent dark:text-white text-[12px]" />
                              ) : (
                                it.planned.toFixed(2)
                              )
                            ) : (
                              it.planned.toFixed(2)
                            )}
                          </td>
                          {/* Факт */}
                          <td className="px-2 py-2 align-middle text-center tabular-nums">{it.actual.toFixed(2)}</td>
                          {/* Срок */}
                          <td className={`px-2 py-2 align-middle ${canEditDueDate ? '' : 'opacity-70'}`} onClick={() => { if (canEditDueDate) startEdit(it) }}>
                            {editingId === it.id ? (
                              canEditDueDate ? (
                                <div className="flex items-center gap-2 text-[12px]" onClick={e => e.stopPropagation()}>
                                  <ProjectDatePicker
                                    value={(() => { const v = editDraft?.dueDate; return v ? new Date(v) : null })()}
                                    onChange={(d) => { const iso = formatISO(d); setEditDraft(prev => prev ? { ...prev, dueDate: iso } : prev); saveItemPatch(it.id, { dueDate: iso }) }}
                                    placeholder="Выбрать"
                                    calendarWidth="240px"
                                    inputWidth="140px"
                                    placement="left"
                                    offsetX={8}
                                    offsetY={0}
                                    inputClassName="bg-transparent border-0 outline-none focus:outline-none focus:ring-0 focus:border-0 text-[12px] px-2 py-1"
                                    variant="minimal"
                                  />
                                </div>
                              ) : (
                                <span className="truncate">{it.dueDate ? new Date(it.dueDate).toLocaleDateString('ru-RU') : '—'}</span>
                              )
                            ) : (
                              <span className="truncate">{it.dueDate ? new Date(it.dueDate).toLocaleDateString('ru-RU') : '—'}</span>
                            )}
                          </td>
                          {/* … */}
                          <td className="px-2 py-2 align-middle text-center">
                            <span className="text-slate-400">—</span>
                          </td>
                        </tr>
                      ))
                    )}
                  </React.Fragment>
                )
              })}

              {unassigned.length > 0 && (
                <>
                  <tr className="border-t bg-slate-50 dark:bg-slate-800/40">
                    <td className="px-2 py-2 align-top text-sm">{stages.length + 1}</td>
                    <td className="px-2 py-2 align-top font-medium" colSpan={5}>Без этапа</td>
                    <td className="px-2 py-2 align-top text-center tabular-nums font-medium">{unassigned.reduce((s, r) => s + (Number(r.planned) || 0), 0).toFixed(2)}</td>
                    <td className="px-2 py-2 align-top text-center tabular-nums font-medium">{unassigned.reduce((s, r) => s + (Number(r.actual) || 0), 0).toFixed(2)}</td>
                    <td className="px-2 py-2 align-top" colSpan={2}></td>
                  </tr>
                  {unassigned.map((it) => (
                    <tr key={`__no_stage__-${it.id}`} className="border-t">
                      <td className="px-2 py-2 align-middle">
                        <div className="relative flex items-center justify-center">
                          <button className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700" title="Добавить отчет" onClick={() => { setSelectedForLog(it.id); setIsLogModalOpen(true) }}>
                            <Clock className={'h-4 w-4 text-emerald-600'} />
                          </button>
                          {it.logsCount ? (
                            <span className="absolute -top-1 -right-1 inline-flex items-center justify-center min-w-[14px] h-[14px] rounded-full bg-emerald-600 text-white text-[10px] leading-none px-[4px]">
                              {Math.min(99, it.logsCount)}
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-2 py-2 align-middle">
                        <div title={it.description} className="whitespace-pre-wrap line-clamp-3 break-words overflow-hidden">{it.description}</div>
                      </td>
                      <td className="px-2 py-2 align-middle">
                        <span className="inline-block max-w-full whitespace-normal break-words rounded-full px-2 py-0.5 text-xs font-medium bg-slate-200 text-slate-700 dark:bg-slate-700/60 dark:text-slate-100">{it.categoryName || "—"}</span>
                      </td>
                      <td className="px-2 py-2 align-middle"><span className="inline-block max-w-full truncate text-[11px]">{it.responsibleName || "—"}</span></td>
                      <td className="px-2 py-2 align-middle"><span className="inline-block max-w-full whitespace-normal break-words rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ backgroundColor: it.statusColor || '#6c757d', color: 'white' }}>{it.statusName}</span></td>
                      <td className="px-2 py-2 align-middle text-center tabular-nums">
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-20 h-2 rounded-full bg-slate-600/30 overflow-hidden">
                            <div className="h-2 bg-emerald-500" style={{ width: `${Math.max(0, Math.min(100, Number(it.progress || 0)))}%` }} />
                          </div>
                          <span className="text-[11px] w-8 text-right">{Math.max(0, Math.min(100, Number(it.progress || 0)))}%</span>
                        </div>
                      </td>
                      <td className="px-2 py-2 align-middle text-center tabular-nums">{it.planned.toFixed(2)}</td>
                      <td className="px-2 py-2 align-middle text-center tabular-nums">{it.actual.toFixed(2)}</td>
                      <td className="px-2 py-2 align-middle"><span className="truncate">{it.dueDate ? new Date(it.dueDate).toLocaleDateString("ru-RU") : "—"}</span></td>
                      <td className="px-2 py-2 align-middle text-center"><span className="text-slate-400">—</span></td>
                    </tr>
                  ))}
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <AddWorkLogModal
        isOpen={isLogModalOpen}
        onClose={() => setIsLogModalOpen(false)}
        sectionId={sectionId}
        defaultItemId={selectedForLog}
        key={isLogModalOpen ? `add-log-stages-${selectedForLog || 'none'}` : 'add-log-stages-hidden'}
        onSuccess={async () => {
          // Перезагружаем строки после отчёта
          const { data, error } = await supabase
            .from("decomposition_items")
            .select("decomposition_item_id")
            .eq("decomposition_item_section_id", sectionId)
            .limit(1)
          if (!error) {
            // триггерим повторный эффект загрузки
            setRows((prev) => [...prev])
          }
        }}
      />
    </div>
  )
}

export default SectionStagesTab


