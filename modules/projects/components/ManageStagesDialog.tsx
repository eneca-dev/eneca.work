"use client"

import React, { useMemo, useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ScrollArea } from "@/components/ui/scroll-area"
import { createClient } from "@/utils/supabase/client"
import { GripVertical, Trash2, Plus, Copy, ClipboardPaste, Clock } from "lucide-react"
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { DatePicker as ProjectDatePicker } from "@/modules/projects/components/DatePicker"

type StageVM = { id: string; name: string; start: string | null; finish: string | null; description: string | null }
type ItemVM = {
  decomposition_item_id: string
  decomposition_item_description: string
  decomposition_item_work_category_id: string
  decomposition_item_planned_hours: number
  decomposition_item_planned_due_date: string | null
  decomposition_item_order: number
  decomposition_item_responsible: string | null
  decomposition_item_status_id: string | null
  decomposition_item_progress: number
  decomposition_item_stage_id: string | null
  decomposition_item_difficulty_id: string | null
}

type WorkCategory = { work_category_id: string; work_category_name: string }
type Profile = { user_id: string; first_name: string; last_name: string; email: string }
type SectionStatus = { id: string; name: string; color: string; description: string | null }
type Difficulty = { difficulty_id: string; difficulty_abbr: string; difficulty_definition: string; difficulty_weight: number }

function SortableRowHandle({ children }: { children: React.ReactNode }) {
  return <div className="cursor-grab active:cursor-grabbing select-none text-slate-500 dark:text-slate-400">{children}</div>
}

function useDragSensors() {
  return useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )
}

function SortableStageWrap({ id, children }: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  }
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      {children}
    </div>
  )
}

function formatISODate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

