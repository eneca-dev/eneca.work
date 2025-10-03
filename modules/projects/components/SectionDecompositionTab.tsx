"use client"

import React, { useEffect, useMemo, useState, KeyboardEvent, useRef } from "react"
import * as Sentry from "@sentry/nextjs"
import { createClient } from "@/utils/supabase/client"
import { Loader2, MoreHorizontal, Trash2, PlusCircle, Clock, LayoutTemplate, Edit3, Check, X } from "lucide-react"
import { useUiStore } from "@/stores/useUiStore"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import AddWorkLogModal from "./AddWorkLogModal"
import { DecompositionStagesChart } from "./DecompositionStagesChart"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { TemplatesPanel } from "@/modules/decomposition-templates"
// no slider for progress editing; using numeric input and a capsule view
import { DatePicker as ProjectDatePicker } from "@/modules/projects/components/DatePicker"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useHasPermission } from "@/modules/permissions"

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
  decomposition_item_stage_id: string | null
  responsible_profile?: Profile | null
  status?: SectionStatus | null
}

// Создание клиента Supabase внутри компонента через useMemo,
// чтобы избежать проблем с SSR и повторным созданием соединений

export function SectionDecompositionTab({ sectionId, compact = false }: SectionDecompositionTabProps) {
  const supabase = useMemo(() => createClient(), [])
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
  const [newResponsibleId, setNewResponsibleId] = useState<string | null>(null)
  const [newProgress, setNewProgress] = useState("0")
  const newDescRef = useRef<HTMLTextAreaElement | null>(null)

  // Состояние для работы с профилями
  const [profiles, setProfiles] = useState<Profile[]>([])
  
  // Состояние для работы со статусами
  const [statuses, setStatuses] = useState<SectionStatus[]>([])
  const [newStatusId, setNewStatusId] = useState("")
  const [newStageId, setNewStageId] = useState<string | null>(null)
  // Стадии (этапы) для группировки/назначения
  const [stages, setStages] = useState<{ id: string; name: string; start: string | null; finish: string | null; description: string | null }[]>([])
  const [groupByStage, setGroupByStage] = useState(true)

  // Состояния для ответственного (убираем поиск и dropdown, как у категории)

  // Inline edit state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<DecompositionItemRow | null>(null)
  const [responsibleSearch, setResponsibleSearch] = useState<string>("")
  const [savingId, setSavingId] = useState<string | null>(null)
  const editDescRef = useRef<HTMLTextAreaElement | null>(null)
  const [isLogModalOpen, setIsLogModalOpen] = useState(false)
  const [selectedForLog, setSelectedForLog] = useState<string | null>(null)
  const [isTemplatesOpen, setIsTemplatesOpen] = useState(false)
  const [departmentId, setDepartmentId] = useState<string | null>(null)
  const [sectionStartDate, setSectionStartDate] = useState<string | null>(null)
  const [responsibleFilter, setResponsibleFilter] = useState<string>("")
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)

  // Управление открытием popover-окон по строкам
  const [openCatId, setOpenCatId] = useState<string | null>(null)
  const [openRespId, setOpenRespId] = useState<string | null>(null)
  const [openStatusId, setOpenStatusId] = useState<string | null>(null)
  const [openStagePicker, setOpenStagePicker] = useState<boolean>(false)
  const [createStageOpen, setCreateStageOpen] = useState<boolean>(false)
  const [createStageDraft, setCreateStageDraft] = useState<{ name: string; start: string | null; finish: string | null; description: string | null }>({ name: "", start: null, finish: null, description: null })

  const isCatOpen = (id: string) => openCatId === id
  const isRespOpen = (id: string) => openRespId === id
  const isStatusOpen = (id: string) => openStatusId === id

  // Утилита авто-ресайза для textarea
  const autoResizeTextarea = (element: HTMLTextAreaElement) => {
    element.style.height = 'auto'
    const h = Math.min(160, Math.max(28, element.scrollHeight))
    element.style.height = h + 'px'
  }

  // Debounce для поля описания, чтобы избежать лавинообразных обновлений при быстром вводе
  const descDebounceRef = useRef<number | null>(null)
  const handleDescriptionChange = (value: string) => {
    if (descDebounceRef.current) {
      window.clearTimeout(descDebounceRef.current)
    }
    // Короткая задержка сглаживает поток событий и предотвращает глубокие цепочки обновлений
    descDebounceRef.current = window.setTimeout(() => {
      setEditDraft(prev => (prev ? { ...prev, decomposition_item_description: value } as DecompositionItemRow : prev))
    }, 50) as unknown as number
  }

  useEffect(() => {
    return () => {
      if (descDebounceRef.current) window.clearTimeout(descDebounceRef.current)
    }
  }, [])

  // Права на редактирование полей декомпозиции
  const canEditDueDate = useHasPermission('dec.items.edit_due_date')
  const canEditPlannedHours = useHasPermission('dec.items.edit_planned_hours')
  const canEditResponsible = useHasPermission('dec.items.edit_responsible')
  const canEditStatus = useHasPermission('dec.items.edit_status')
  const canEditProgress = useHasPermission('dec.items.edit_progress')
  const canDeleteItem = useHasPermission('dec.items.delete')


  useEffect(() => {
    if (!sectionId) return
    const init = async () => {
      setLoading(true)
      try {
        const [cats, rows, totals, profilesRes, statusesRes, stagesRes] = await Promise.all([
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
              decomposition_item_stage_id,
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
            .order("name", { ascending: true }),
          supabase
            .from('decomposition_stages')
            .select('decomposition_stage_id, decomposition_stage_name, decomposition_stage_start, decomposition_stage_finish, decomposition_stage_description')
            .eq('decomposition_stage_section_id', sectionId)
            .order('decomposition_stage_order', { ascending: true })
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
        if (!stagesRes.error) {
          setStages(
            (stagesRes.data as any[]).map((s) => ({
              id: s.decomposition_stage_id as string,
              name: s.decomposition_stage_name as string,
              start: (s.decomposition_stage_start as string) || null,
              finish: (s.decomposition_stage_finish as string) || null,
              description: (s.decomposition_stage_description as string) || null,
            }))
          )
        }
        
        // Устанавливаем статус по умолчанию "План" для новых строк
        const defaultStatus = statusesRes.data?.find((s: any) => s.name === "План")
        if (defaultStatus) {
          setNewStatusId(defaultStatus.id)
        }
        
        // Обрабатываем данные и нормализуем profiles и статусы
        const normalizedItems = (rows.data || []).map((item: any) => ({
          ...item,
          responsible_profile: item.profiles || null,
          status: item.section_statuses || null,
          decomposition_item_stage_id: item.decomposition_item_stage_id || null,
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

  const formatISODate = (date: Date): string => {
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }

  const categoryById = useMemo(() => {
    const map = new Map<string, string>()
    categories.forEach(c => map.set(c.work_category_id, c.work_category_name))
    return map
  }, [categories])

  const stageNameById = useMemo(() => {
    const map = new Map<string, string>()
    stages.forEach(s => map.set(s.id, s.name))
    return map
  }, [stages])

  // Группировка по этапам (без изменения текущего UX по умолчанию)
  const itemsByStage = useMemo(() => {
    const map = new Map<string, DecompositionItemRow[]>()
    for (const it of items) {
      const sid = it.decomposition_item_stage_id || "__no_stage__"
      if (!map.has(sid)) map.set(sid, [])
      map.get(sid)!.push(it)
    }
    return map
  }, [items])

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
  // Мемоизация фильтрации профилей по вводу поиска
  const filteredProfiles = useMemo(() => {
    const q = responsibleFilter.trim().toLowerCase()
    if (!q) return profiles
    return profiles.filter(p => {
      const name = `${p.first_name || ''} ${p.last_name || ''}`.trim() || p.email
      return name.toLowerCase().includes(q)
    })
  }, [profiles, responsibleFilter])

  // Простая функция для получения имени ответственного (как у категории)

  // Общая select-строка для выбора полей декомпозиции и связанных сущностей
  const DECOMPOSITION_SELECT_QUERY = `
    decomposition_item_id, 
    decomposition_item_description, 
    decomposition_item_work_category_id, 
    decomposition_item_planned_hours, 
    decomposition_item_planned_due_date, 
    decomposition_item_order,
    decomposition_item_responsible,
    decomposition_item_status_id,
    decomposition_item_progress,
    decomposition_item_stage_id,
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
  `

  // Единая функция перезагрузки данных декомпозиции текущего раздела
  const reloadDecompositionData = async (): Promise<{ data: any[] | null; error: any | null }> => {
    const { data, error } = await supabase
      .from("decomposition_items")
      .select(DECOMPOSITION_SELECT_QUERY)
      .eq("decomposition_item_section_id", sectionId)
      .order("decomposition_item_order", { ascending: true })
      .order("decomposition_item_created_at", { ascending: true })

    if (error) {
      return { data: null, error }
    }

    const normalized = ((data as any[]) || []).map((item: any) => ({
      ...item,
      responsible_profile: item.profiles || null,
      status: item.section_statuses || null,
      decomposition_item_stage_id: item.decomposition_item_stage_id || null,
    })) as DecompositionItemRow[]

    setItems(normalized)
    return { data, error: null }
  }

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
      // Ответственный выбирается напрямую из состояния формы
      const responsibleId: string | null = newResponsibleId
      // Формируем объект вставки: обязательные поля всегда задаём, редактируемые — только при наличии прав
      const insertData: any = {
        decomposition_item_section_id: sectionId,
        decomposition_item_description: newDescription.trim(),
        decomposition_item_work_category_id: newCategoryId,
        decomposition_item_order: nextOrder,
        // Даже без права редактирования при создании задаём безопасные значения по умолчанию
        decomposition_item_planned_hours: Number(newPlannedHours) || 0,
        decomposition_item_planned_due_date: canEditDueDate ? (newPlannedDueDate || null) : null,
        decomposition_item_responsible: canEditResponsible ? responsibleId : null,
        decomposition_item_status_id: canEditStatus ? (newStatusId || null) : null,
        decomposition_item_progress: Number(newProgress) || 0,
        decomposition_item_stage_id: newStageId || null,
      }

      const { error } = await supabase
        .from("decomposition_items")
        .insert(insertData)

      if (error) throw error

      // Перезагрузка данных списка после вставки
      const { error: reloadErr } = await reloadDecompositionData()
      if (reloadErr) throw reloadErr

      setNewDescription("")
      setNewCategoryId("")
      setNewPlannedHours("")
      setNewPlannedDueDate("")
      setNewResponsibleId(null)
      setNewProgress("0")
      // Сохраняем выбранный этап, не сбрасываем newStageId умышленно
      // Сбрасываем статус на "План" (по умолчанию)
      const defaultStatus = statuses.find(s => s.name === "План")
      if (defaultStatus) {
        setNewStatusId(defaultStatus.id)
      }
      setNotification("Строка декомпозиции добавлена")
    } catch (error: unknown) {
      const message = error instanceof Error
        ? error.message
        : (typeof error === 'string' ? error : JSON.stringify(error))
      console.error("Ошибка добавления строки декомпозиции:", message, error)
      setNotification("Ошибка добавления строки декомпозиции")
    } finally {
      setSaving(false)
    }
  }

  // Быстрое добавление этапа из вкладки Декомпозиции
  const handleCreateStage = async () => {
    try {
      if (!sectionId) return
      setSaving(true)
      const nextOrder = (stages.length > 0 ? Math.max(...stages.map(s => Number.isFinite(Number((s as any).order)) ? (s as any).order : 0)) + 1 : 1)
      const { data, error } = await supabase
        .from('decomposition_stages')
        .insert({
          decomposition_stage_section_id: sectionId,
          decomposition_stage_name: (createStageDraft.name || 'Новый этап'),
          decomposition_stage_start: createStageDraft.start || null,
          decomposition_stage_finish: createStageDraft.finish || null,
          decomposition_stage_description: createStageDraft.description || null,
          decomposition_stage_order: nextOrder,
        })
        .select('decomposition_stage_id')
        .single()
      if (error) throw error
      // Перезагрузим список этапов
      const stRes = await supabase
        .from('decomposition_stages')
        .select('decomposition_stage_id, decomposition_stage_name, decomposition_stage_start, decomposition_stage_finish, decomposition_stage_description, decomposition_stage_order')
        .eq('decomposition_stage_section_id', sectionId)
        .order('decomposition_stage_order', { ascending: true })
      if (!stRes.error) {
        setStages((stRes.data as any[]).map(s => ({
          id: s.decomposition_stage_id,
          name: s.decomposition_stage_name,
          start: s.decomposition_stage_start || null,
          finish: s.decomposition_stage_finish || null,
          description: s.decomposition_stage_description || null,
        })))
      }
      setGroupByStage(true)
      setNewStageId((data as any)?.decomposition_stage_id || null)
      setNotification('Этап создан')
    } catch (e) {
      console.error('Ошибка создания этапа:', e)
      Sentry.captureException(e, { tags: { area: 'decomposition' }, extra: { sectionId } })
      setNotification('Ошибка создания этапа')
    } finally {
      setSaving(false)
    }
  }

  // Быстрое добавление строки в указанный этап (с безопасными дефолтами)
  const handleQuickAddItemToStage = async (stageId: string) => {
    try {
      if (!sectionId) return
      // Нужна категория — возьмём первую в списке
      const defaultCategory = categories[0]?.work_category_id
      if (!defaultCategory) {
        setNotification('Нет категорий работ — добавление невозможно')
        return
      }
      const nextOrder = (items[items.length - 1]?.decomposition_item_order ?? -1) + 1
      const { error } = await supabase
        .from('decomposition_items')
        .insert({
          decomposition_item_section_id: sectionId,
          decomposition_item_description: 'Новая строка',
          decomposition_item_work_category_id: defaultCategory,
          decomposition_item_planned_hours: 0,
          decomposition_item_order: nextOrder,
          decomposition_item_planned_due_date: null,
          decomposition_item_responsible: null,
          decomposition_item_status_id: newStatusId || null,
          decomposition_item_progress: 0,
          decomposition_item_stage_id: stageId,
        })
      if (error) throw error
      const { error: reloadErr } = await reloadDecompositionData()
      if (reloadErr) throw reloadErr
      setNotification('Строка добавлена')
    } catch (e) {
      console.error('Ошибка добавления строки:', e)
      Sentry.captureException(e, { tags: { area: 'decomposition' }, extra: { sectionId, stageId } })
      setNotification('Ошибка добавления строки')
    }
  }

  // ===== Редактирование этапа =====
  const [editingStageId, setEditingStageId] = useState<string | null>(null)
  const [stageEditDraft, setStageEditDraft] = useState<{ name: string; start: string | null; finish: string | null; description: string | null } | null>(null)

  const startEditStage = (stage: { id: string; name: string; start: string | null; finish: string | null; description: string | null }) => {
    setEditingStageId(stage.id)
    setStageEditDraft({
      name: stage.name,
      start: stage.start,
      finish: stage.finish,
      description: stage.description || null,
    })
  }

  const cancelEditStage = () => {
    setEditingStageId(null)
    setStageEditDraft(null)
  }

  const saveStageEdit = async (stageId: string) => {
    if (!stageEditDraft) return
    try {
      setSaving(true)
      const { error } = await supabase
        .from('decomposition_stages')
        .update({
          decomposition_stage_name: stageEditDraft.name,
          decomposition_stage_start: stageEditDraft.start,
          decomposition_stage_finish: stageEditDraft.finish,
          decomposition_stage_description: stageEditDraft.description,
        })
        .eq('decomposition_stage_id', stageId)
      if (error) throw error

      setStages(prev => prev.map(s => s.id === stageId ? {
        ...s,
        name: stageEditDraft.name,
        start: stageEditDraft.start,
        finish: stageEditDraft.finish,
        description: stageEditDraft.description,
      } : s))
      setNotification('Этап обновлён')
      setEditingStageId(null)
      setStageEditDraft(null)
    } catch (e) {
      console.error('Ошибка обновления этапа:', e)
      Sentry.captureException(e, { tags: { area: 'decomposition' }, extra: { stageId, draft: stageEditDraft } })
      setNotification('Ошибка обновления этапа')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteStage = async (stageId: string) => {
    try {
      setSaving(true)
      // Сначала отвязываем элементы
      const { error: updErr } = await supabase
        .from('decomposition_items')
        .update({ decomposition_item_stage_id: null })
        .eq('decomposition_item_stage_id', stageId)
      if (updErr) throw updErr

      // Затем удаляем этап
      const { error } = await supabase
        .from('decomposition_stages')
        .delete()
        .eq('decomposition_stage_id', stageId)
      if (error) throw error

      // Локально обновляем
      setStages(prev => prev.filter(s => s.id !== stageId))
      setItems(prev => prev.map(i => i.decomposition_item_stage_id === stageId ? { ...i, decomposition_item_stage_id: null } : i))
      setNotification('Этап удалён')
      if (editingStageId === stageId) {
        setEditingStageId(null)
        setStageEditDraft(null)
      }
    } catch (e) {
      console.error('Ошибка удаления этапа:', e)
      Sentry.captureException(e, { tags: { area: 'decomposition' }, extra: { stageId } })
      setNotification('Ошибка удаления этапа')
    } finally {
      setSaving(false)
    }
  }

  const startEdit = (item: DecompositionItemRow) => {
    setEditingId(item.decomposition_item_id)
    setEditDraft({ ...item })
    setResponsibleSearch(getResponsibleName(item) || "")
  }

  // Автоустановка высоты textarea описания при входе в редактирование и при изменении текста
  useEffect(() => {
    if (!editingId || !editDescRef.current) return
    autoResizeTextarea(editDescRef.current)
  }, [editingId, editDraft?.decomposition_item_description])

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
      // Фильтруем patch по правам: запрещённые поля не обновляем
      const safePatch: any = {}
      if (Object.prototype.hasOwnProperty.call(patch, 'decomposition_item_work_category_id')) {
        // Категорию можно менять без специальных прав
        safePatch.decomposition_item_work_category_id = patch.decomposition_item_work_category_id
      }
      if (Object.prototype.hasOwnProperty.call(patch, 'decomposition_item_responsible') && canEditResponsible) {
        safePatch.decomposition_item_responsible = patch.decomposition_item_responsible
      }
      if (Object.prototype.hasOwnProperty.call(patch, 'decomposition_item_status_id') && canEditStatus) {
        safePatch.decomposition_item_status_id = patch.decomposition_item_status_id
      }

      const { error } = await supabase
        .from('decomposition_items')
        .update(safePatch)
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
      // Обновляем только разрешённые поля
      const updateData: any = {
        decomposition_item_description: merged.decomposition_item_description,
        decomposition_item_work_category_id: merged.decomposition_item_work_category_id,
      }
      if (canEditPlannedHours) updateData.decomposition_item_planned_hours = Number(merged.decomposition_item_planned_hours)
      if (canEditDueDate) updateData.decomposition_item_planned_due_date = merged.decomposition_item_planned_due_date
      if (canEditResponsible) updateData.decomposition_item_responsible = merged.decomposition_item_responsible
      if (canEditStatus) updateData.decomposition_item_status_id = merged.decomposition_item_status_id
      if (canEditProgress) updateData.decomposition_item_progress = Number(merged.decomposition_item_progress) || 0

      const { error } = await supabase
        .from('decomposition_items')
        .update(updateData)
        .eq('decomposition_item_id', editingId)
      if (error) throw error

      const enriched: DecompositionItemRow = {
        ...merged,
        // Обновляем производные поля только если соответствующее поле могло быть изменено
        responsible_profile: (canEditResponsible && merged.decomposition_item_responsible)
          ? (profiles.find(p => p.user_id === merged.decomposition_item_responsible) || null)
          : merged.responsible_profile ?? null,
        status: (canEditStatus && merged.decomposition_item_status_id)
          ? (statuses.find(s => s.id === merged.decomposition_item_status_id) || null)
          : merged.status ?? null,
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
    // Защита: при отсутствии права не позволяем удалять
    if (!canDeleteItem) {
      setNotification('Недостаточно прав: удаление строки')
      return
    }
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

  // Перемещение строки в этап / без этапа
  const moveItemToStage = async (id: string, stageId: string | null) => {
    try {
      setSavingId(id)
      const { error } = await supabase
        .from('decomposition_items')
        .update({ decomposition_item_stage_id: stageId })
        .eq('decomposition_item_id', id)
      if (error) throw error
      setItems(prev => prev.map(i => i.decomposition_item_id === id ? { ...i, decomposition_item_stage_id: stageId } : i))
      if (editDraft && editDraft.decomposition_item_id === id) setEditDraft({ ...editDraft, decomposition_item_stage_id: stageId } as DecompositionItemRow)
      setNotification('Строка перемещена')
    } catch (e) {
      console.error('Ошибка перемещения строки в этап:', e)
      Sentry.captureException(e, { tags: { area: 'decomposition' }, extra: { sectionId, id, stageId } })
      setNotification('Ошибка перемещения')
    } finally {
      setSavingId(null)
    }
  }

  // Фиксированная сетка колонок для стабильной вёрстки (Notion-стиль)
  // Единая сетка колонок для идеального выравнивания
  // [шаблон/лог/плюс, описание (растяжение), категория, ответственный, статус, процент, план, факт, срок]
  // Первая колонка max-content: вмещает кнопку "Шаблон" в шапке и иконку лога в строках
  const rowGridClass = compact
    ? "grid grid-cols-[max-content_1fr_160px_150px_100px_64px_72px_88px_136px]"
    : "grid grid-cols-[max-content_1fr_200px_180px_120px_80px_96px_96px_160px]"

  // Единый рендер строки, чтобы переиспользовать как в обычном режиме, так и при группировке
  const renderItemRow = (item: DecompositionItemRow) => (
    <tr
      key={item.decomposition_item_id}
      className={`hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors ${
        editingId === item.decomposition_item_id
          ? '[&>td]:border [&>td]:border-slate-200 [&>td]:dark:border-slate-700'
          : '[&>td]:border-0'
      }`}
    >
      {/* Лог */}
      <td className="px-2 py-2 align-middle border">
        <div className="relative flex items-center justify-center">
          <button className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700" title="Добавить отчет" onClick={() => { setSelectedForLog(item.decomposition_item_id); setIsLogModalOpen(true); }}>
            <Clock className={compact ? 'h-3.5 w-3.5 text-emerald-600' : 'h-4 w-4 text-emerald-600'} />
          </button>
          {logsCountByItemId[item.decomposition_item_id] ? (
            <span className="absolute -top-1 -right-1 inline-flex items-center justify-center min-w-[14px] h-[14px] rounded-full bg-emerald-600 text-white text-[10px] leading-none px-[4px]">
              {Math.min(99, logsCountByItemId[item.decomposition_item_id])}
            </span>
          ) : null}
        </div>
      </td>

      {/* Описание */}
      <td className="px-2 py-2 align-middle border" onClick={() => startEdit(item)}>
        {editingId === item.decomposition_item_id ? (
          <textarea
            autoFocus
            ref={editDescRef}
            value={editDraft?.decomposition_item_description || ""}
            onChange={e => handleDescriptionChange(e.target.value)}
            onInput={(e) => autoResizeTextarea(e.currentTarget)}
            onKeyDown={handleEditKey}
            rows={1}
            style={{ overflow: 'hidden' }}
            className="w-full px-1 py-[6px] bg-transparent border-0 focus:ring-0 focus:border-0 outline-none focus:outline-none dark:bg-transparent dark:text-white resize-none overflow-hidden leading-[18px]"
          />
        ) : (
          <div
            title={item.decomposition_item_description}
            className="whitespace-pre-wrap line-clamp-3 break-words overflow-hidden"
          >
            {item.decomposition_item_description}
          </div>
        )}
      </td>

      {/* Категория */}
      <td className={`px-2 ${editingId === item.decomposition_item_id ? 'py-1' : 'py-2'} align-middle border`} onClick={() => startEdit(item)}>
        {editingId === item.decomposition_item_id ? (
          <Popover open={isCatOpen(item.decomposition_item_id)} onOpenChange={(o) => setOpenCatId(o ? item.decomposition_item_id : null)}>
            <PopoverTrigger asChild>
              <button className="inline-flex flex-wrap items-center text-left whitespace-normal break-words rounded-full px-2 py-0.5 text-xs font-medium bg-slate-200 text-slate-700 dark:bg-slate-700/60 dark:text-slate-100 hover:bg-slate-300 dark:hover:bg-slate-700 w-auto max-w-full" onClick={(e) => { e.stopPropagation(); setOpenCatId(item.decomposition_item_id) }}>
                {categoryById.get(editDraft?.decomposition_item_work_category_id || item.decomposition_item_work_category_id) || <span className="text-slate-400">Выбрать</span>}
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" sideOffset={6} className="p-0 w-[220px] text-[12px] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm">
              <ScrollArea className="max-h-[240px]">
                <div className="py-1">
                  {categories.map(c => (
                    <button
                      key={c.work_category_id}
                      className="w-full text-left px-2 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-700/60"
                      onClick={() => {
                        const v = c.work_category_id
                        setEditDraft(prev => prev ? { ...prev, decomposition_item_work_category_id: v } as DecompositionItemRow : prev)
                        updateItemFields(item.decomposition_item_id, { decomposition_item_work_category_id: v })
                        setOpenCatId(null)
                      }}
                    >
                      {c.work_category_name}
                    </button>
                  ))}
                </div>
              </ScrollArea>
            </PopoverContent>
          </Popover>
        ) : (
          <span className="inline-block max-w-full whitespace-normal break-words rounded-full px-2 py-0.5 text-xs font-medium bg-slate-200 text-slate-700 dark:bg-slate-700/60 dark:text-slate-100">
            {categoryById.get(item.decomposition_item_work_category_id) || "—"}
          </span>
        )}
      </td>

      {/* Ответственный */}
      <td className={`px-2 ${editingId === item.decomposition_item_id ? 'py-1' : 'py-2'} align-middle border ${canEditResponsible ? '' : 'opacity-70'}`} onClick={() => { if (canEditResponsible) startEdit(item) }}>
        {editingId === item.decomposition_item_id ? (
          canEditResponsible ? (
            <Popover open={isRespOpen(item.decomposition_item_id)} onOpenChange={(o) => setOpenRespId(o ? item.decomposition_item_id : null)}>
              <PopoverTrigger asChild>
                <button className="w-full h-7 px-2 rounded bg-transparent text-left text-[12px] hover:bg-slate-100 dark:hover:bg-slate-800" onClick={(e) => { e.stopPropagation(); setOpenRespId(item.decomposition_item_id) }}>
                  {getResponsibleName(editDraft || item as any) || <span className="text-slate-400">Выбрать</span>}
                </button>
              </PopoverTrigger>
              <PopoverContent align="start" sideOffset={6} className="p-0 w-[260px] text-[12px] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm">
                <div className="p-2">
                  <input
                    value={responsibleFilter}
                    onChange={(e) => setResponsibleFilter(e.target.value)}
                    placeholder="Поиск"
                    className="w-full h-7 px-2 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 outline-none text-[12px]"
                  />
                </div>
                <ScrollArea className="max-h-[240px]">
                  <div className="py-1">
                  {filteredProfiles
                    .map(p => (
                      <button
                        key={p.user_id}
                        className="w-full text-left px-2 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-700/60"
                        onClick={() => {
                          const selectedId = p.user_id
                          setEditDraft(prev => prev ? { ...prev, decomposition_item_responsible: selectedId } as DecompositionItemRow : prev)
                          saveEditWithPatch({ decomposition_item_responsible: selectedId })
                          setResponsibleFilter("")
                          setOpenRespId(null)
                        }}
                      >
                        {`${p.first_name || ''} ${p.last_name || ''}`.trim() || p.email}
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              </PopoverContent>
            </Popover>
          ) : (
            <span className="inline-block max-w-full truncate text-[11px]">{getResponsibleName(item) || "—"}</span>
          )
        ) : (
          <span className="inline-block max-w-full truncate text-[11px]">{getResponsibleName(item) || "—"}</span>
        )}
      </td>

      {/* Статус */}
      <td className={`px-2 ${editingId === item.decomposition_item_id ? 'py-1' : 'py-2'} align-middle border ${canEditStatus ? '' : 'opacity-70'}`} onClick={() => { if (canEditStatus) startEdit(item) }}>
        {editingId === item.decomposition_item_id ? (
          canEditStatus ? (
            <Popover open={isStatusOpen(item.decomposition_item_id)} onOpenChange={(o) => setOpenStatusId(o ? item.decomposition_item_id : null)}>
              <PopoverTrigger asChild>
                <button className="inline-flex flex-wrap items-center text-left whitespace-normal break-words rounded-full px-2 py-0.5 text-xs font-medium bg-slate-200 text-slate-700 dark:bg-slate-700/60 dark:text-slate-100 hover:bg-slate-300 dark:hover:bg-slate-700 w-auto max-w-full" onClick={(e) => { e.stopPropagation(); setOpenStatusId(item.decomposition_item_id) }}>
                  {statuses.find(s => s.id === (editDraft?.decomposition_item_status_id ?? item.decomposition_item_status_id))?.name || <span className="text-slate-400">Выбрать</span>}
                </button>
              </PopoverTrigger>
              <PopoverContent align="start" sideOffset={6} className="p-0 w-[220px] text-[12px] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm">
                <div className="py-1">
                  {statuses.map(s => (
                    <button
                      key={s.id}
                      className="w-full text-left px-2 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-700/60"
                      onClick={() => {
                        const v = s.id
                        setEditDraft(prev => prev ? { ...prev, decomposition_item_status_id: v } as DecompositionItemRow : prev)
                        updateItemFields(item.decomposition_item_id, { decomposition_item_status_id: v })
                        setOpenStatusId(null)
                      }}
                    >
                      {s.name}
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          ) : (
            <span className="inline-block max-w-full whitespace-normal break-words rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ backgroundColor: item.status?.color || '#6c757d', color: 'white' }}>
              {item.status?.name || "—"}
            </span>
          )
        ) : (
          <span className="inline-block max-w-full whitespace-normal break-words rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ backgroundColor: item.status?.color || '#6c757d', color: 'white' }}>
            {item.status?.name || "—"}
          </span>
        )}
      </td>

      {/* % */}
      <td className={`px-2 ${editingId === item.decomposition_item_id ? 'py-1' : 'py-2'} align-middle text-center tabular-nums border ${canEditProgress ? '' : 'opacity-70'}`} onClick={() => { if (canEditProgress) startEdit(item) }}>
        {editingId === item.decomposition_item_id ? (
          canEditProgress ? (
            <input
              type="text"
              value={editDraft?.decomposition_item_progress ?? 0}
              onChange={e => {
                const v = e.target.value.replace(/[^0-9]/g, '')
                const num = Math.max(0, Math.min(100, Number(v || 0)))
                setEditDraft(prev => prev ? { ...prev, decomposition_item_progress: num } as DecompositionItemRow : prev)
              }}
              onKeyDown={handleEditKey}
              className="w-12 px-1 py-1 text-center tabular-nums bg-transparent border-0 outline-none focus:outline-none focus:ring-0 focus:border-0 dark:bg-transparent dark:text-white text-[12px]"
            />
          ) : (
            <div className="flex items-center justify-center gap-2">
              <div className="w-20 h-2 rounded-full bg-slate-600/30 overflow-hidden">
                <div className="h-2 bg-emerald-500" style={{ width: `${Math.max(0, Math.min(100, Number(item.decomposition_item_progress || 0)))}%` }} />
              </div>
              <span className="text-[11px] w-8 text-right">{Math.max(0, Math.min(100, Number(item.decomposition_item_progress || 0)))}%</span>
            </div>
          )
        ) : (
          <div className="flex items-center justify-center gap-2">
            <div className="w-20 h-2 rounded-full bg-slate-600/30 overflow-hidden">
              <div className="h-2 bg-emerald-500" style={{ width: `${Math.max(0, Math.min(100, Number(item.decomposition_item_progress || 0)))}%` }} />
            </div>
            <span className="text-[11px] w-8 text-right">{Math.max(0, Math.min(100, Number(item.decomposition_item_progress || 0)))}%</span>
          </div>
        )}
      </td>

      {/* План */}
      <td className={`px-2 ${editingId === item.decomposition_item_id ? 'py-1' : 'py-2'} align-middle text-center tabular-nums border ${canEditPlannedHours ? '' : 'opacity-70'}`} onClick={() => { if (canEditPlannedHours) startEdit(item) }}>
        {editingId === item.decomposition_item_id ? (
          canEditPlannedHours ? (
            <input
              type="text"
              value={editDraft?.decomposition_item_planned_hours ?? 0}
              onChange={e => {
                const raw = e.target.value.replace(',', '.')
                let cleaned = raw.replace(/[^0-9.]/g, '')
                const parts = cleaned.split('.')
                if (parts.length > 2) cleaned = parts[0] + '.' + parts.slice(1).join('')
                const num = Math.max(0, Number(cleaned || 0))
                setEditDraft(prev => prev ? { ...prev, decomposition_item_planned_hours: num } as DecompositionItemRow : prev)
              }}
              onKeyDown={handleEditKey}
              className="w-14 px-1 py-1 text-center tabular-nums bg-transparent border-0 outline-none focus:outline-none focus:ring-0 focus:border-0 dark:bg-transparent dark:text-white text-[12px]"
            />
          ) : (
            Number(item.decomposition_item_planned_hours).toFixed(2)
          )
        ) : (
          Number(item.decomposition_item_planned_hours).toFixed(2)
        )}
      </td>

      {/* Факт */}
      <td className={`px-2 ${editingId === item.decomposition_item_id ? 'py-1' : 'py-2'} align-middle text-center tabular-nums border`}>
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
      </td>

      {/* Срок */}
      <td className={`px-2 ${editingId === item.decomposition_item_id ? 'py-1' : 'py-2'} align-middle border ${canEditDueDate ? '' : 'opacity-70'}`} onClick={() => { if (canEditDueDate) startEdit(item) }}>
        {editingId === item.decomposition_item_id ? (
          canEditDueDate ? (
            <div className="flex items-center gap-2 text-[12px]" onClick={e => e.stopPropagation()}>
              <ProjectDatePicker
                value={(() => {
                  const v = editDraft?.decomposition_item_planned_due_date
                  return v ? new Date(v) : null
                })()}
                onChange={(d) => {
                  const iso = formatISODate(d)
                  setEditDraft(prev => prev ? { ...prev, decomposition_item_planned_due_date: iso } as DecompositionItemRow : prev)
                  saveEditWithPatch({ decomposition_item_planned_due_date: iso })
                }}
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
            <span className="truncate">{item.decomposition_item_planned_due_date ? new Date(item.decomposition_item_planned_due_date).toLocaleDateString("ru-RU") : "—"}</span>
          )
        ) : (
          <span className="truncate">{item.decomposition_item_planned_due_date ? new Date(item.decomposition_item_planned_due_date).toLocaleDateString("ru-RU") : "—"}</span>
        )}
      </td>

      {/* Действия */}
      <td className={`px-1 ${editingId === item.decomposition_item_id ? 'py-1' : 'py-2'} align-middle text-center border`}>
        {canDeleteItem ? (
                      <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 inline-flex" title="Действия">
                <MoreHorizontal className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="min-w-[12rem]">
                          <div className="px-2 py-1 text-[11px] text-slate-500">Переместить в этап</div>
                          <DropdownMenuItem onClick={() => moveItemToStage(item.decomposition_item_id, null)}>
                            Без этапа
                          </DropdownMenuItem>
                          {stages.map(st => (
                            <DropdownMenuItem key={`mv-${item.decomposition_item_id}-${st.id}`} onClick={() => moveItemToStage(item.decomposition_item_id, st.id)}>
                              {st.name}
                            </DropdownMenuItem>
                          ))}
                          <div className="my-1 h-px bg-slate-200 dark:bg-slate-700" />
                          {canDeleteItem && (
                            <DropdownMenuItem onClick={() => { setPendingDeleteId(item.decomposition_item_id); setShowDeleteConfirm(true) }} className="text-red-600 focus:text-red-700 dark:bg-[rgb(30_41_59)] dark:text-slate-100 dark:hover:bg-slate-700 dark:focus:bg-slate-700">
                              {deletingId === item.decomposition_item_id ? (<Loader2 className="h-4 w-4 animate-spin" />) : (<Trash2 className="h-4 w-4" />)}
                              Удалить
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <button className="p-1 rounded inline-flex text-slate-400" onClick={(e) => { e.preventDefault(); }} disabled aria-disabled type="button">
            <MoreHorizontal className="h-4 w-4" />
          </button>
        )}
      </td>
    </tr>
  )
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
          {/* Верхняя панель с кнопкой Шаблон */}
          <div className="px-2 py-2 border-b border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/40 flex items-center gap-2">
            <button onClick={() => setIsTemplatesOpen(true)} className={`inline-flex items-center ${compact ? 'gap-1.5 h-6 text-[11px]' : 'gap-2 h-7 text-[12px]'} px-2 rounded bg-slate-200/70 hover:bg-slate-300 dark:bg-slate-700/70 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-100`} title="Открыть шаблоны">
              <LayoutTemplate className={compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
              Шаблон
            </button>
            <button onClick={() => setCreateStageOpen(true)} className={`inline-flex items-center ${compact ? 'gap-1.5 h-6 text-[11px]' : 'gap-2 h-7 text-[12px]'} px-2 rounded bg-blue-600 hover:bg-blue-700 text-white`}>
              Добавить этап
            </button>
            {/* Выбор этапа для новой строки */}
            {stages.length > 0 && (
              <Popover open={openStagePicker} onOpenChange={setOpenStagePicker}>
                <PopoverTrigger asChild>
                  <button className={`inline-flex items-center ${compact ? 'gap-1.5 h-6 text-[11px]' : 'gap-2 h-7 text-[12px]'} px-2 rounded bg-slate-200/70 hover:bg-slate-300 dark:bg-slate-700/70 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-100`}>
                    {(() => {
                      const label = newStageId ? (stages.find(s => s.id === newStageId)?.name || 'Этап') : 'Этап: не выбран'
                      return label
                    })()}
                  </button>
                </PopoverTrigger>
                <PopoverContent align="start" sideOffset={6} className="p-0 w-[260px] text-[12px] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm">
                  <ScrollArea className="max-h-[260px]">
                    <div className="py-1">
                      <button className="w-full text-left px-2 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-700/60" onClick={() => { setNewStageId(null); setOpenStagePicker(false) }}>Без этапа</button>
                      {stages.map(s => (
                        <button key={s.id} className="w-full text-left px-2 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-700/60" onClick={() => { setNewStageId(s.id); setOpenStagePicker(false) }}>{s.name}</button>
                      ))}
                    </div>
                  </ScrollArea>
                </PopoverContent>
              </Popover>
            )}
          </div>
          {/* Переключатель группировки по этапам (опционально, по умолчанию выкл) */}
          {!compact && stages.length > 0 && (
            <div className="px-2 py-2 border-b border-slate-200 dark:border-slate-700 flex items-center gap-3">
              <label className="text-xs text-slate-600 dark:text-slate-400 inline-flex items-center gap-2">
                <input type="checkbox" checked={groupByStage} onChange={(e) => setGroupByStage(e.target.checked)} />
                Группировать по этапам
              </label>
              {groupByStage && <span className="text-xs text-slate-500">Этапы: {stages.length}</span>}
            </div>
          )}

          {!groupByStage && (
          <table className="w-full table-fixed border-collapse">
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
            <thead>
              <tr className={(compact ? "text-[11px] " : "text-[12px] xl:text-[13px] ") + "sticky top-0 z-[1] bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200"}>
                <th className="px-2 py-2 text-left align-middle border border-slate-200 dark:border-slate-700">Отчет</th>
                <th className="px-2 py-2 text-left align-middle border border-slate-200 dark:border-slate-700">Описание работ</th>
                <th className="px-2 py-2 text-left align-middle border border-slate-200 dark:border-slate-700">Категория</th>
                <th className="px-2 py-2 text-left align-middle border border-slate-200 dark:border-slate-700">Ответственный</th>
                <th className="px-2 py-2 text-left align-middle border border-slate-200 dark:border-slate-700">Статус</th>
                <th className="px-2 py-2 text-center align-middle border border-slate-200 dark:border-slate-700">%</th>
                <th className="px-2 py-2 text-center align-middle border border-slate-200 dark:border-slate-700">План, ч</th>
                <th className="px-2 py-2 text-center align-middle border border-slate-200 dark:border-slate-700">Факт, ч</th>
                <th className="px-2 py-2 text-left align-middle border border-slate-200 dark:border-slate-700">Срок</th>
                <th className="px-2 py-2 text-center align-middle border border-slate-200 dark:border-slate-700"><span className="font-normal">…</span></th>
              </tr>
            </thead>
            <tbody>
              {items.map(item => (
                <tr
                  key={item.decomposition_item_id}
                  className={`hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors ${
                    editingId === item.decomposition_item_id
                      ? '[&>td]:border [&>td]:border-slate-200 [&>td]:dark:border-slate-700'
                      : '[&>td]:border-0'
                  }`}
                >
                  {/* Лог */}
                  <td className="px-2 py-2 align-middle border">
                    <div className="relative flex items-center justify-center">
                      <button className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700" title="Добавить отчет" onClick={() => { setSelectedForLog(item.decomposition_item_id); setIsLogModalOpen(true); }}>
                        <Clock className={compact ? 'h-3.5 w-3.5 text-emerald-600' : 'h-4 w-4 text-emerald-600'} />
                      </button>
                      {logsCountByItemId[item.decomposition_item_id] ? (
                        <span className="absolute -top-1 -right-1 inline-flex items-center justify-center min-w-[14px] h-[14px] rounded-full bg-emerald-600 text-white text-[10px] leading-none px-[4px]">
                          {Math.min(99, logsCountByItemId[item.decomposition_item_id])}
                        </span>
                      ) : null}
                    </div>
                  </td>

                  {/* Описание */}
                  <td className="px-2 py-2 align-middle border" onClick={() => startEdit(item)}>
                    {editingId === item.decomposition_item_id ? (
                      <textarea
                        autoFocus
                        ref={editDescRef}
                        value={editDraft?.decomposition_item_description || ""}
                        onChange={e => handleDescriptionChange(e.target.value)}
                        onInput={(e) => autoResizeTextarea(e.currentTarget)}
                        onKeyDown={handleEditKey}
                        rows={1}
                        style={{ overflow: 'hidden' }}
                        className="w-full px-1 py-[6px] bg-transparent border-0 focus:ring-0 focus:border-0 outline-none focus:outline-none dark:bg-transparent dark:text-white resize-none overflow-hidden leading-[18px]"
                      />
                    ) : (
                      <div
                        title={item.decomposition_item_description}
                        className="whitespace-pre-wrap line-clamp-3 break-words overflow-hidden"
                      >
                        {item.decomposition_item_description}
                      </div>
                    )}
                  </td>

                  {/* Категория */}
                  <td className={`px-2 ${editingId === item.decomposition_item_id ? 'py-1' : 'py-2'} align-middle border`} onClick={() => startEdit(item)}>
                    {editingId === item.decomposition_item_id ? (
                      <Popover open={isCatOpen(item.decomposition_item_id)} onOpenChange={(o) => setOpenCatId(o ? item.decomposition_item_id : null)}>
                        <PopoverTrigger asChild>
                          <button className="inline-flex flex-wrap items-center text-left whitespace-normal break-words rounded-full px-2 py-0.5 text-xs font-medium bg-slate-200 text-slate-700 dark:bg-slate-700/60 dark:text-slate-100 hover:bg-slate-300 dark:hover:bg-slate-700 w-auto max-w-full" onClick={(e) => { e.stopPropagation(); setOpenCatId(item.decomposition_item_id) }}>
                            {categoryById.get(editDraft?.decomposition_item_work_category_id || item.decomposition_item_work_category_id) || <span className="text-slate-400">Выбрать</span>}
                          </button>
                        </PopoverTrigger>
                        <PopoverContent align="start" sideOffset={6} className="p-0 w-[220px] text-[12px] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm">
                          <ScrollArea className="max-h-[240px]">
                            <div className="py-1">
                              {categories.map(c => (
                                <button
                                  key={c.work_category_id}
                                  className="w-full text-left px-2 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-700/60"
                                  onClick={() => {
                                    const v = c.work_category_id
                                    setEditDraft(prev => prev ? { ...prev, decomposition_item_work_category_id: v } as DecompositionItemRow : prev)
                                    updateItemFields(item.decomposition_item_id, { decomposition_item_work_category_id: v })
                                    setOpenCatId(null)
                                  }}
                                >
                                  {c.work_category_name}
                                </button>
                              ))}
                            </div>
                          </ScrollArea>
                        </PopoverContent>
                      </Popover>
                    ) : (
                      <span className="inline-block max-w-full whitespace-normal break-words rounded-full px-2 py-0.5 text-xs font-medium bg-slate-200 text-slate-700 dark:bg-slate-700/60 dark:text-slate-100">
                        {categoryById.get(item.decomposition_item_work_category_id) || "—"}
                      </span>
                    )}
                  </td>

                  {/* Ответственный */}
                  <td className={`px-2 ${editingId === item.decomposition_item_id ? 'py-1' : 'py-2'} align-middle border ${canEditResponsible ? '' : 'opacity-70'}`} onClick={() => { if (canEditResponsible) startEdit(item) }}>
                    {editingId === item.decomposition_item_id ? (
                      canEditResponsible ? (
                        <Popover open={isRespOpen(item.decomposition_item_id)} onOpenChange={(o) => setOpenRespId(o ? item.decomposition_item_id : null)}>
                          <PopoverTrigger asChild>
                            <button className="w-full h-7 px-2 rounded bg-transparent text-left text-[12px] hover:bg-slate-100 dark:hover:bg-slate-800" onClick={(e) => { e.stopPropagation(); setOpenRespId(item.decomposition_item_id) }}>
                              {getResponsibleName(editDraft || item as any) || <span className="text-slate-400">Выбрать</span>}
                            </button>
                          </PopoverTrigger>
                          <PopoverContent align="start" sideOffset={6} className="p-0 w-[260px] text-[12px] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm">
                            <div className="p-2">
                              <input
                                value={responsibleFilter}
                                onChange={(e) => setResponsibleFilter(e.target.value)}
                                placeholder="Поиск"
                                className="w-full h-7 px-2 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 outline-none text-[12px]"
                              />
                            </div>
                            <ScrollArea className="max-h-[240px]">
                              <div className="py-1">
                              {filteredProfiles
                                .map(p => (
                                  <button
                                    key={p.user_id}
                                    className="w-full text-left px-2 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-700/60"
                                    onClick={() => {
                                      const selectedId = p.user_id
                                      setEditDraft(prev => prev ? { ...prev, decomposition_item_responsible: selectedId } as DecompositionItemRow : prev)
                                      saveEditWithPatch({ decomposition_item_responsible: selectedId })
                                      setResponsibleFilter("")
                                      setOpenRespId(null)
                                    }}
                                  >
                                    {`${p.first_name || ''} ${p.last_name || ''}`.trim() || p.email}
                                  </button>
                                ))}
                              </div>
                            </ScrollArea>
                          </PopoverContent>
                        </Popover>
                      ) : (
                        <span className="inline-block max-w-full truncate text-[11px]">{getResponsibleName(item) || "—"}</span>
                      )
                    ) : (
                      <span className="inline-block max-w-full truncate text-[11px]">{getResponsibleName(item) || "—"}</span>
                    )}
                  </td>

                  {/* Статус */}
                  <td className={`px-2 ${editingId === item.decomposition_item_id ? 'py-1' : 'py-2'} align-middle border ${canEditStatus ? '' : 'opacity-70'}`} onClick={() => { if (canEditStatus) startEdit(item) }}>
                    {editingId === item.decomposition_item_id ? (
                      canEditStatus ? (
                        <Popover open={isStatusOpen(item.decomposition_item_id)} onOpenChange={(o) => setOpenStatusId(o ? item.decomposition_item_id : null)}>
                          <PopoverTrigger asChild>
                            <button className="inline-flex flex-wrap items-center text-left whitespace-normal break-words rounded-full px-2 py-0.5 text-xs font-medium bg-slate-200 text-slate-700 dark:bg-slate-700/60 dark:text-slate-100 hover:bg-slate-300 dark:hover:bg-slate-700 w-auto max-w-full" onClick={(e) => { e.stopPropagation(); setOpenStatusId(item.decomposition_item_id) }}>
                              {statuses.find(s => s.id === (editDraft?.decomposition_item_status_id ?? item.decomposition_item_status_id))?.name || <span className="text-slate-400">Выбрать</span>}
                            </button>
                          </PopoverTrigger>
                          <PopoverContent align="start" sideOffset={6} className="p-0 w-[220px] text-[12px] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm">
                            <div className="py-1">
                              {statuses.map(s => (
                                <button
                                  key={s.id}
                                  className="w-full text-left px-2 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-700/60"
                                  onClick={() => {
                                    const v = s.id
                                    setEditDraft(prev => prev ? { ...prev, decomposition_item_status_id: v } as DecompositionItemRow : prev)
                                    updateItemFields(item.decomposition_item_id, { decomposition_item_status_id: v })
                                    setOpenStatusId(null)
                                  }}
                                >
                                  {s.name}
                                </button>
                              ))}
                            </div>
                          </PopoverContent>
                        </Popover>
                      ) : (
                        <span className="inline-block max-w-full whitespace-normal break-words rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ backgroundColor: item.status?.color || '#6c757d', color: 'white' }}>
                          {item.status?.name || "—"}
                        </span>
                      )
                    ) : (
                      <span className="inline-block max-w-full whitespace-normal break-words rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ backgroundColor: item.status?.color || '#6c757d', color: 'white' }}>
                        {item.status?.name || "—"}
                      </span>
                    )}
                  </td>

                  {/* % */}
                  <td className={`px-2 ${editingId === item.decomposition_item_id ? 'py-1' : 'py-2'} align-middle text-center tabular-nums border ${canEditProgress ? '' : 'opacity-70'}`} onClick={() => { if (canEditProgress) startEdit(item) }}>
                    {editingId === item.decomposition_item_id ? (
                      canEditProgress ? (
                        <input
                          type="text"
                          value={editDraft?.decomposition_item_progress ?? 0}
                          onChange={e => {
                            const v = e.target.value.replace(/[^0-9]/g, '')
                            const num = Math.max(0, Math.min(100, Number(v || 0)))
                            setEditDraft(prev => prev ? { ...prev, decomposition_item_progress: num } as DecompositionItemRow : prev)
                          }}
                          onKeyDown={handleEditKey}
                          className="w-12 px-1 py-1 text-center tabular-nums bg-transparent border-0 outline-none focus:outline-none focus:ring-0 focus:border-0 dark:bg-transparent dark:text-white text-[12px]"
                        />
                      ) : (
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-20 h-2 rounded-full bg-slate-600/30 overflow-hidden">
                            <div className="h-2 bg-emerald-500" style={{ width: `${Math.max(0, Math.min(100, Number(item.decomposition_item_progress || 0)))}%` }} />
                          </div>
                          <span className="text-[11px] w-8 text-right">{Math.max(0, Math.min(100, Number(item.decomposition_item_progress || 0)))}%</span>
                        </div>
                      )
                    ) : (
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-20 h-2 rounded-full bg-slate-600/30 overflow-hidden">
                          <div className="h-2 bg-emerald-500" style={{ width: `${Math.max(0, Math.min(100, Number(item.decomposition_item_progress || 0)))}%` }} />
                        </div>
                        <span className="text-[11px] w-8 text-right">{Math.max(0, Math.min(100, Number(item.decomposition_item_progress || 0)))}%</span>
                      </div>
                    )}
                  </td>

                  {/* План */}
                  <td className={`px-2 ${editingId === item.decomposition_item_id ? 'py-1' : 'py-2'} align-middle text-center tabular-nums border ${canEditPlannedHours ? '' : 'opacity-70'}`} onClick={() => { if (canEditPlannedHours) startEdit(item) }}>
                    {editingId === item.decomposition_item_id ? (
                      canEditPlannedHours ? (
                        <input
                          type="text"
                          value={editDraft?.decomposition_item_planned_hours ?? 0}
                          onChange={e => {
                            const raw = e.target.value.replace(',', '.')
                            let cleaned = raw.replace(/[^0-9.]/g, '')
                            const parts = cleaned.split('.')
                            if (parts.length > 2) cleaned = parts[0] + '.' + parts.slice(1).join('')
                            const num = Math.max(0, Number(cleaned || 0))
                            setEditDraft(prev => prev ? { ...prev, decomposition_item_planned_hours: num } as DecompositionItemRow : prev)
                          }}
                          onKeyDown={handleEditKey}
                          className="w-14 px-1 py-1 text-center tabular-nums bg-transparent border-0 outline-none focus:outline-none focus:ring-0 focus:border-0 dark:bg-transparent dark:text-white text-[12px]"
                        />
                      ) : (
                        Number(item.decomposition_item_planned_hours).toFixed(2)
                      )
                    ) : (
                      Number(item.decomposition_item_planned_hours).toFixed(2)
                    )}
                  </td>

                  {/* Факт */}
                  <td className={`px-2 ${editingId === item.decomposition_item_id ? 'py-1' : 'py-2'} align-middle text-center tabular-nums border`}>
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
                  </td>

                  {/* Срок */}
                  <td className={`px-2 ${editingId === item.decomposition_item_id ? 'py-1' : 'py-2'} align-middle border ${canEditDueDate ? '' : 'opacity-70'}`} onClick={() => { if (canEditDueDate) startEdit(item) }}>
                    {editingId === item.decomposition_item_id ? (
                      canEditDueDate ? (
                        <div className="flex items-center gap-2 text-[12px]" onClick={e => e.stopPropagation()}>
                          <ProjectDatePicker
                            value={(() => {
                              const v = editDraft?.decomposition_item_planned_due_date
                              return v ? new Date(v) : null
                            })()}
                            onChange={(d) => {
                              const iso = formatISODate(d)
                              setEditDraft(prev => prev ? { ...prev, decomposition_item_planned_due_date: iso } as DecompositionItemRow : prev)
                              saveEditWithPatch({ decomposition_item_planned_due_date: iso })
                            }}
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
                        <span className="truncate">{item.decomposition_item_planned_due_date ? new Date(item.decomposition_item_planned_due_date).toLocaleDateString("ru-RU") : "—"}</span>
                      )
                    ) : (
                      <span className="truncate">{item.decomposition_item_planned_due_date ? new Date(item.decomposition_item_planned_due_date).toLocaleDateString("ru-RU") : "—"}</span>
                    )}
                  </td>

                  {/* Действия */}
      <td className={`px-1 ${editingId === item.decomposition_item_id ? 'py-1' : 'py-2'} align-middle text-center border`}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 inline-flex" title="Действия">
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-[12rem]">
            <div className="px-2 py-1 text-[11px] text-slate-500">Переместить в этап</div>
            <DropdownMenuItem onClick={() => moveItemToStage(item.decomposition_item_id, null)}>
              Без этапа
            </DropdownMenuItem>
            {stages.map(st => (
              <DropdownMenuItem key={`mv-${item.decomposition_item_id}-${st.id}`} onClick={() => moveItemToStage(item.decomposition_item_id, st.id)}>
                {st.name}
              </DropdownMenuItem>
            ))}
            <div className="my-1 h-px bg-slate-200 dark:bg-slate-700" />
            {canDeleteItem && (
              <DropdownMenuItem onClick={() => { setPendingDeleteId(item.decomposition_item_id); setShowDeleteConfirm(true) }} className="text-red-600 focus:text-red-700 dark:bg-[rgb(30_41_59)] dark:text-slate-100 dark:hover:bg-slate-700 dark:focus:bg-slate-700">
                {deletingId === item.decomposition_item_id ? (<Loader2 className="h-4 w-4 animate-spin" />) : (<Trash2 className="h-4 w-4" />)}
                Удалить
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </td>
                </tr>
              ))}

              {/* Новая строка */}
              <tr className="bg-slate-50 dark:bg-slate-800/60 [&>td]:border-slate-200 [&>td]:dark:border-slate-700">
                <td className="px-2 py-1 align-middle text-center border">
                  <button
                    type="button"
                    disabled={!canAdd}
                    onClick={handleAdd}
                    title={canAdd ? "Добавить строку" : "Введите описание и план"}
                    className="h-7 w-7 inline-flex items-center justify-center rounded-md text-slate-400 hover:text-slate-600 disabled:opacity-40 focus:outline-none focus:ring-0"
                  >
                    <PlusCircle className="h-4 w-4" />
                  </button>
                </td>
                <td className="px-2 py-1 align-middle border">
                  <textarea
                    value={newDescription}
                    onChange={e => setNewDescription(e.target.value)}
                    onInput={(e) => autoResizeTextarea(e.currentTarget)}
                    rows={1}
                    placeholder="Новая строка — введите описание"
                    className="w-full bg-transparent px-1 py-[6px] border-0 focus:ring-0 focus:border-0 focus:outline-none outline-none rounded-none dark:text-white resize-none text-[12px]"
                    onKeyDown={handleEditKey}
                    ref={newDescRef}
                  />
                </td>
                <td className="px-2 py-1 align-middle border">
                  <Popover open={openCatId === 'new'} onOpenChange={(o) => setOpenCatId(o ? 'new' : null)}>
                    <PopoverTrigger asChild>
                      <button className="w-full h-7 px-2 rounded bg-transparent text-left text-[12px] hover:bg-slate-100 dark:hover:bg-slate-800 focus:outline-none focus:ring-0" onClick={() => setOpenCatId('new')}>
                        {categories.find(c => c.work_category_id === newCategoryId)?.work_category_name || <span className="text-slate-400">Выбрать</span>}
                      </button>
                    </PopoverTrigger>
                    <PopoverContent align="start" sideOffset={6} className="p-0 w-[220px] text-[12px] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm">
                      <ScrollArea className="max-h-[240px]">
                        <div className="py-1">
                          {categories.map(c => (
                            <button key={c.work_category_id} className="w-full text-left px-2 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-700/60" onClick={() => { setNewCategoryId(c.work_category_id); setOpenCatId(null) }}>{c.work_category_name}</button>
                          ))}
                        </div>
                      </ScrollArea>
                    </PopoverContent>
                  </Popover>
                </td>
                <td className={`px-2 py-1 align-middle border ${canEditResponsible ? '' : 'opacity-70'}`}>
                  <Popover open={openRespId === 'new'} onOpenChange={(o) => setOpenRespId(o ? 'new' : null)}>
                    <PopoverTrigger asChild>
                      <button className="w-full h-7 px-2 rounded bg-transparent text-left text-[12px] hover:bg-slate-100 dark:hover:bg-slate-800 focus:outline-none focus:ring-0" onClick={() => { if (canEditResponsible) setOpenRespId('new') }} disabled={!canEditResponsible}>
                        {(() => {
                          if (!newResponsibleId) return <span className="text-slate-400">Выбрать</span>
                          const p = profiles.find(p => p.user_id === newResponsibleId)
                          return p ? ((`${p.first_name || ''} ${p.last_name || ''}`.trim() || p.email)) : <span className="text-slate-400">Выбрать</span>
                        })()}
                      </button>
                    </PopoverTrigger>
                    <PopoverContent align="start" sideOffset={6} className="p-0 w-[260px] text-[12px] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm">
                      <div className="p-2">
                        <input
                          value={responsibleFilter}
                          onChange={(e) => setResponsibleFilter(e.target.value)}
                          placeholder="Поиск"
                          className="w-full h-7 px-2 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 outline-none text-[12px]"
                          disabled={!canEditResponsible}
                        />
                      </div>
                      <ScrollArea className="max-h-[240px]">
                        <div className="py-1">
                          {filteredProfiles
                            .map(p => (
                              <button key={p.user_id} className="w-full text-left px-2 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-700/60 disabled:opacity-60" onClick={() => { if (!canEditResponsible) return; setNewResponsibleId(p.user_id); setOpenRespId(null) }} disabled={!canEditResponsible}>{`${p.first_name || ''} ${p.last_name || ''}`.trim() || p.email}</button>
                          ))}
                        </div>
                      </ScrollArea>
                    </PopoverContent>
                  </Popover>
                </td>
                <td className={`px-2 py-1 align-middle border ${canEditStatus ? '' : 'opacity-70'}`}>
                  <Popover open={openStatusId === 'new'} onOpenChange={(o) => setOpenStatusId(o ? 'new' : null)}>
                    <PopoverTrigger asChild>
                      <button className="w-full h-7 px-2 rounded bg-transparent text-left text-[12px] hover:bg-slate-100 dark:hover:bg-slate-800 focus:outline-none focus:ring-0" onClick={() => { if (canEditStatus) setOpenStatusId('new') }} disabled={!canEditStatus}>
                        {statuses.find(s => s.id === newStatusId)?.name || <span className="text-slate-400">Выбрать</span>}
                      </button>
                    </PopoverTrigger>
                    <PopoverContent align="start" sideOffset={6} className="p-0 w-[220px] text-[12px] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm">
                      <div className="py-1">
                        {statuses.map(s => (
                          <button key={s.id} className="w-full text-left px-2 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-700/60 disabled:opacity-60" onClick={() => { if (canEditStatus) { setNewStatusId(s.id); setOpenStatusId(null) } }} disabled={!canEditStatus}>{s.name}</button>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                </td>
                <td className="px-2 py-1 align-middle text-center border">
                  <input
                    type="text"
                    value={newProgress}
                    onChange={e => {
                      const v = e.target.value.replace(/[^0-9]/g, '')
                      const num = Math.max(0, Math.min(100, Number(v || 0)))
                      setNewProgress(String(num))
                    }}
                    placeholder="0"
                    className="w-12 text-center tabular-nums bg-transparent px-1 py-1 border-0 focus:ring-0 focus:border-0 focus:outline-none outline-none dark:text-white text-[12px]"
                    onKeyDown={handleEditKey}
                    disabled={!canEditProgress}
                  />
                </td>
                <td className="px-2 py-1 align-middle text-center border">
                  <input
                    type="text"
                    value={newPlannedHours}
                    onChange={e => {
                      const raw = e.target.value.replace(',', '.')
                      let cleaned = raw.replace(/[^0-9.]/g, '')
                      const parts = cleaned.split('.')
                      if (parts.length > 2) cleaned = parts[0] + '.' + parts.slice(1).join('')
                      setNewPlannedHours(cleaned)
                    }}
                    placeholder="0"
                    className="w-[72px] text-center tabular-nums bg-transparent px-1 py-1 border-0 focus:ring-0 focus:border-0 focus:outline-none outline-none dark:text-white text-[12px]"
                    onKeyDown={handleEditKey}
                    disabled={!canEditPlannedHours}
                  />
                </td>
                <td className="px-2 py-1 align-middle text-center text-slate-400 border">—</td>
                <td className={`px-2 py-1 align-middle border ${canEditDueDate ? '' : 'opacity-70'}`}>
                  {canEditDueDate ? (
                    <ProjectDatePicker
                      value={newPlannedDueDate ? new Date(newPlannedDueDate) : null}
                      onChange={(d) => setNewPlannedDueDate(formatISODate(d))}
                      placeholder="Выбрать"
                      calendarWidth="240px"
                      inputWidth="140px"
                      placement="auto-top"
                      offsetY={6}
                      inputClassName="bg-transparent border-0 outline-none focus:outline-none focus:ring-0 focus:border-0 text-[12px] px-2 py-1"
                      variant="minimal"
                    />
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </td>
                <td className="px-1 py-1 align-middle text-center border">
                  <span className="text-slate-400">—</span>
                </td>
              </tr>
            </tbody>
          </table>
          )}

          {groupByStage && (
          <table className="w-full table-fixed border-collapse">
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
            <thead>
              <tr className={(compact ? "text-[11px] " : "text-[12px] xl:text-[13px] ") + "sticky top-0 z-[1] bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200"}>
                <th className="px-2 py-2 text-left align-middle border border-slate-200 dark:border-slate-700">Отчет</th>
                <th className="px-2 py-2 text-left align-middle border border-slate-200 dark:border-slate-700">Описание работ</th>
                <th className="px-2 py-2 text-left align-middle border border-slate-200 dark:border-slate-700">Категория</th>
                <th className="px-2 py-2 text-left align-middle border border-slate-200 dark:border-slate-700">Ответственный</th>
                <th className="px-2 py-2 text-left align-middle border border-slate-200 dark:border-slate-700">Статус</th>
                <th className="px-2 py-2 text-center align-middle border border-slate-200 dark:border-slate-700">%</th>
                <th className="px-2 py-2 text-center align-middle border border-slate-200 dark:border-slate-700">План, ч</th>
                <th className="px-2 py-2 text-center align-middle border border-slate-200 dark:border-slate-700">Факт, ч</th>
                <th className="px-2 py-2 text-left align-middle border border-slate-200 dark:border-slate-700">Срок</th>
                <th className="px-2 py-2 text-center align-middle border border-slate-200 dark:border-slate-700"><span className="font-normal">…</span></th>
              </tr>
            </thead>
            <tbody>
              {/* Этапы */}
              {stages.map(st => {
                const bucket = itemsByStage.get(st.id) || []
                const plannedSum = bucket.reduce((s,i)=> s + Number(i.decomposition_item_planned_hours || 0), 0)
                const actualSum = bucket.reduce((s,i)=> s + Number(actualByItemId[i.decomposition_item_id] || 0), 0)
                const logsSum = bucket.reduce((s,i)=> s + Number(logsCountByItemId[i.decomposition_item_id] || 0), 0)
                return (
                  <React.Fragment key={`stage-${st.id}`}>
                    <tr className="group border-t bg-slate-50 dark:bg-slate-800/40">
                      <td className="px-2 py-2" colSpan={10}>
                        <div className="flex items-center justify-between">
                          <div className="min-w-0">
                            {editingStageId === st.id ? (
                              <div className="flex flex-wrap items-center gap-2">
                                <input
                                  className="h-7 px-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-[12px] min-w-[180px]"
                                  value={stageEditDraft?.name || ''}
                                  onChange={e => setStageEditDraft(prev => prev ? { ...prev, name: e.target.value } : prev)}
                                />
                                <ProjectDatePicker
                                  value={stageEditDraft?.start ? new Date(stageEditDraft.start) : null}
                                  onChange={d => setStageEditDraft(prev => prev ? { ...prev, start: formatISODate(d) } : prev)}
                                  placeholder="Начало"
                                  calendarWidth="240px"
                                  inputWidth="120px"
                                  placement="auto"
                                  offsetY={6}
                                  inputClassName="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2 h-7 text-[12px]"
                                  variant="minimal"
                                />
                                <ProjectDatePicker
                                  value={stageEditDraft?.finish ? new Date(stageEditDraft.finish) : null}
                                  onChange={d => setStageEditDraft(prev => prev ? { ...prev, finish: formatISODate(d) } : prev)}
                                  placeholder="Окончание"
                                  calendarWidth="240px"
                                  inputWidth="120px"
                                  placement="auto"
                                  offsetY={6}
                                  inputClassName="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2 h-7 text-[12px]"
                                  variant="minimal"
                                />
                                <input
                                  className="h-7 px-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-[12px] min-w-[220px] flex-1"
                                  placeholder="Описание этапа"
                                  value={stageEditDraft?.description || ''}
                                  onChange={e => setStageEditDraft(prev => prev ? { ...prev, description: e.target.value } : prev)}
                                />
                                <button className="h-7 w-7 inline-flex items-center justify-center rounded bg-emerald-600 hover:bg-emerald-700 text-white" title="Сохранить" onClick={() => saveStageEdit(st.id)}>
                                  <Check className="h-4 w-4" />
                                </button>
                                <button className="h-7 w-7 inline-flex items-center justify-center rounded bg-slate-200/70 hover:bg-slate-300 dark:bg-slate-700/70 dark:hover:bg-slate-700" title="Отмена" onClick={cancelEditStage}>
                                  <X className="h-4 w-4" />
                                </button>
                              </div>
                            ) : (
                              <div>
                                <div className="font-medium truncate max-w-[720px]">{st.name}</div>
                                <div className="text-xs text-slate-500">{(st.start||'—')} → {(st.finish||'—')}</div>
                                {st.description && <div className="text-xs text-slate-500 mt-1 line-clamp-2">{st.description}</div>}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5">
                            <div className={`${editingStageId === st.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity duration-150 flex items-center gap-1.5`}>
                              <button
                                className="h-7 w-7 inline-flex items-center justify-center rounded hover:bg-slate-200/60 dark:hover:bg-slate-700/60 text-slate-500 dark:text-slate-300"
                                title="Добавить строку"
                                onClick={() => handleQuickAddItemToStage(st.id)}
                              >
                                <PlusCircle className="h-4 w-4" />
                              </button>
                              {editingStageId === st.id ? (
                                <button className="h-7 w-7 inline-flex items-center justify-center rounded hover:bg-slate-200/60 dark:hover:bg-slate-700/60 text-slate-500 dark:text-slate-300" title="Отмена" onClick={cancelEditStage}>
                                  <X className="h-4 w-4" />
                                </button>
                              ) : (
                                <button className="h-7 w-7 inline-flex items-center justify-center rounded hover:bg-slate-200/60 dark:hover:bg-slate-700/60 text-slate-500 dark:text-slate-300" title="Редактировать этап" onClick={() => startEditStage(st)}>
                                  <Edit3 className="h-4 w-4" />
                                </button>
                              )}
                              <button className="h-7 w-7 inline-flex items-center justify-center rounded text-red-500 dark:text-red-400 hover:bg-red-500/10" title="Удалить этап" onClick={() => handleDeleteStage(st.id)}>
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                            <div className="text-xs tabular-nums text-slate-500 dark:text-slate-400">{actualSum.toFixed(2)} / {plannedSum.toFixed(2)} ч <span className="mx-1 text-slate-400">•</span> {logsSum} отч.</div>
                          </div>
                        </div>
                      </td>
                    </tr>
                    {bucket.map(item => (
                      renderItemRow(item)
                    ))}
                  </React.Fragment>
                )
              })}
              {/* Без этапа */}
              {(() => {
                const bucket = itemsByStage.get('__no_stage__') || []
                if (bucket.length === 0) return null
                const plannedSum = bucket.reduce((s,i)=> s + Number(i.decomposition_item_planned_hours || 0), 0)
                const actualSum = bucket.reduce((s,i)=> s + Number(actualByItemId[i.decomposition_item_id] || 0), 0)
                const logsSum = bucket.reduce((s,i)=> s + Number(logsCountByItemId[i.decomposition_item_id] || 0), 0)
                return (
                  <React.Fragment key="stage-none">
                    <tr className="border-t bg-slate-50 dark:bg-slate-800/40">
                      <td className="px-2 py-2" colSpan={10}>
                        <div className="flex items-center justify-between">
                          <div className="font-medium">Без этапа</div>
                          <div className="text-xs tabular-nums">{actualSum.toFixed(2)} / {plannedSum.toFixed(2)} ч <span className="mx-1 text-slate-400">•</span> {logsSum} отч.</div>
                        </div>
                      </td>
                    </tr>
                    {bucket.map(item => (
                      renderItemRow(item)
                    ))}
                  </React.Fragment>
                )
              })()}
            </tbody>
          </table>
          )}
        </div>
      </div>
      {!compact && (
        <div className="mt-2 flex items-center justify-start">
          <div className="text-xs text-slate-500 dark:text-slate-400">Подсказка: кликните по любому полю для редактирования. Enter — сохранить изменения.</div>
        </div>
      )}

      {/* График этапов */}
      {stages.length > 0 && (
        <div className="mt-4">
          <DecompositionStagesChart stages={stages} />
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
        // Ключ заставляет React размонтировать и смонтировать форму заново при каждом новом открытии,
        // чтобы исключить перенос локального состояния между отчётами
        key={isLogModalOpen ? `add-log-${selectedForLog || 'none'}` : 'add-log-hidden'}
        onSuccess={async () => {
          // Обновим статистику и список
          const { error } = await reloadDecompositionData()
          if (error) {
            console.error('Ошибка перезагрузки декомпозиции после отчёта:', error)
            setNotification('Ошибка обновления списка')
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

      {/* Диалог подтверждения удаления строки декомпозиции */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить строку декомпозиции?</AlertDialogTitle>
            <AlertDialogDescription>
              Это действие необратимо. Строка и связанные данные будут удалены.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600 text-white"
              onClick={() => {
                if (pendingDeleteId) {
                  handleDelete(pendingDeleteId)
                }
                setShowDeleteConfirm(false)
                setPendingDeleteId(null)
              }}
            >
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={isTemplatesOpen} onOpenChange={setIsTemplatesOpen}>
        <DialogContent className="w-[96vw] sm:max-w-[600px] max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Шаблоны декомпозиции</DialogTitle>
            <DialogDescription className="sr-only">Просмотр и применение шаблонов декомпозиции</DialogDescription>
          </DialogHeader>
          <TemplatesPanel
            departmentId={departmentId}
            sectionId={sectionId}
            onApplied={async ({ inserted }) => {
              // Перезагрузка списка после применения шаблона
              const { error } = await reloadDecompositionData()
              if (error) {
                console.error('Ошибка перезагрузки декомпозиции после применения шаблона:', error)
                setNotification('Ошибка обновления списка')
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

      {/* Диалог создания этапа */}
      <Dialog open={createStageOpen} onOpenChange={setCreateStageOpen}>
        <DialogContent className="w-[96vw] sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>Новый этап</DialogTitle>
            <DialogDescription>Заполните параметры этапа</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div className="space-y-1">
              <label className="block text-xs text-slate-600 dark:text-slate-300">Название</label>
              <input
                className="w-full h-9 px-3 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                value={createStageDraft.name}
                onChange={e => setCreateStageDraft(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Например, Проектирование"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="block text-xs text-slate-600 dark:text-slate-300">Начало</label>
                <ProjectDatePicker
                  value={createStageDraft.start ? new Date(createStageDraft.start) : null}
                  onChange={d => setCreateStageDraft(prev => ({ ...prev, start: formatISODate(d) }))}
                  placeholder="Дата начала"
                  calendarWidth="260px"
                  inputWidth="100%"
                  placement="auto"
                  inputClassName="w-full h-9 px-3 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                  variant="minimal"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-xs text-slate-600 dark:text-slate-300">Окончание</label>
                <ProjectDatePicker
                  value={createStageDraft.finish ? new Date(createStageDraft.finish) : null}
                  onChange={d => setCreateStageDraft(prev => ({ ...prev, finish: formatISODate(d) }))}
                  placeholder="Дата окончания"
                  calendarWidth="260px"
                  inputWidth="100%"
                  placement="auto"
                  inputClassName="w-full h-9 px-3 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                  variant="minimal"
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="block text-xs text-slate-600 dark:text-slate-300">Описание</label>
              <textarea
                className="w-full min-h-[90px] px-3 py-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                value={createStageDraft.description || ''}
                onChange={e => setCreateStageDraft(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Краткое описание этапа"
              />
            </div>
          </div>
          <div className="flex items-center justify-end gap-2">
            <button className="h-9 px-3 rounded bg-slate-200/70 hover:bg-slate-300 dark:bg-slate-700/70 dark:hover:bg-slate-700" onClick={() => setCreateStageOpen(false)}>Отмена</button>
            <button className="h-9 px-3 rounded bg-blue-600 hover:bg-blue-700 text-white" onClick={async () => { await handleCreateStage(); setCreateStageOpen(false); setCreateStageDraft({ name: '', start: null, finish: null, description: null }) }}>Создать</button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default SectionDecompositionTab

