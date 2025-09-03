"use client"

import React, { useEffect, useMemo, useState } from 'react'
import { useTemplatesStore } from '../store'
import type { DecompositionTemplate } from '../types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { applyTemplateAppend, validateTemplateApplicability } from '../api'
import { createClient } from '@/utils/supabase/client'
import { Check, Trash2 } from 'lucide-react'

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
  } = useTemplatesStore()

  // Даты больше не используем
  const [baseDate] = useState<string>('')
  const [name, setName] = useState('')
  const [isCreateOpen, setCreateOpen] = useState(false)
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([])
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([])
  const [profiles, setProfiles] = useState<{ id: string; name: string }[]>([])
  const [statuses, setStatuses] = useState<{ id: string; name: string }[]>([])
  const [newDesc, setNewDesc] = useState('')
  const [newCat, setNewCat] = useState('')
  const [newHours, setNewHours] = useState('')
  const [newOffset, setNewOffset] = useState('')
  const [newResponsible, setNewResponsible] = useState<string>('')
  const [newStatusId, setNewStatusId] = useState<string>('')
  const [newProgress, setNewProgress] = useState<string>('')
  // Выбранный для применения шаблон
  const [applyId, setApplyId] = useState<string | null>(null)
  // Режим редактирования открытого шаблона
  const [isEditing, setIsEditing] = useState(false)
  // Локальный текст поиска ответственного по строкам шаблона
  const [respSearchById, setRespSearchById] = useState<Record<string, string>>({})

  const supabase = createClient()

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

  // Синхронизируем плейсхолдеры поиска ответственных при открытии шаблона
  useEffect(() => {
    const items = useTemplatesStore.getState().templateItems
    if (!items) return
    const next: Record<string, string> = {}
    for (const it of items) {
      const id = (it as any).responsible_id as (string | null | undefined)
      const prof = id ? profiles.find(p => p.id === id) : null
      next[it.id] = prof?.name || ''
    }
    setRespSearchById(next)
  }, [selectedTemplate])

  const commitEdits = async () => {
    const items = useTemplatesStore.getState().templateItems
    const updates = items.map(async (it) => {
      const text = (respSearchById[it.id] || '').trim().toLowerCase()
      const match = profiles.find(p => p.name.toLowerCase() === text) ||
                    profiles.find(p => p.name.toLowerCase().startsWith(text)) ||
                    profiles.find(p => p.name.toLowerCase().includes(text))
      const responsible_id = match ? match.id : (it as any).responsible_id ?? null
      return await useTemplatesStore.getState().updateItem(it.id, {
        description: it.description,
        work_category_id: it.work_category_id,
        planned_hours: it.planned_hours,
        due_offset_days: it.due_offset_days ?? null,
        order: it.order,
        responsible_id: responsible_id as any,
        status_id: (it as any).status_id ?? null,
        progress: (it as any).progress ?? null,
      } as any)
    })
    await Promise.all(updates)
    // обновим плейсхолдеры из актуальных id после коммита
    const refreshed = useTemplatesStore.getState().templateItems
    const next: Record<string, string> = {}
    for (const it of refreshed) {
      const id = (it as any).responsible_id as (string | null | undefined)
      const prof = id ? profiles.find(p => p.id === id) : null
      next[it.id] = prof?.name || ''
    }
    setRespSearchById(next)
  }

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
        <Button variant="default" onClick={() => setCreateOpen(true)}>Создать шаблон</Button>
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
              <Button variant={applyId === tpl.id ? 'default' : 'outline'} onClick={() => setApplyId(tpl.id)}>
                {applyId === tpl.id ? 'Выбран' : 'Выбрать'}
              </Button>
              <Button variant="outline" onClick={async () => { await openTemplate(tpl.id); setApplyId(tpl.id); setIsEditing(false) }}>Открыть</Button>
            </div>
          </div>
        ))}
      </div>

      {selectedTemplate && (
        <div className="space-y-3 border rounded-md p-3">
          <div className="flex items-center justify-between">
            <div className="font-medium truncate">Содержимое: {selectedTemplate.name}</div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={async () => {
                  if (isEditing) {
                    await commitEdits()
                    setIsEditing(false)
                  } else {
                    setIsEditing(true)
                  }
                }}
              >
                {isEditing ? 'Готово' : 'Редактировать'}
              </Button>
            </div>
          </div>

          {/* Список позиций */}
          <div className="space-y-2 max-h-[70vh] overflow-auto pr-1">
            {useTemplatesStore.getState().templateItems.length === 0 && (
              <div className="text-sm text-muted-foreground">Пока нет позиций</div>
            )}
            {useTemplatesStore.getState().templateItems.map((it) => (
              <div key={it.id} className="">
                {isEditing ? (
                  <>
                    <div className="overflow-x-auto">
                      <div className="min-w-[1120px] flex flex-nowrap items-center gap-2 text-[10px]">
                        <Input className="h-8 px-2 py-1 text-[10px] w-[320px]" value={it.description} onChange={(e) => useTemplatesStore.getState().updateItemLocal(it.id, { description: e.target.value })} />
                        <Select value={it.work_category_id} onValueChange={(v) => { useTemplatesStore.getState().updateItemLocal(it.id, { work_category_id: v }) }}>
                          <SelectTrigger className="h-8 px-2 text-[10px] w-[160px]"><SelectValue placeholder="Категория" /></SelectTrigger>
                          <SelectContent>{categories.map((c) => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}</SelectContent>
                        </Select>
                        <Input type="number" step="0.25" className="h-8 px-2 py-1 text-[10px] w-[90px]" value={it.planned_hours} onChange={(e) => useTemplatesStore.getState().updateItemLocal(it.id, { planned_hours: Number(e.target.value) })} />
                        <Input type="number" className="h-8 px-2 py-1 text-[10px] w-[70px]" placeholder="±дн" value={it.due_offset_days ?? ''} onChange={(e) => useTemplatesStore.getState().updateItemLocal(it.id, { due_offset_days: e.target.value === '' ? null : Number(e.target.value) })} />
                        <input
                          list={`tpl-profiles-${it.id}`}
                          className="h-8 px-2 py-1 text-[10px] w-[220px] border border-slate-300 dark:border-slate-600 rounded-md dark:bg-slate-800 dark:text-white"
                          placeholder="Ответственный"
                          value={respSearchById[it.id] ?? ''}
                          onChange={(e) => setRespSearchById((prev) => ({ ...prev, [it.id]: e.target.value }))}
                          onKeyDown={async (e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault()
                              const text = (respSearchById[it.id] || '').trim().toLowerCase()
                              const match = profiles.find(p => p.name.toLowerCase() === text) ||
                                            profiles.find(p => p.name.toLowerCase().startsWith(text)) ||
                                            profiles.find(p => p.name.toLowerCase().includes(text))
                              const selectedId = match ? match.id : null
                              useTemplatesStore.getState().updateItemLocal(it.id, { responsible_id: selectedId } as any)
                              await useTemplatesStore.getState().updateItem(it.id, { responsible_id: selectedId } as any)
                              setRespSearchById((prev) => ({ ...prev, [it.id]: match?.name || '' }))
                            }
                          }}
                          onBlur={async (e) => {
                            const text = (respSearchById[it.id] || '').trim().toLowerCase()
                            const match = profiles.find(p => p.name.toLowerCase() === text)
                            if (!match) {
                              useTemplatesStore.getState().updateItemLocal(it.id, { responsible_id: null } as any)
                              await useTemplatesStore.getState().updateItem(it.id, { responsible_id: null } as any)
                              setRespSearchById((prev) => ({ ...prev, [it.id]: '' }))
                            }
                          }}
                        />
                        <datalist id={`tpl-profiles-${it.id}`}>
                          <option value="" />
                          {profiles.map(p => (<option key={p.id} value={p.name} />))}
                        </datalist>
                        <Select value={(it as any).status_id || ''} onValueChange={(v) => { const val = (v && v.trim().length > 0) ? v : null; useTemplatesStore.getState().updateItemLocal(it.id, { status_id: val } as any) }}>
                          <SelectTrigger className="h-8 px-2 text-[10px] w-[140px]"><SelectValue placeholder="Статус" /></SelectTrigger>
                          <SelectContent>{statuses.map((s) => (<SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>))}</SelectContent>
                        </Select>
                        <Input type="number" min="0" max="100" className="h-8 px-2 py-1 text-[10px] w-[64px]" placeholder="%" value={(it as any).progress ?? ''} onChange={(e) => {
                          const v = e.target.value === '' ? null : Math.max(0, Math.min(100, Number(e.target.value)))
                          useTemplatesStore.getState().updateItemLocal(it.id, { progress: v } as any)
                        }} />
                        <Button variant="ghost" className="h-8 w-[36px] px-0" onClick={() => useTemplatesStore.getState().deleteItem(it.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="overflow-x-auto">
                    <div className="min-w-[1120px] flex flex-nowrap items-center gap-2 text-[11px]">
                      <div className="w-[320px] truncate font-medium">{it.description}</div>
                      <div className="w-[160px] truncate text-muted-foreground">{categories.find(c => c.id === it.work_category_id)?.name || '—'}</div>
                      <div className="w-[90px] text-right tabular-nums">{Number(it.planned_hours || 0).toFixed(2)}</div>
                      <div className="w-[70px] text-muted-foreground">{it.due_offset_days != null ? `±${it.due_offset_days}` : '—'}</div>
                      {/* Ответственный не отображается в шаблоне */}
                      <div className="w-[220px] truncate text-right">—</div>
                      <div className="w-[140px]">
                        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200">
                          {statuses.find(s => s.id === (it as any).status_id)?.name || '—'}
                        </span>
                      </div>
                      <div className="w-[64px] text-right">{(it as any).progress ?? 0}%</div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {isEditing && (
            <div className="overflow-x-auto">
              <div className="min-w-[1120px] flex flex-nowrap items-center gap-2 text-[10px]">
                <Input
                  className="h-8 px-2 py-1 text-[10px] w-[320px] shrink-0"
                  placeholder="Описание работ (обязательно)"
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                />
                <Select value={newCat} onValueChange={setNewCat}>
                  <SelectTrigger className="h-8 px-2 text-[10px] w-[160px] shrink-0">
                    <SelectValue placeholder="Категория" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  step="0.25"
                  className="h-8 px-2 py-1 text-[10px] w-[90px] shrink-0"
                  placeholder="План, ч"
                  value={newHours}
                  onChange={(e) => setNewHours(e.target.value)}
                />
                <Input
                  type="number"
                  className="h-8 px-2 py-1 text-[10px] w-[70px] shrink-0"
                  placeholder="±дн"
                  value={newOffset}
                  onChange={(e) => setNewOffset(e.target.value)}
                />
                {/* Поле ответственного удалено из шаблона по требованию */}
                <Select value={newStatusId} onValueChange={setNewStatusId}>
                  <SelectTrigger className="h-8 px-2 text-[10px] w-[140px] shrink-0">
                    <SelectValue placeholder="Статус" />
                  </SelectTrigger>
                  <SelectContent>
                    {statuses.map((s) => (<SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>))}
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  className="h-8 px-2 py-1 text-[10px] w-[64px] shrink-0"
                  placeholder="%"
                  value={newProgress}
                  onChange={(e) => setNewProgress(e.target.value)}
                />
                <Button
                  className="h-8 px-2 text-[10px] w-[36px] shrink-0 flex items-center justify-center"
                  disabled={!canAdd}
                  onClick={async () => {
                    if (!selectedTemplate) return
                    await useTemplatesStore.getState().createItem({
                      template_id: selectedTemplate.id,
                      description: newDesc.trim(),
                      work_category_id: newCat,
                      planned_hours: Number(newHours) || 0,
                      due_offset_days: newOffset === '' ? null : Number(newOffset),
                      order: useTemplatesStore.getState().templateItems.length + 1,
                      responsible_id: newResponsible && newResponsible.trim().length > 0 ? newResponsible : null,
                      status_id: newStatusId && newStatusId.trim().length > 0 ? newStatusId : null,
                      progress: newProgress === '' ? null : Math.max(0, Math.min(100, Number(newProgress))),
                    })
                    setNewDesc(''); setNewCat(''); setNewHours(''); setNewOffset(''); setNewResponsible(''); setNewProgress('')
                  }}
                >
                  <Check className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

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
              <Label className="mb-1 block">Название</Label>
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