export default function ManageStagesDialog(props: {
  open: boolean
  onOpenChange: (open: boolean) => void
  sectionId: string
  stages: StageVM[]
  setStages: React.Dispatch<React.SetStateAction<StageVM[]>>
  items: ItemVM[]
  setItems: React.Dispatch<React.SetStateAction<ItemVM[]>>
  categories: WorkCategory[]
  statuses: SectionStatus[]
  profiles: Profile[]
  difficultyLevels: Difficulty[]
  canEditDueDate: boolean
  canEditPlannedHours: boolean
  canEditResponsible: boolean
  canEditStatus: boolean
  canEditProgress: boolean
  onReload: () => Promise<{ data: any[] | null; error: any | null }>
  onOpenLog: (itemId: string) => void
  inline?: boolean
}) {
  const {
    open,
    onOpenChange,
    sectionId,
    stages,
    setStages,
    items,
    setItems,
    categories,
    statuses,
    profiles,
    difficultyLevels,
    canEditDueDate,
    canEditPlannedHours,
    canEditResponsible,
    canEditStatus,
    canEditProgress,
    onReload,
    onOpenLog,
    inline = false,
  } = props

  const supabase = useMemo(() => createClient(), [])
  const [selectedStages, setSelectedStages] = useState<Set<string>>(new Set())
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())
  const [showPaste, setShowPaste] = useState(false)
  const [pasteText, setPasteText] = useState("")
  const [moveTargetStage, setMoveTargetStage] = useState<string | "">("")

  const stageSensors = useDragSensors()

  const categoryByName = useMemo(() => {
    const m = new Map<string, string>()
    categories.forEach(c => m.set((c.work_category_name || "").toLowerCase(), c.work_category_id))
    return m
  }, [categories])

  const difficultyByLabel = useMemo(() => {
    const m = new Map<string, Difficulty>()
    difficultyLevels.forEach(d => {
      m.set((d.difficulty_abbr || "").toLowerCase(), d)
      m.set((d.difficulty_definition || "").toLowerCase(), d)
    })
    return m
  }, [difficultyLevels])

  const defaultStatusId = useMemo(() => statuses.find(s => s.name === "План")?.id || statuses[0]?.id || null, [statuses])
  const defaultDifficultyId = useMemo(() => {
    const k = difficultyLevels.find(d => d.difficulty_abbr === "К")
    return (k?.difficulty_id) || difficultyLevels[0]?.difficulty_id || null
  }, [difficultyLevels])

  function getProfileName(p: Profile) {
    const full = `${p.first_name || ""} ${p.last_name || ""}`.trim()
    return full || p.email
  }

  function selectAllStagesToggle() {
    if (selectedStages.size === stages.length) setSelectedStages(new Set())
    else setSelectedStages(new Set(stages.map(s => s.id)))
  }

  function selectAllItemsToggle() {
    const all = items.map(i => i.decomposition_item_id)
    if (selectedItems.size === all.length) setSelectedItems(new Set())
    else setSelectedItems(new Set(all))
  }

  async function addStage() {
    const nextOrder = stages.length > 0 ? stages.length + 1 : 1
    const { data, error } = await supabase
      .from('decomposition_stages')
      .insert({
        decomposition_stage_section_id: sectionId,
        decomposition_stage_name: 'Новый этап',
        decomposition_stage_start: null,
        decomposition_stage_finish: null,
        decomposition_stage_description: null,
        decomposition_stage_order: nextOrder,
      })
      .select('decomposition_stage_id, decomposition_stage_name, decomposition_stage_start, decomposition_stage_finish, decomposition_stage_description')
      .single()
    if (error) return
    setStages(prev => [...prev, {
      id: (data as any).decomposition_stage_id,
      name: (data as any).decomposition_stage_name,
      start: (data as any).decomposition_stage_start || null,
      finish: (data as any).decomposition_stage_finish || null,
      description: (data as any).decomposition_stage_description || null,
    }])
  }

  async function updateStage(stageId: string, updates: Partial<StageVM>) {
    const payload: any = {}
    if (updates.name !== undefined) payload.decomposition_stage_name = updates.name
    if (updates.start !== undefined) payload.decomposition_stage_start = updates.start
    if (updates.finish !== undefined) payload.decomposition_stage_finish = updates.finish
    if (updates.description !== undefined) payload.decomposition_stage_description = updates.description
    if (Object.keys(payload).length === 0) return
    const { error } = await supabase.from('decomposition_stages').update(payload).eq('decomposition_stage_id', stageId)
    if (error) return
    setStages(prev => prev.map(s => s.id === stageId ? { ...s, ...updates } : s))
  }

  async function deleteStage(stageId: string) {
    // удаляем элементы, затем этап
    const { error: delItemsErr } = await supabase.from('decomposition_items').delete().eq('decomposition_item_stage_id', stageId)
    if (delItemsErr) return
    const { error } = await supabase.from('decomposition_stages').delete().eq('decomposition_stage_id', stageId)
    if (error) return
    setStages(prev => prev.filter(s => s.id !== stageId))
    setItems(prev => prev.filter(i => i.decomposition_item_stage_id !== stageId))
  }

  function maxItemOrder(all: ItemVM[]) {
    return all.reduce((m, it) => Math.max(m, Number(it.decomposition_item_order || 0)), -1)
  }

  async function addDecomposition(stageId: string) {
    const nextOrder = maxItemOrder(items) + 1
    const defaultCategory = categories[0]?.work_category_id || null
    const { data, error } = await supabase
      .from('decomposition_items')
      .insert({
        decomposition_item_section_id: sectionId,
        decomposition_item_description: 'Новая декомпозиция',
        decomposition_item_work_category_id: defaultCategory,
        decomposition_item_planned_hours: 0,
        decomposition_item_order: nextOrder,
        decomposition_item_planned_due_date: null,
        decomposition_item_responsible: null,
        decomposition_item_status_id: defaultStatusId,
        decomposition_item_progress: 0,
        decomposition_item_stage_id: stageId,
        decomposition_item_difficulty_id: defaultDifficultyId,
      })
      .select('decomposition_item_id')
      .single()
    if (error) return
    const newId = (data as any).decomposition_item_id as string
    setItems(prev => [...prev, {
      decomposition_item_id: newId,
      decomposition_item_description: 'Новая декомпозиция',
      decomposition_item_work_category_id: defaultCategory || '',
      decomposition_item_planned_hours: 0,
      decomposition_item_planned_due_date: null,
      decomposition_item_order: nextOrder,
      decomposition_item_responsible: null,
      decomposition_item_status_id: defaultStatusId,
      decomposition_item_progress: 0,
      decomposition_item_stage_id: stageId,
      decomposition_item_difficulty_id: defaultDifficultyId,
    }])
  }

  async function updateItem(id: string, patch: Partial<ItemVM>) {
    const safe: any = {}
    if (patch.decomposition_item_description !== undefined) safe.decomposition_item_description = patch.decomposition_item_description
    if (patch.decomposition_item_work_category_id !== undefined) safe.decomposition_item_work_category_id = patch.decomposition_item_work_category_id
    if (patch.decomposition_item_planned_hours !== undefined && canEditPlannedHours) safe.decomposition_item_planned_hours = Number(patch.decomposition_item_planned_hours)
    if (patch.decomposition_item_planned_due_date !== undefined && canEditDueDate) safe.decomposition_item_planned_due_date = patch.decomposition_item_planned_due_date
    if (patch.decomposition_item_responsible !== undefined && canEditResponsible) safe.decomposition_item_responsible = patch.decomposition_item_responsible
    if (patch.decomposition_item_status_id !== undefined && canEditStatus) safe.decomposition_item_status_id = patch.decomposition_item_status_id
    if (patch.decomposition_item_progress !== undefined && canEditProgress) safe.decomposition_item_progress = Number(patch.decomposition_item_progress)
    if (patch.decomposition_item_stage_id !== undefined) safe.decomposition_item_stage_id = patch.decomposition_item_stage_id
    if (patch.decomposition_item_difficulty_id !== undefined) safe.decomposition_item_difficulty_id = patch.decomposition_item_difficulty_id
    if (Object.keys(safe).length === 0) return
    const { error } = await supabase.from('decomposition_items').update(safe).eq('decomposition_item_id', id)
    if (error) return
    setItems(prev => prev.map(i => i.decomposition_item_id === id ? { ...i, ...patch } as ItemVM : i))
  }

  async function deleteItem(stageId: string, itemId: string) {
    const { error } = await supabase.from('decomposition_items').delete().eq('decomposition_item_id', itemId)
    if (error) return
    setItems(prev => prev.filter(i => i.decomposition_item_id !== itemId))
    setSelectedItems(prev => { const s = new Set(prev); s.delete(itemId); return s })
  }

  function itemsByStageLocal(): Map<string, ItemVM[]> {
    const map = new Map<string, ItemVM[]>()
    for (const it of items) {
      const sid = it.decomposition_item_stage_id || "__no_stage__"
      if (!map.has(sid)) map.set(sid, [])
      map.get(sid)!.push(it)
    }
    return map
  }

  async function persistStageOrder(newStages: StageVM[]) {
    // обновляем все порядки
    for (let idx = 0; idx < newStages.length; idx++) {
      const st = newStages[idx]
      await supabase.from('decomposition_stages').update({ decomposition_stage_order: idx + 1 }).eq('decomposition_stage_id', st.id)
    }
  }

  async function persistItemOrder(allItems: ItemVM[]) {
    for (let idx = 0; idx < allItems.length; idx++) {
      const it = allItems[idx]
      await supabase.from('decomposition_items').update({ decomposition_item_order: idx }).eq('decomposition_item_id', it.decomposition_item_id)
    }
  }

  async function handleStageDragEnd(e: DragEndEvent) {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const oldIndex = stages.findIndex(s => s.id === active.id)
    const newIndex = stages.findIndex(s => s.id === over.id)
    const newArr = arrayMove(stages, oldIndex, newIndex)
    setStages(newArr)
    await persistStageOrder(newArr)
  }

  async function handleItemDragEnd(stageId: string, e: DragEndEvent) {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const byStage = itemsByStageLocal()
    const bucket = byStage.get(stageId) || []
    const oldIndex = bucket.findIndex(i => i.decomposition_item_id === active.id)
    const newIndex = bucket.findIndex(i => i.decomposition_item_id === over.id)
    const newBucket = arrayMove(bucket, oldIndex, newIndex)
    // соберём полный порядок: по порядку стадий, внутри — по newBucket для текущей
    const stageOrder = stages.map(s => s.id)
    const ordered: ItemVM[] = []
    for (const sid of stageOrder) {
      const list = sid === stageId ? newBucket : (byStage.get(sid) || [])
      ordered.push(...list)
    }
    // затем без этапа
    ordered.push(...(byStage.get("__no_stage__") || []))
    setItems(ordered)
    await persistItemOrder(ordered)
  }

  async function bulkDeleteStages() {
    if (selectedStages.size === 0) return
    for (const id of selectedStages) {
      await supabase.from('decomposition_items').delete().eq('decomposition_item_stage_id', id)
      await supabase.from('decomposition_stages').delete().eq('decomposition_stage_id', id)
    }
    setStages(prev => prev.filter(s => !selectedStages.has(s.id)))
    setItems(prev => prev.filter(i => !selectedStages.has(i.decomposition_item_stage_id || '')))
    setSelectedStages(new Set())
  }

  async function bulkDeleteItems() {
    if (selectedItems.size === 0) return
    for (const id of selectedItems) await supabase.from('decomposition_items').delete().eq('decomposition_item_id', id)
    setItems(prev => prev.filter(i => !selectedItems.has(i.decomposition_item_id)))
    setSelectedItems(new Set())
  }

  async function moveSelectedItemsToStage(targetStageId: string | null) {
    const ids = Array.from(selectedItems)
    if (ids.length === 0) return
    await supabase.from('decomposition_items').update({ decomposition_item_stage_id: targetStageId }).in('decomposition_item_id', ids)
    setItems(prev => prev.map(i => selectedItems.has(i.decomposition_item_id) ? { ...i, decomposition_item_stage_id: targetStageId } : i))
  }

  async function handleCopy() {
    let decomp = "| Название этапа | Описание декомпозиции (название) | Тип работ | Сложность | Ответственный | Плановые часы | Статус | Дата (декомпозиции) |\n"
    decomp += "|---|---|---|---|---|---|---|---|\n"
    const catName = (id: string) => categories.find(c => c.work_category_id === id)?.work_category_name || ''
    const statName = (id: string | null) => statuses.find(s => s.id === id)?.name || ''
    const diffAbbr = (id: string | null) => difficultyLevels.find(d => d.difficulty_id === id)?.difficulty_abbr || ''
    const profName = (id: string | null) => {
      if (!id) return ''
      const p = profiles.find(p => p.user_id === id)
      return p ? (`${p.first_name || ''} ${p.last_name || ''}`.trim() || p.email) : ''
    }
    const byStage = itemsByStageLocal()
    for (const st of stages) {
      for (const it of (byStage.get(st.id) || [])) {
        decomp += `| ${st.name} | ${it.decomposition_item_description} | ${catName(it.decomposition_item_work_category_id)} | ${diffAbbr(it.decomposition_item_difficulty_id)} | ${profName(it.decomposition_item_responsible)} | ${Number(it.decomposition_item_planned_hours || 0)} | ${statName(it.decomposition_item_status_id)} | ${it.decomposition_item_planned_due_date || ''} |\n`
      }
    }
    let stagesTbl = "\n\n| Название этапа | Дата начала этапа | Дата завершения этапа |\n|---|---|---|\n"
    for (const st of stages) stagesTbl += `| ${st.name} | ${st.start || ''} | ${st.finish || ''} |\n`
    const full = decomp + stagesTbl
    try { await navigator.clipboard.writeText(full) } catch {}
  }

  async function handlePaste() {
    if (!pasteText.trim()) return
    const lines = pasteText.trim().split("\n").filter(l => l.trim() && !l.includes("Название этапа"))
    // Группируем по этапам
    const map = new Map<string, any[]>()
    for (const line of lines) {
      const parts = line.split("|").map(p => p.trim()).filter(Boolean)
      if (parts.length < 8) continue
      const [stageName, description, typeOfWork, difficulty, responsible, plannedHours, status, dateStr] = parts
      if (!map.has(stageName)) map.set(stageName, [])
      map.get(stageName)!.push({ description, typeOfWork, difficulty, responsible, plannedHours, status, dateStr })
    }
    // Создаём/находим этапы
    const newStages = [...stages]
    for (const [stageName, rows] of map.entries()) {
      let stage = newStages.find(s => s.name === stageName)
      if (!stage) {
        const nextOrder = newStages.length > 0 ? newStages.length + 1 : 1
        const { data } = await supabase
          .from('decomposition_stages')
          .insert({
            decomposition_stage_section_id: sectionId,
            decomposition_stage_name: stageName,
            decomposition_stage_order: nextOrder,
          })
          .select('decomposition_stage_id')
          .single()
        const id = (data as any).decomposition_stage_id as string
        stage = { id, name: stageName, start: null, finish: null, description: null }
        newStages.push(stage)
      }
      // добавляем декомпозиции
      for (const r of rows) {
        const catId = categoryByName.get((r.typeOfWork || '').toLowerCase()) || categories[0]?.work_category_id || null
        // статус
        const st = statuses.find(s => s.name.toLowerCase() === String(r.status || '').toLowerCase())?.id || defaultStatusId
        // сложность
        const diff = difficultyByLabel.get(String(r.difficulty || '').toLowerCase())?.difficulty_id || defaultDifficultyId
        // ответственный
        const resp = (() => {
          const name = String(r.responsible || '').toLowerCase()
          if (!name) return null
          const found = profiles.find(p => `${p.first_name || ''} ${p.last_name || ''}`.trim().toLowerCase() === name)
          return found?.user_id || null
        })()
        const nextOrder = maxItemOrder(items) + 1
        await supabase.from('decomposition_items').insert({
          decomposition_item_section_id: sectionId,
          decomposition_item_description: r.description,
          decomposition_item_work_category_id: catId,
          decomposition_item_planned_hours: Number(r.plannedHours) || 0,
          decomposition_item_order: nextOrder,
          decomposition_item_planned_due_date: r.dateStr || null,
          decomposition_item_responsible: resp,
          decomposition_item_status_id: st,
          decomposition_item_progress: 0,
          decomposition_item_stage_id: stage.id,
          decomposition_item_difficulty_id: diff,
        })
      }
    }
    setStages(newStages)
    await onReload()
    setPasteText("")
    setShowPaste(false)
  }

  const byStage = useMemo(() => itemsByStageLocal(), [items])

  const body = (
    <>
      <div className="px-4 pt-4">
        <div className="mb-1">
          <div className="text-base font-semibold">Управление этапами и декомпозициями</div>
          <div className="text-sm text-slate-500 dark:text-slate-400">Перетаскивайте, редактируйте, импортируйте и экспортируйте данные</div>
        </div>
      </div>
      <div className="px-4 pb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => setShowPaste(true)}>
            <ClipboardPaste className="mr-2 h-4 w-4" /> Вставить
          </Button>
          <Button variant="outline" size="sm" onClick={handleCopy}>
            <Copy className="mr-2 h-4 w-4" /> Копировать
          </Button>
          <Button size="sm" onClick={addStage}>
            <Plus className="mr-2 h-4 w-4" /> Добавить этап
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={selectAllStagesToggle}>
            Выбрать все этапы
          </Button>
          <Button variant="outline" size="sm" onClick={selectAllItemsToggle}>
            Выбрать все декомпозиции
          </Button>
          {selectedItems.size > 0 && (
            <>
              <Select value={moveTargetStage} onValueChange={(v) => setMoveTargetStage(v)}>
                <SelectTrigger className="h-8 w-[200px]"><SelectValue placeholder="Переместить в этап" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Без этапа</SelectItem>
                  {stages.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button size="sm" onClick={() => moveSelectedItemsToStage(moveTargetStage || null)}>Переместить</Button>
            </>
          )}
          {selectedStages.size > 0 && (
            <Button variant="destructive" size="sm" onClick={bulkDeleteStages}>
              <Trash2 className="mr-2 h-4 w-4" /> Удалить выбранные этапы
            </Button>
          )}
          {selectedItems.size > 0 && (
            <Button variant="destructive" size="sm" onClick={bulkDeleteItems}>
              <Trash2 className="mr-2 h-4 w-4" /> Удалить выбранные декомпозиции
            </Button>
          )}
        </div>
      </div>
      <ScrollArea className="max-h-[76vh]">
        <div className="px-4 pb-4 space-y-3">
          <DndContext sensors={stageSensors} collisionDetection={closestCenter} onDragEnd={handleStageDragEnd}>
            <SortableContext items={stages.map(s => s.id)} strategy={verticalListSortingStrategy}>
              {stages.map(stage => (
                <SortableStageWrap id={stage.id} key={stage.id}>
                  <Card className="p-3">
                    <div className="mb-3 flex items-center gap-3 border-b border-slate-200 dark:border-slate-700 pb-3">
                      <SortableRowHandle>
                        <GripVertical className="h-5 w-5" />
                      </SortableRowHandle>
                      <input
                        type="checkbox"
                        checked={selectedStages.has(stage.id)}
                        onChange={() => setSelectedStages(prev => { const s = new Set(prev); s.has(stage.id) ? s.delete(stage.id) : s.add(stage.id); return s })}
                        className="h-4 w-4"
                      />
                      <Input
                        value={stage.name}
                        onChange={e => updateStage(stage.id, { name: e.target.value })}
                        className="h-8 max-w:[360px]"
                      />
                      <ProjectDatePicker
                        value={stage.start ? new Date(stage.start) : null}
                        onChange={d => updateStage(stage.id, { start: formatISODate(d) })}
                        placeholder="Начало"
                        calendarWidth="240px"
                        inputWidth="140px"
                        variant="minimal"
                      />
                      <ProjectDatePicker
                        value={stage.finish ? new Date(stage.finish) : null}
                        onChange={d => updateStage(stage.id, { finish: formatISODate(d) })}
                        placeholder="Окончание"
                        calendarWidth="240px"
                        inputWidth="140px"
                        variant="minimal"
                      />
                      <Button variant="ghost" size="sm" onClick={() => deleteStage(stage.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                      <div className="ml-auto">
                        <Button variant="outline" size="sm" onClick={() => addDecomposition(stage.id)}>
                          <Plus className="mr-2 h-4 w-4" /> Добавить декомпозицию
                        </Button>
                      </div>
                    </div>

                    <StageItemsTable
                      stageId={stage.id}
                      items={(byStage.get(stage.id) || [])}
                      categories={categories}
                      statuses={statuses}
                      profiles={profiles}
                      difficultyLevels={difficultyLevels}
                      selectedItems={selectedItems}
                      setSelectedItems={setSelectedItems}
                      onDragEnd={handleItemDragEnd}
                      onUpdateItem={updateItem}
                      onDeleteItem={deleteItem}
                      canEditDueDate={canEditDueDate}
                      canEditPlannedHours={canEditPlannedHours}
                      canEditResponsible={canEditResponsible}
                      canEditStatus={canEditStatus}
                      canEditProgress={canEditProgress}
                      onOpenLog={onOpenLog}
                    />
                  </Card>
                </SortableStageWrap>
              ))}
            </SortableContext>
          </DndContext>
        </div>
      </ScrollArea>

      <Dialog open={showPaste} onOpenChange={setShowPaste}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Вставить данные</DialogTitle>
            <DialogDescription>
              Вставьте данные в формате: Название этапа | Описание | Тип работ | Сложность | Ответственный | Плановые часы | Статус | Дата
            </DialogDescription>
          </DialogHeader>
          <Textarea value={pasteText} onChange={e => setPasteText(e.target.value)} className="min-h-[300px] font-mono text-sm" />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowPaste(false)}>Отмена</Button>
            <Button onClick={handlePaste}>Импортировать</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )

  if (inline) {
    return (
      <div className="w-full max-w-[1100px] p-0 overflow-hidden">
        {body}
      </div>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[98vw] sm:max-w-[1100px] max-h-[92vh] p-0 overflow-hidden">
        <DialogHeader className="px-4 pt-4">
          <DialogTitle>Управление этапами и декомпозициями</DialogTitle>
          <DialogDescription>Перетаскивайте, редактируйте, импортируйте и экспортируйте данные</DialogDescription>
        </DialogHeader>
        {body}
      </DialogContent>
    </Dialog>
  )
}

function StageItemsTable(props: {
  stageId: string
  items: ItemVM[]
  categories: WorkCategory[]
  statuses: SectionStatus[]
  profiles: Profile[]
  difficultyLevels: Difficulty[]
  selectedItems: Set<string>
  setSelectedItems: React.Dispatch<React.SetStateAction<Set<string>>>
  onDragEnd: (stageId: string, e: DragEndEvent) => void
  onUpdateItem: (id: string, patch: Partial<ItemVM>) => Promise<void>
  onDeleteItem: (stageId: string, id: string) => Promise<void>
  canEditDueDate: boolean
  canEditPlannedHours: boolean
  canEditResponsible: boolean
  canEditStatus: boolean
  canEditProgress: boolean
  onOpenLog: (itemId: string) => void
}) {
  const {
    stageId,
    items,
    categories,
    statuses,
    profiles,
    difficultyLevels,
    selectedItems,
    setSelectedItems,
    onDragEnd,
    onUpdateItem,
    onDeleteItem,
    canEditDueDate,
    canEditPlannedHours,
    canEditResponsible,
    canEditStatus,
    canEditProgress,
    onOpenLog,
  } = props

  const sensors = useDragSensors()

  const catOptions = categories
  const statusOptions = statuses
  const diffOptions = difficultyLevels

  const getProfileName = (p: Profile) => {
    const nm = `${p.first_name || ''} ${p.last_name || ''}`.trim()
    return nm || p.email
  }

  return (
    <div className="overflow-x-auto">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => onDragEnd(stageId, e)}>
        <table className="w-full text-[12px]">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-700 text-left text-[11px] h-7">
              <th className="w-8 px-2 py-1" />
              <th className="w-8 px-2 py-1" />
              <th className="px-2 py-1">Описание</th>
              <th className="px-2 py-1">Тип работ</th>
              <th className="px-2 py-1">Сложность</th>
              <th className="px-2 py-1">Ответственный</th>
              <th className="px-2 py-1">Плановые часы</th>
              <th className="px-2 py-1">Гот%</th>
              <th className="px-2 py-1">Статус</th>
              <th className="px-2 py-1">Дата выполнения</th>
              <th className="w-8 px-2 py-1" />
              <th className="w-8 px-2 py-1" />
            </tr>
          </thead>
          <tbody>
            <SortableContext items={items.map(i => i.decomposition_item_id)} strategy={verticalListSortingStrategy}>
              {items.map(it => (
                <ItemRow
                  key={it.decomposition_item_id}
                  item={it}
                  stageId={stageId}
                  catOptions={catOptions}
                  statusOptions={statusOptions}
                  diffOptions={diffOptions}
                  profiles={profiles}
                  selected={selectedItems.has(it.decomposition_item_id)}
                  toggleSelected={() => setSelectedItems(prev => { const s = new Set(prev); s.has(it.decomposition_item_id) ? s.delete(it.decomposition_item_id) : s.add(it.decomposition_item_id); return s })}
                  onUpdate={onUpdateItem}
                  onDelete={onDeleteItem}
                  canEditDueDate={canEditDueDate}
                  canEditPlannedHours={canEditPlannedHours}
                  canEditResponsible={canEditResponsible}
                  canEditStatus={canEditStatus}
                  canEditProgress={canEditProgress}
                  onOpenLog={onOpenLog}
                />
              ))}
            </SortableContext>
          </tbody>
        </table>
      </DndContext>
    </div>
  )
}

function ItemRow(props: {
  item: ItemVM
  stageId: string
  catOptions: WorkCategory[]
  statusOptions: SectionStatus[]
  diffOptions: Difficulty[]
  profiles: Profile[]
  selected: boolean
  toggleSelected: () => void
  onUpdate: (id: string, patch: Partial<ItemVM>) => Promise<void>
  onDelete: (stageId: string, id: string) => Promise<void>
  canEditDueDate: boolean
  canEditPlannedHours: boolean
  canEditResponsible: boolean
  canEditStatus: boolean
  canEditProgress: boolean
  onOpenLog: (itemId: string) => void
}) {
  const { item, stageId, catOptions, statusOptions, diffOptions, profiles, selected, toggleSelected, onUpdate, onDelete, canEditDueDate, canEditPlannedHours, canEditResponsible, canEditStatus, canEditProgress, onOpenLog } = props
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.decomposition_item_id })
  const style: React.CSSProperties = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.6 : 1 }
  const clampPct = (v: number) => Math.max(0, Math.min(100, Math.round(v)))
  const currentCategory = catOptions.find(c => c.work_category_id === item.decomposition_item_work_category_id)
  const currentDifficulty = diffOptions.find(d => d.difficulty_id === (item.decomposition_item_difficulty_id || ''))
  const currentStatus = statusOptions.find(s => s.id === (item.decomposition_item_status_id || ''))
  const currentProfile = profiles.find(p => p.user_id === (item.decomposition_item_responsible || ''))
  const difficultyPillClasses = (() => {
    const w = currentDifficulty?.difficulty_weight ?? 0
    if (w >= 3) return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
    if (w === 2) return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
    return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300'
  })()
  return (
    <tr ref={setNodeRef} style={style} className="border-b border-slate-200 dark:border-slate-700 hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
      <td className="p-2 align-middle">
        <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing"><GripVertical className="h-4 w-4 text-slate-500" /></div>
      </td>
      <td className="p-2 align-middle">
        <input type="checkbox" checked={selected} onChange={toggleSelected} className="h-4 w-4" />
      </td>
      <td className="p-2 align-middle">
        <Input
          value={item.decomposition_item_description || ''}
          onChange={e => onUpdate(item.decomposition_item_id, { decomposition_item_description: e.target.value })}
          className="h-8 min-w-[220px]"
        />
      </td>
      <td className="p-2 align-middle">
        <Select value={item.decomposition_item_work_category_id} onValueChange={v => onUpdate(item.decomposition_item_id, { decomposition_item_work_category_id: v })}>
          <SelectTrigger className="h-6 w-[120px] px-2 rounded-full bg-slate-100 dark:bg-slate-800/60 text-[11px] justify-between [&>svg]:h-3 [&>svg]:w-3 [&>svg]:opacity-60">
            <span className="truncate">{currentCategory?.work_category_name || ''}</span>
          </SelectTrigger>
          <SelectContent>
            {catOptions.map(c => <SelectItem key={c.work_category_id} value={c.work_category_id}>{c.work_category_name}</SelectItem>)}
          </SelectContent>
        </Select>
      </td>
      <td className="p-2 align-middle">
        <Select value={item.decomposition_item_difficulty_id || ''} onValueChange={v => onUpdate(item.decomposition_item_id, { decomposition_item_difficulty_id: v })}>
          <SelectTrigger className={`h-6 w-[44px] px-2 rounded-full text-[11px] justify-between [&>svg]:h-3 [&>svg]:w-3 [&>svg]:opacity-60 ${difficultyPillClasses}`}>
            <span className="truncate">{currentDifficulty?.difficulty_abbr || currentDifficulty?.difficulty_definition || ''}</span>
          </SelectTrigger>
          <SelectContent>
            {diffOptions.map(d => <SelectItem key={d.difficulty_id} value={d.difficulty_id}>{d.difficulty_abbr}</SelectItem>)}
          </SelectContent>
        </Select>
      </td>
      <td className="p-2 align-middle">
        <Select value={item.decomposition_item_responsible || ''} onValueChange={v => onUpdate(item.decomposition_item_id, { decomposition_item_responsible: v })} disabled={!canEditResponsible}>
          <SelectTrigger className="h-6 w-[160px] px-2 rounded-full bg-slate-100 dark:bg-slate-800/60 text-[11px] justify-between disabled:opacity-70 [&>svg]:h-3 [&>svg]:w-3 [&>svg]:opacity-60">
            <span className="truncate">{currentProfile ? ((`${currentProfile.first_name || ''} ${currentProfile.last_name || ''}`.trim()) || currentProfile.email) : ''}</span>
          </SelectTrigger>
          <SelectContent>
            {profiles.map(p => <SelectItem key={p.user_id} value={p.user_id}>{`${p.first_name || ''} ${p.last_name || ''}`.trim() || p.email}</SelectItem>)}
          </SelectContent>
        </Select>
      </td>
      <td className="p-2 align-middle">
        <Input
          type="number"
          value={Number(item.decomposition_item_planned_hours || 0)}
          onChange={e => onUpdate(item.decomposition_item_id, { decomposition_item_planned_hours: Number(e.target.value) || 0 })}
          className="h-6 w-[50px] text-right"
          disabled={!canEditPlannedHours}
        />
      </td>
      <td className="p-2 align-middle">
        <Select value={String(item.decomposition_item_progress || 0)} onValueChange={v => onUpdate(item.decomposition_item_id, { decomposition_item_progress: clampPct(Number(v)) })} disabled={!canEditProgress}>
          <SelectTrigger className="h-6 w-[52px] px-2 rounded-full bg-slate-100 dark:bg-slate-800/60 text-[11px] justify-between disabled:opacity-70 [&>svg]:h-3 [&>svg]:w-3 [&>svg]:opacity-60">
            <span className="truncate">{clampPct(Number(item.decomposition_item_progress || 0))}%</span>
          </SelectTrigger>
          <SelectContent>
            {[0,10,20,30,40,50,60,70,80,90,100].map(v => <SelectItem key={v} value={String(v)}>{v}%</SelectItem>)}
          </SelectContent>
        </Select>
      </td>
      <td className="p-2 align-middle">
        <Select value={item.decomposition_item_status_id || ''} onValueChange={v => onUpdate(item.decomposition_item_id, { decomposition_item_status_id: v })} disabled={!canEditStatus}>
          <SelectTrigger className="h-6 w-[80px] px-2 rounded-full text-[11px] justify-between disabled:opacity-70 text-white [&>svg]:h-3 [&>svg]:w-3 [&>svg]:opacity-80" style={{ backgroundColor: currentStatus?.color || undefined }}>
            <span className="truncate">{currentStatus?.name || ''}</span>
          </SelectTrigger>
          <SelectContent>
            {statusOptions.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </td>
      <td className="p-2 align-middle">
        <Input
          type="date"
          value={item.decomposition_item_planned_due_date || ''}
          onChange={e => onUpdate(item.decomposition_item_id, { decomposition_item_planned_due_date: e.target.value || null })}
          className="h-8 w-[120px]"
          disabled={!canEditDueDate}
        />
      </td>
      <td className="p-2 align-middle">
        <Button variant="ghost" size="icon" onClick={() => onOpenLog(item.decomposition_item_id)} title="Добавить отчёт">
          <Clock className="h-4 w-4 text-emerald-600" />
        </Button>
      </td>
      <td className="p-2 align-middle">
        <Button variant="ghost" size="icon" onClick={() => onDelete(stageId, item.decomposition_item_id)}>
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </td>
    </tr>
  )
}


