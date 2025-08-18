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
  const [newDesc, setNewDesc] = useState('')
  const [newCat, setNewCat] = useState('')
  const [newHours, setNewHours] = useState('')
  const [newOffset, setNewOffset] = useState('')
  // Выбранный для применения шаблон
  const [applyId, setApplyId] = useState<string | null>(null)
  // Режим редактирования открытого шаблона
  const [isEditing, setIsEditing] = useState(false)

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

  useEffect(() => {
    if (depInStore) fetchTemplates()
  }, [depInStore, fetchTemplates])

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
    return newDesc.trim() && newCat && Number.isFinite(hours)
  }, [newDesc, newCat, newHours])

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
              <Button variant="outline" onClick={() => setIsEditing((v) => !v)}>{isEditing ? 'Готово' : 'Редактировать'}</Button>
            </div>
          </div>

          {/* Список позиций */}
          <div className="space-y-2 max-h-72 overflow-auto pr-1">
            {useTemplatesStore.getState().templateItems.length === 0 && (
              <div className="text-sm text-muted-foreground">Пока нет позиций</div>
            )}
            {useTemplatesStore.getState().templateItems.map((it) => (
              <div key={it.id} className="grid grid-cols-12 gap-2 items-center">
                {isEditing ? (
                  <>
                    <Input className="col-span-5" value={it.description} onChange={(e) => useTemplatesStore.getState().updateItem(it.id, { description: e.target.value })} />
                    <Select value={it.work_category_id} onValueChange={(v) => useTemplatesStore.getState().updateItem(it.id, { work_category_id: v })}>
                      <SelectTrigger className="col-span-3">
                        <SelectValue placeholder="Категория" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((c) => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}
                      </SelectContent>
                    </Select>
                    <Input type="number" step="0.25" className="col-span-2" value={it.planned_hours} onChange={(e) => useTemplatesStore.getState().updateItem(it.id, { planned_hours: Number(e.target.value) })} />
                    <Input type="number" className="col-span-1" placeholder="±дн" value={it.due_offset_days ?? ''} onChange={(e) => useTemplatesStore.getState().updateItem(it.id, { due_offset_days: e.target.value === '' ? null : Number(e.target.value) })} />
                    <Button variant="ghost" className="col-span-1" onClick={() => useTemplatesStore.getState().deleteItem(it.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </>
                ) : (
                  <>
                    <div className="col-span-5 truncate">{it.description}</div>
                    <div className="col-span-3 truncate">{categories.find(c => c.id === it.work_category_id)?.name || '—'}</div>
                    <div className="col-span-2 tabular-nums">{Number(it.planned_hours || 0).toFixed(2)}</div>
                    <div className="col-span-2 text-muted-foreground">{it.due_offset_days != null ? `±${it.due_offset_days} дн` : '—'}</div>
                  </>
                )}
              </div>
            ))}
          </div>

          {isEditing && (
            <div className="grid grid-cols-12 gap-2 items-center">
              <Input className="col-span-5" placeholder="Описание работ" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} />
              <Select value={newCat} onValueChange={setNewCat}>
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Категория" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}
                </SelectContent>
              </Select>
              <Input type="number" step="0.25" className="col-span-2" placeholder="План, ч" value={newHours} onChange={(e) => setNewHours(e.target.value)} />
              <Input type="number" className="col-span-1" placeholder="±дн" value={newOffset} onChange={(e) => setNewOffset(e.target.value)} />
              <Button className="col-span-1" disabled={!canAdd} onClick={async () => {
                if (!selectedTemplate) return
                await useTemplatesStore.getState().createItem({
                  template_id: selectedTemplate.id,
                  description: newDesc.trim(),
                  work_category_id: newCat,
                  planned_hours: Number(newHours) || 0,
                  due_offset_days: newOffset === '' ? null : Number(newOffset),
                  order: useTemplatesStore.getState().templateItems.length + 1,
                })
                setNewDesc(''); setNewCat(''); setNewHours(''); setNewOffset('')
              }}>
                <Check className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      )}

      <div className="flex items-center justify-end gap-3">
        <Button onClick={onApply} disabled={!canApply}>{canApply ? 'Применить выбранный шаблон' : 'Выберите или откройте шаблон'}</Button>
      </div>

      <Dialog open={isCreateOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Новый шаблон</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Label>Название</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Название шаблона" />
            <Button onClick={onCreateTemplate} disabled={!name.trim() || !(depInStore || departmentId)}>Создать</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

