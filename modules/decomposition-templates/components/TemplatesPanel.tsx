"use client"

import React, { useEffect, useMemo, useState } from 'react'
import { useTemplatesStore } from '../store'
import type { DecompositionTemplate } from '../types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Dialog as InnerDialog, DialogContent as InnerDialogContent, DialogHeader as InnerDialogHeader, DialogTitle as InnerDialogTitle } from '@/components/ui/dialog'
import { applyTemplateAppend, validateTemplateApplicability } from '../api'
import { createClient } from '@/utils/supabase/client'
import { Check, Trash2, PlusCircle, FolderOpen } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useHasPermission } from '@/modules/permissions'

interface TemplatesPanelProps {
  departmentId: string | null
  sectionId: string
  onApplied?: (result: { inserted: number }) => void
}

export function TemplatesPanel({ departmentId, sectionId, onApplied }: TemplatesPanelProps) {
  const {
    departmentId: depInStore,
    setDepartment,
    fetchTemplates,
    templates,
    selectedTemplate,
    openTemplate,
    createTemplate,
    deleteTemplate,
  } = useTemplatesStore()

  // baseDate не используется
  const [name, setName] = useState('')
  const [isCreateOpen, setCreateOpen] = useState(false)
  const [isInnerOpen, setInnerOpen] = useState(false)
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([])
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([])
  const [profiles, setProfiles] = useState<{ id: string; name: string }[]>([])
  const [statuses, setStatuses] = useState<{ id: string; name: string }[]>([])
  const [newDesc, setNewDesc] = useState('')
  const [newCat, setNewCat] = useState('')
  const [newHours, setNewHours] = useState('')
  const [newOffset, setNewOffset] = useState('')
  const [newStatusId, setNewStatusId] = useState<string>('')
  const [newProgress, setNewProgress] = useState<string>('')
  // Выбранный для применения шаблон
  const [applyId, setApplyId] = useState<string | null>(null)
  // Режим isEditing больше не используется — редактирование по клику на ячейку
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  // Поиск по ответственным через popover; отдельный кэш не нужен
  const [editingId, setEditingId] = useState<string | null>(null)
  const [openCatId, setOpenCatId] = useState<string | null>(null)
  const isCatOpen = (id: string) => openCatId === id
  const [openRespId, setOpenRespId] = useState<string | null>(null)
  const isRespOpen = (id: string) => openRespId === id
  const [openStatusId, setOpenStatusId] = useState<string | null>(null)
  const isStatusOpen = (id: string) => openStatusId === id
  const [responsibleFilter, setResponsibleFilter] = useState<string>('')

  const supabase = createClient()

  // Право на управление шаблонами
  const canManageTemplates = useHasPermission('dec.templates.manage')

  useEffect(() => {
    if (departmentId && departmentId !== depInStore) setDepartment(departmentId)
  }, [departmentId, depInStore, setDepartment])

  // Загружаем список отделов для временной переключалки
  useEffect(() => {
    const loadDepartments = async () => {
      const { data, error } = await supabase
        .from('departments')
        .select('department_id, department_name')
        .order('department_name', { ascending: true })
      if (!error && data) {
        setDepartments(
          (data as any[]).map((d) => ({ id: d.department_id as string, name: d.department_name as string }))
        )
      }
    }
    loadDepartments()
  }, [supabase])

  // Категории работ
  useEffect(() => {
    const loadCategories = async () => {
      const { data, error } = await supabase
        .from('work_categories')
        .select('work_category_id, work_category_name')
        .order('work_category_name', { ascending: true })
      if (!error && data) {
        setCategories(
          (data as any[]).map((c) => ({ id: c.work_category_id as string, name: c.work_category_name as string }))
        )
      }
    }
    loadCategories()
  }, [supabase])

  // Профили и статусы для новых полей шаблонов
  useEffect(() => {
    const loadProfilesAndStatuses = async () => {
      const [p, s] = await Promise.all([
        supabase
          .from('profiles')
          .select('user_id, first_name, last_name, email')
          .order('first_name', { ascending: true }),
        supabase
          .from('section_statuses')
          .select('id, name')
          .order('name', { ascending: true }),
      ])
      if (!p.error && p.data) {
        setProfiles(
          (p.data as any[]).map((u) => ({
            id: u.user_id as string,
            name: `${u.first_name || ''} ${u.last_name || ''}`.trim() || (u.email as string),
          }))
        )
      }
      if (!s.error && s.data) {
        setStatuses((s.data as any[]).map((r) => ({ id: r.id as string, name: r.name as string })))
        const plan = (s.data as any[]).find((r) => r.name === 'План')
        if (plan) setNewStatusId(plan.id as string)
      }
    }
    loadProfilesAndStatuses()
  }, [supabase])

  useEffect(() => {
    if (depInStore) fetchTemplates()
  }, [depInStore, fetchTemplates])

  // Синхронизация плейсхолдеров не требуется

  // commitEdits более не используется (сохранение на blur/выборе)

  // Базовая дата убрана — синхронизация не требуется

  // Активный шаблон для применения — явный выбор
  const canApply = useMemo(() => Boolean(applyId), [applyId])

  const onCreateTemplate = async () => {
    const dep = depInStore || departmentId
    if (!dep || !name.trim()) return
    await createTemplate({ department_id: dep, name: name.trim(), is_active: true })
    setName('')
    setCreateOpen(false)
  }

  const onApply = async () => {
    const tplId = applyId || (selectedTemplate?.id ?? null) || (templates[0]?.id ?? null)
    if (!tplId) return
    const appliedBase = null
    try {
      // Предвалидация: отдел и категории
      const validation = await validateTemplateApplicability(sectionId, tplId)
      if (!validation.ok) {
        const msg = validation.issues.map(i => `• ${i.message}`).join('\n')
        alert(`Нельзя применить шаблон:\n${msg}`)
        return
      }
      const res = await applyTemplateAppend({ section_id: sectionId, template_id: tplId, base_date: appliedBase })
      if (onApplied) onApplied({ inserted: res.inserted })
    } catch (e: any) {
      console.error('Ошибка применения шаблона:', e)
      // Ошибку покажем через нотификацию родителя
      if (onApplied) onApplied({ inserted: 0 })
    }
  }

  const canAdd = useMemo(() => {
    const hours = Number(newHours)
    const progressNum = newProgress === '' ? 0 : Number(newProgress)
    return newDesc.trim() && newCat && Number.isFinite(hours) && progressNum >= 0 && progressNum <= 100
  }, [newDesc, newCat, newHours, newProgress])

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <Select
          value={depInStore ?? departmentId ?? ''}
          onValueChange={async (val) => {
            setDepartment(val)
            await fetchTemplates()
          }}
        >
          <SelectTrigger className="w-64">
            <SelectValue placeholder="Отдел" />
          </SelectTrigger>
          <SelectContent>
            {departments.map((d) => (
              <SelectItem key={d.id} value={d.id}>
                {d.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant="default"
          onClick={() => setCreateOpen(true)}
          disabled={!canManageTemplates}
          title={canManageTemplates ? undefined : 'Недостаточно прав: управление шаблонами'}
        >
          Создать шаблон
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-2">
        {templates.map((tpl: DecompositionTemplate) => (
          <div
            key={tpl.id}
            className={`border rounded-md p-2 flex items-center justify-between ${applyId === tpl.id ? 'border-primary' : ''}`}
          >
            <div className="min-w-0">
              <div className="font-medium truncate">{tpl.name}</div>
              {tpl.description && <div className="text-sm text-muted-foreground truncate">{tpl.description}</div>}
            </div>
            <div className="flex items-center gap-2">
              <button
                className={`h-8 w-8 grid place-items-center rounded-sm border ${applyId === tpl.id ? 'bg-emerald-500 border-emerald-500' : 'border-slate-400/60 hover:bg-slate-700/10'} focus:outline-none`}
                title={applyId === tpl.id ? 'Выбран' : 'Выбрать'}
                onClick={() => setApplyId(applyId === tpl.id ? null : tpl.id)}
              >
                <Check className={`h-4 w-4 ${applyId === tpl.id ? 'text-white' : 'text-slate-400'}`} />
              </button>
              <button
                className="h-8 w-8 grid place-items-center rounded-md border border-slate-400/60 hover:bg-slate-700/10 focus:outline-none"
                title="Открыть"
                onClick={async () => { await openTemplate(tpl.id); setApplyId(tpl.id); setInnerOpen(true); setEditingId(null) }}
              >
                <FolderOpen className="h-4 w-4" />
              </button>
              <button
                className="h-8 w-8 grid place-items-center rounded-md border border-red-300 text-red-500 hover:bg-red-500/10 focus:outline-none"
                title={canManageTemplates ? 'Удалить шаблон' : 'Недостаточно прав: управление шаблонами'}
                onClick={() => setConfirmDeleteId(tpl.id)}
                disabled={!canManageTemplates}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Подтверждение удаления шаблона */}
      <AlertDialog open={Boolean(confirmDeleteId)} onOpenChange={(o) => { if (!o) setConfirmDeleteId(null) }}>
        <AlertDialogContent className="sm:max-w-md bg-background dark:bg-[hsl(217.24deg_32.58%_17.45%)] border border-border dark:border-slate-700">
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить шаблон?</AlertDialogTitle>
            <AlertDialogDescription>
              Вы уверены, что хотите удалить шаблон {templates.find(t => t.id === confirmDeleteId)?.name || ''}? Это действие нельзя отменить.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={async () => { if (confirmDeleteId) { await deleteTemplate(confirmDeleteId); setConfirmDeleteId(null); await fetchTemplates(); } }}>Удалить</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Второе (внутреннее) модальное окно для содержимого шаблона: вёрстка как в SectionDecompositionTab */}
      <InnerDialog open={isInnerOpen} onOpenChange={setInnerOpen}>
        <InnerDialogContent className="w-[96vw] sm:max-w-[1200px] max-h-[80vh]">
          <InnerDialogHeader>
            <InnerDialogTitle>{selectedTemplate ? `Шаблон: ${selectedTemplate.name}` : 'Шаблон'}</InnerDialogTitle>
          </InnerDialogHeader>
          {selectedTemplate ? (
            <div className={`overflow-x-auto ${canManageTemplates ? '' : 'cursor-not-allowed'}`} title={canManageTemplates ? undefined : 'Недостаточно прав: доступен только просмотр'}>
              <table className="w-full table-fixed border-collapse text-[12px]">
                <colgroup>
                  <col className="w-[44px]" />
                  <col className="w-[34%]" />
                  <col className="w-[16%]" />
                  <col className="w-[8%]" />
                  <col className="w-[8%]" />
                  <col className="w-[16%]" />
                  <col className="w-[6%]" />
                  <col className="w-[10%]" />
                </colgroup>
                <thead>
                  <tr className="sticky top-0 z-[0] bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200">
                    <th className="px-2 py-2 border"></th>
                    <th className="px-2 py-2 border">Описание работ</th>
                    <th className="px-2 py-2 border">Категория</th>
                    <th className="px-2 py-2 border text-center">План, ч</th>
                    <th className="px-2 py-2 border text-center">±дн</th>
                    <th className="px-2 py-2 border">Ответственный</th>
                    <th className="px-2 py-2 border text-center">%</th>
                    <th className="px-2 py-2 border">Статус</th>
                  </tr>
                </thead>
                <tbody>
            {useTemplatesStore.getState().templateItems.map((it) => (
                    <tr key={it.id} className={`hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors ${editingId === it.id ? 'relative z-[1] [&>td]:border [&>td]:border-t-2 [&>td]:border-slate-200 [&>td]:dark:border-slate-700' : '[&>td]:border-0'}`}>
                      {/* Пустая ячейка под плюс для существующих строк */}
                      <td className="px-2 py-2 align-middle"></td>
                      {/* Описание */}
                      <td className={`px-2 py-2 align-top ${canManageTemplates ? '' : 'cursor-not-allowed opacity-70'}`} onClick={(e) => { if (!canManageTemplates) { e.preventDefault(); e.stopPropagation(); return } setEditingId(it.id) }} title={canManageTemplates ? undefined : 'Недостаточно прав: управление шаблонами'}>
                        {editingId === it.id ? (
                        canManageTemplates ? (
                        <input
                            autoFocus
                            className="w-full h-8 px-2 py-1 text-[12px] bg-transparent border-0 outline-none focus:outline-none focus:ring-0 focus:border-0"
                            value={it.description}
                            onChange={(e) => useTemplatesStore.getState().updateItemLocal(it.id, { description: e.target.value })}
                            onBlur={async () => { await useTemplatesStore.getState().updateItem(it.id, { description: useTemplatesStore.getState().templateItems.find(r=>r.id===it.id)?.description || '' }); }}
                            onKeyDown={async (e) => { if (e.key === 'Enter') { e.preventDefault(); await useTemplatesStore.getState().updateItem(it.id, { description: useTemplatesStore.getState().templateItems.find(r=>r.id===it.id)?.description || '' }); setEditingId(null) } }}
                          />
                        ) : (
                          <div className="whitespace-pre-wrap">{it.description}</div>
                        )
                        ) : (
                          <div className="whitespace-pre-wrap">{it.description}</div>
                        )}
                      </td>
                      {/* Категория */}
                      <td className={`px-2 py-2 align-top ${canManageTemplates ? '' : 'cursor-not-allowed opacity-70'}`} onClick={(e) => { if (!canManageTemplates) { e.preventDefault(); e.stopPropagation(); return } setEditingId(it.id) }} title={canManageTemplates ? undefined : 'Недостаточно прав: управление шаблонами'}>
                        {editingId === it.id ? (
                          canManageTemplates ? (
                          <Popover open={isCatOpen(it.id)} onOpenChange={(o) => setOpenCatId(o ? it.id : null)}>
                            <PopoverTrigger asChild>
                              <button className="inline-flex flex-wrap items-center text-left whitespace-normal break-words rounded-full px-2 py-0.5 text-[11px] font-medium bg-slate-200 text-slate-700 dark:bg-slate-700/60 dark:text-slate-100 hover:bg-slate-300 dark:hover:bg-slate-700 focus:outline-none focus:ring-0" onClick={(e) => { e.stopPropagation(); setOpenCatId(it.id) }}>
                                {categories.find(c => c.id === it.work_category_id)?.name || 'выбрать'}
                              </button>
                            </PopoverTrigger>
                            <PopoverContent align="start" sideOffset={6} className="p-0 w-[220px] text-[12px] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm">
                              <ScrollArea className="max-h-[240px]">
                                <div className="py-1">
                                  {categories.map(c => (
                                    <button key={c.id} className="w-full text-left px-2 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-700/60" onClick={async () => { useTemplatesStore.getState().updateItemLocal(it.id, { work_category_id: c.id }); await useTemplatesStore.getState().updateItem(it.id, { work_category_id: c.id }); setOpenCatId(null); }}>
                                      {c.name}
                                    </button>
            ))}
          </div>
                              </ScrollArea>
                            </PopoverContent>
                          </Popover>
                          ) : (
                            <span className="inline-block max-w-full whitespace-normal break-words rounded-full px-2 py-0.5 text-[11px] font-medium bg-slate-200 text-slate-700 dark:bg-slate-700/60 dark:text-slate-100">
                              {categories.find(c => c.id === it.work_category_id)?.name || '—'}
                            </span>
                          )
                        ) : (
                          <span className="inline-block max-w-full whitespace-normal break-words rounded-full px-2 py-0.5 text-[11px] font-medium bg-slate-200 text-slate-700 dark:bg-slate-700/60 dark:text-slate-100">
                            {categories.find(c => c.id === it.work_category_id)?.name || '—'}
                          </span>
                        )}
                      </td>
                      {/* План, ч */}
                      <td className={`px-2 py-2 align-top text-center tabular-nums ${canManageTemplates ? '' : 'cursor-not-allowed opacity-70'}`} onClick={(e) => { if (!canManageTemplates) { e.preventDefault(); e.stopPropagation(); return } setEditingId(it.id) }} title={canManageTemplates ? undefined : 'Недостаточно прав: управление шаблонами'}>
                        {editingId === it.id ? (
                          canManageTemplates ? (
                            <input
                  type="number"
                  step="0.25"
                            className="w-full h-8 px-2 py-1 text-[12px] bg-transparent border-0 outline-none focus:outline-none focus:ring-0 focus:border-0 appearance-none"
                            style={{ MozAppearance: 'textfield' as any }}
                            value={it.planned_hours}
                            onChange={(e) => useTemplatesStore.getState().updateItemLocal(it.id, { planned_hours: Number(e.target.value) })}
                            onBlur={async () => { const cur = useTemplatesStore.getState().templateItems.find(r=>r.id===it.id)?.planned_hours || 0; await useTemplatesStore.getState().updateItem(it.id, { planned_hours: cur }); }}
                            onKeyDown={async (e) => { if (e.key === 'Enter') { e.preventDefault(); const cur = useTemplatesStore.getState().templateItems.find(r=>r.id===it.id)?.planned_hours || 0; await useTemplatesStore.getState().updateItem(it.id, { planned_hours: cur }); setEditingId(null) } }}
                          />
                          ) : (
                            <>{Number(it.planned_hours || 0).toFixed(2)}</>
                          )
                        ) : (
                          Number(it.planned_hours || 0).toFixed(2)
                        )}
                      </td>
                      {/* ±дн */}
                      <td className={`px-2 py-2 align-top text-center ${canManageTemplates ? '' : 'cursor-not-allowed opacity-70'}`} onClick={(e) => { if (!canManageTemplates) { e.preventDefault(); e.stopPropagation(); return } setEditingId(it.id) }} title={canManageTemplates ? undefined : 'Недостаточно прав: управление шаблонами'}>
                        {editingId === it.id ? (
                          canManageTemplates ? (
                            <input
                  type="number"
                            className="w-full h-8 px-2 py-1 text-[12px] bg-transparent border-0 outline-none focus:outline-none focus:ring-0 focus:border-0 appearance-none"
                            style={{ MozAppearance: 'textfield' as any }}
                  placeholder="±дн"
                            value={it.due_offset_days ?? ''}
                            onChange={(e) => useTemplatesStore.getState().updateItemLocal(it.id, { due_offset_days: e.target.value === '' ? null : Number(e.target.value) })}
                            onBlur={async () => { const cur = useTemplatesStore.getState().templateItems.find(r=>r.id===it.id)?.due_offset_days ?? null; await useTemplatesStore.getState().updateItem(it.id, { due_offset_days: cur as any }); }}
                            onKeyDown={async (e) => { if (e.key === 'Enter') { e.preventDefault(); const cur = useTemplatesStore.getState().templateItems.find(r=>r.id===it.id)?.due_offset_days ?? null; await useTemplatesStore.getState().updateItem(it.id, { due_offset_days: cur as any }); setEditingId(null) } }}
                          />
                          ) : (
                            <>{it.due_offset_days != null ? `±${it.due_offset_days}` : '—'}</>
                          )
                        ) : (
                          it.due_offset_days != null ? `±${it.due_offset_days}` : '—'
                        )}
                      </td>
                      {/* Ответственный */}
                      <td className={`px-2 py-2 align-top ${canManageTemplates ? '' : 'cursor-not-allowed opacity-70'}`} onClick={(e) => { if (!canManageTemplates) { e.preventDefault(); e.stopPropagation(); return } setEditingId(it.id) }} title={canManageTemplates ? undefined : 'Недостаточно прав: управление шаблонами'}>
                        {editingId === it.id ? (
                          canManageTemplates ? (
                          <Popover open={isRespOpen(it.id)} onOpenChange={(o) => setOpenRespId(o ? it.id : null)}>
                            <PopoverTrigger asChild>
                              <button className="w-full h-7 px-2 rounded bg-transparent text-left text-[12px] hover:bg-slate-100 dark:hover:bg-slate-800 focus:outline-none focus:ring-0" onClick={(e) => { e.stopPropagation(); setOpenRespId(it.id) }}>
                                {(() => {
                                  const id = (it as any).responsible_id as (string | null | undefined)
                                  const p = id ? profiles.find(p => p.id === id) : null
                                  return p?.name || 'выбрать'
                                })()}
                              </button>
                            </PopoverTrigger>
                            <PopoverContent align="start" sideOffset={6} className="p-0 w-[260px] text-[12px] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm">
                              <div className="p-2">
                                <input value={responsibleFilter} onChange={(e) => setResponsibleFilter(e.target.value)} placeholder="Поиск" className="w-full h-7 px-2 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 outline-none text-[12px]" />
                              </div>
                              <ScrollArea className="max-h-[240px]">
                                <div className="py-1">
                                  {profiles
                                    .filter(p => {
                                      const q = responsibleFilter.trim().toLowerCase()
                                      if (!q) return true
                                      return p.name.toLowerCase().includes(q)
                                    })
                                    .map(p => (
                                      <button key={p.id} className="w-full text-left px-2 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-700/60" onClick={async () => { useTemplatesStore.getState().updateItemLocal(it.id, { responsible_id: p.id } as any); await useTemplatesStore.getState().updateItem(it.id, { responsible_id: p.id } as any); setResponsibleFilter(''); setOpenRespId(null); setEditingId(null) }}>{p.name}</button>
                                    ))}
                                </div>
                              </ScrollArea>
                            </PopoverContent>
                          </Popover>
                          ) : (
                            <span className="inline-block max-w-full truncate text-[11px]">{(() => { const id = (it as any).responsible_id as (string | null | undefined); const p = id ? profiles.find(p => p.id === id) : null; return p?.name || '—' })()}</span>
                          )
                        ) : (
                          <span className="inline-block max-w-full truncate text-[11px]">{(() => { const id = (it as any).responsible_id as (string | null | undefined); const p = id ? profiles.find(p => p.id === id) : null; return p?.name || '—' })()}</span>
                        )}
                      </td>
                      {/* % */}
                      <td className={`px-2 py-2 align-top text-center tabular-nums ${canManageTemplates ? '' : 'cursor-not-allowed opacity-70'}`} onClick={() => { if (canManageTemplates) setEditingId(it.id) }} title={canManageTemplates ? undefined : 'Недостаточно прав: управление шаблонами'}>
                        {editingId === it.id ? (
                          canManageTemplates ? (
                            <input
                            type="text"
                            className="w-full h-8 px-2 py-1 text-[12px] bg-transparent border-0 outline-none focus:outline-none focus:ring-0 focus:border-0"
                            value={(it as any).progress ?? 0}
                            onChange={(e) => { const v = e.target.value.replace(/[^0-9]/g, ''); const num = v === '' ? null : Math.max(0, Math.min(100, Number(v))); useTemplatesStore.getState().updateItemLocal(it.id, { progress: num } as any) }}
                            onBlur={async () => { const cur = (useTemplatesStore.getState().templateItems.find(r=>r.id===it.id) as any)?.progress ?? null; await useTemplatesStore.getState().updateItem(it.id, { progress: cur } as any); }}
                            onKeyDown={async (e) => { if (e.key === 'Enter') { e.preventDefault(); const cur = (useTemplatesStore.getState().templateItems.find(r=>r.id===it.id) as any)?.progress ?? null; await useTemplatesStore.getState().updateItem(it.id, { progress: cur } as any); setEditingId(null) } }}
                          />
                          ) : (
                            <>{((it as any).progress ?? 0)}%</>
                          )
                        ) : (
                          <>{((it as any).progress ?? 0)}%</>
                        )}
                      </td>
                      {/* Статус */}
                      <td className={`px-2 py-2 align-top ${canManageTemplates ? '' : 'cursor-not-allowed opacity-70'}`} onClick={() => { if (canManageTemplates) setEditingId(it.id) }} title={canManageTemplates ? undefined : 'Недостаточно прав: управление шаблонами'}>
                        {editingId === it.id ? (
                          canManageTemplates ? (
                          <Popover open={isStatusOpen(it.id)} onOpenChange={(o) => setOpenStatusId(o ? it.id : null)}>
                            <PopoverTrigger asChild>
                              <button className="inline-flex flex-wrap items-center text-left whitespace-normal break-words rounded-full px-2 py-0.5 text-[11px] font-medium bg-slate-200 text-slate-700 dark:bg-slate-700/60 dark:text-slate-100 hover:bg-slate-300 dark:hover:bg-slate-700 focus:outline-none focus:ring-0" onClick={(e) => { e.stopPropagation(); setOpenStatusId(it.id) }}>
                                {(() => { const sid = (it as any).status_id as (string | null | undefined); return statuses.find(s => s.id === sid)?.name || 'выбрать' })()}
                              </button>
                            </PopoverTrigger>
                            <PopoverContent align="start" sideOffset={6} className="p-0 w-[220px] text-[12px] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm">
                              <div className="py-1">
                                {statuses.map(s => (
                                  <button key={s.id} className="w-full text-left px-2 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-700/60" onClick={async () => { useTemplatesStore.getState().updateItemLocal(it.id, { status_id: s.id } as any); await useTemplatesStore.getState().updateItem(it.id, { status_id: s.id } as any); setOpenStatusId(null); setEditingId(null) }}>{s.name}</button>
                                ))}
                              </div>
                            </PopoverContent>
                          </Popover>
                          ) : (
                            <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200">{statuses.find(s => s.id === (it as any).status_id)?.name || '—'}</span>
                          )
                        ) : (
                          <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200">{statuses.find(s => s.id === (it as any).status_id)?.name || '—'}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                {/* Новая строка */}
                {selectedTemplate && (
                  <tbody>
                    <tr className="bg-slate-50 dark:bg-slate-800/60 [&>td]:border-slate-200 [&>td]:dark:border-slate-700">
                      <td className="px-2 py-1 align-middle border text-center">
                        <button
                          type="button"
                          disabled={!canManageTemplates || !canAdd}
                          title={canManageTemplates ? (canAdd ? 'Добавить строку' : 'Заполните обязательные поля') : 'Недостаточно прав: управление шаблонами'}
                          className="h-7 w-7 inline-flex items-center justify-center rounded-full text-slate-400 hover:text-slate-600 disabled:opacity-40 focus:outline-none focus:ring-0"
                  onClick={async () => {
                    if (!selectedTemplate) return
                    if (!canManageTemplates) return
                    await useTemplatesStore.getState().createItem({
                      template_id: selectedTemplate.id,
                      description: newDesc.trim(),
                      work_category_id: newCat,
                      planned_hours: Number(newHours) || 0,
                      due_offset_days: newOffset === '' ? null : Number(newOffset),
                      order: useTemplatesStore.getState().templateItems.length + 1,
                      status_id: newStatusId && newStatusId.trim().length > 0 ? newStatusId : null,
                      progress: newProgress === '' ? null : Math.max(0, Math.min(100, Number(newProgress))),
                    })
                            setNewDesc(''); setNewCat(''); setNewHours(''); setNewOffset(''); setNewProgress('')
                          }}
                        >
                          <PlusCircle className="h-4 w-4" />
                        </button>
                      </td>
                      <td className="px-2 py-1 align-middle border">
                        <input className="w-full h-8 px-2 py-1 text-[12px] bg-transparent border-0 outline-none focus:outline-none focus:ring-0 focus:border-0 disabled:opacity-60" placeholder="Описание работ (обязательно)" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} disabled={!canManageTemplates} />
                      </td>
                      <td className="px-2 py-1 align-middle border">
                        <Select value={newCat} onValueChange={setNewCat} disabled={!canManageTemplates}>
                          <SelectTrigger className="h-8 px-2 text-[12px] bg-transparent border-0 outline-none focus:outline-none focus:ring-0 focus:border-0 disabled:opacity-60"><SelectValue placeholder="Категория" /></SelectTrigger>
                          <SelectContent>{categories.map((c) => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}</SelectContent>
                        </Select>
                      </td>
                      <td className="px-2 py-1 align-middle text-center border">
                        <input className="w-full h-8 px-2 py-1 text-[12px] text-center bg-transparent border-0 outline-none focus:outline-none focus:ring-0 focus:border-0 disabled:opacity-60" placeholder="0" value={newHours} onChange={(e) => setNewHours(e.target.value)} disabled={!canManageTemplates} />
                      </td>
                      <td className="px-2 py-1 align-middle text-center border">
                        <input className="w-full h-8 px-2 py-1 text-[12px] text-center bg-transparent border-0 outline-none focus:outline-none focus:ring-0 focus:border-0 disabled:opacity-60" placeholder="±дн" value={newOffset} onChange={(e) => setNewOffset(e.target.value)} disabled={!canManageTemplates} />
                      </td>
                      <td className="px-2 py-1 align-middle border">
                        <span className="text-slate-400">—</span>
                      </td>
                      <td className="px-2 py-1 align-middle text-center border">
                        <input className="w-full h-8 px-2 py-1 text-[12px] text-center bg-transparent border-0 outline-none focus:outline-none focus:ring-0 focus:border-0 disabled:opacity-60" placeholder="%" value={newProgress} onChange={(e) => setNewProgress(e.target.value)} disabled={!canManageTemplates} />
                      </td>
                      <td className="px-2 py-1 align-middle border">
                        <Select value={newStatusId} onValueChange={setNewStatusId} disabled={!canManageTemplates}>
                          <SelectTrigger className="h-8 px-2 text-[12px] bg-transparent border-0 outline-none focus:outline-none focus:ring-0 focus:border-0 disabled:opacity-60"><SelectValue placeholder="Статус" /></SelectTrigger>
                          <SelectContent>{statuses.map((s) => (<SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>))}</SelectContent>
                        </Select>
                      </td>
                    </tr>
                  </tbody>
                )}
              </table>
        </div>
          ) : null}
        </InnerDialogContent>
      </InnerDialog>

      <div className="flex items-center justify-end gap-3">
        <Button onClick={onApply} disabled={!canApply}>{canApply ? 'Применить выбранный шаблон' : 'Выберите или откройте шаблон'}</Button>
      </div>

      <Dialog open={isCreateOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md w-[92vw] max-w-lg">
          <DialogHeader>
            <DialogTitle>Новый шаблон</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Название шаблона" />
            </div>
            <div className="flex justify-end">
              <Button onClick={onCreateTemplate} disabled={!name.trim() || !(depInStore || departmentId)}>Создать</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default TemplatesPanel

