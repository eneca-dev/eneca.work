"use client"

import { useEffect, useState, useCallback, useRef, useMemo } from "react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Filter, Users, Building2, FolderOpen, Calendar as CalendarIcon, Tag, FileDown, Eye, Search, RotateCcw, Lock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from "recharts"
import { ArrowUpDown, ChevronUp, ChevronDown } from "lucide-react"
import FilterBar from "@/components/filter-bar/FilterBar"
import { applyReportsLocks } from "@/modules/reports/integration/apply-reports-locks"
import { createClient } from "@/utils/supabase/client"
import { useReportsOrgFiltersStore } from "./filters/store"
import { useReportsProjectFiltersStore } from "./filters/projectStore"
import { useReportsAuthorFilterStore } from "./filters/authorStore"

interface WorkLogRow {
  work_log_id: string
  work_log_date: string
  author_name: string
  section_name: string | null
  decomposition_item_description: string | null
  work_category_name: string | null
  work_log_description: string | null
  work_log_hours: number
  work_log_hourly_rate: number
  work_log_amount: number
  project_name?: string | null
  stage_name?: string | null
  object_name?: string | null
}

const supabase = createClient()

export default function ReportsPage() {
  const [rows, setRows] = useState<WorkLogRow[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [offset, setOffset] = useState(0)
  const PAGE_SIZE = 200
  const [hasMore, setHasMore] = useState(true)
  const [totalCount, setTotalCount] = useState<number | null>(null)
  const [authors, setAuthors] = useState<Array<{ author_id: string; author_name: string }>>([])
  const { authorId, setAuthorId, authorSearch, setAuthorSearch } = useReportsAuthorFilterStore()
  // Визуальные фильтры (дизайн, без логики)
  const [orgOpen, setOrgOpen] = useState(true)
  const [projOpen, setProjOpen] = useState(true)
  const [timeOpen, setTimeOpen] = useState(true)
  
  // Состояние для адаптивного отображения текста фильтров
  const [isCompactMode, setIsCompactMode] = useState(false)
  
  // Организационные фильтры через стор
  const {
    initialize: initOrgFilters,
    isLoading: orgLoading,
    departments,
    getTeamsForSelectedDepartment,
    getEmployeesFiltered,
    employees,
    // teams нужны для имени выбранной команды в title
    // доступ к полному списку команд через стор: возьмём через getState в эффекте ниже при необходимости
    selectedDepartmentId,
    selectedTeamId,
    selectedEmployeeId,
    setDepartment,
    setTeam,
    setEmployee,
  } = useReportsOrgFiltersStore()
  // Проектные фильтры через стор
  const {
    initialize: initProjectFilters,
    isLoadingProjects,
    isLoadingStages,
    isLoadingObjects,
    isLoadingSections,
    projects,
    stages,
    objects,
    sections,
    selectedProjectId: projectId,
    selectedStageId: stageId,
    selectedObjectId: objectId,
    selectedSectionId: sectionIdFilter,
    setProject,
    setStage,
    setObject,
    setSection
  } = useReportsProjectFiltersStore()
  const [projectSearch, setProjectSearch] = useState<string>("")
  const [periodPreset, setPeriodPreset] = useState<"m"|"w"|"pm"|"y"|"custom">("m")
  const [dateFrom, setDateFrom] = useState<string>("")
  const [dateTo, setDateTo] = useState<string>("")
  // Категории трудозатрат
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([])
  const [categoryId, setCategoryId] = useState<string>("")
  const [categorySearch, setCategorySearch] = useState<string>("")
  const selectedAuthorName = authors.find(a => a.author_id === authorId)?.author_name || ""
  const lastQuerySigRef = useRef<string | null>(null)
  const [exporting, setExporting] = useState(false)
  const [exportingCsv, setExportingCsv] = useState(false)
  const [showHierarchy, setShowHierarchy] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    try { return localStorage.getItem('reports.showHierarchy') === '1' } catch { return false }
  })
  type SortKey = 'author_name' | 'section_name' | 'work_category_name' | 'work_log_amount'
  const [sortKey, setSortKey] = useState<SortKey>('work_log_date' as any)
  const [sortAsc, setSortAsc] = useState<boolean>(false)

  // Компактный индикатор состояния фильтра Организация + заголовок с выбранными
  const orgActiveCount = [selectedDepartmentId, selectedTeamId, selectedEmployeeId].filter(Boolean).length
  const selectedDepartmentName = selectedDepartmentId ? (departments.find(d => d.id === selectedDepartmentId)?.name || '') : ''
  // teams недоступны напрямую из деструктуризации — получим через store.getState()
  const { teams: allTeams } = useReportsOrgFiltersStore()
  const selectedTeamName = selectedTeamId ? (allTeams.find((t:any) => t.id === selectedTeamId)?.name || '') : ''
  const selectedEmployeeName = selectedEmployeeId ? (employees.find(e => e.id === selectedEmployeeId)?.name || '') : ''
  const orgTitle = orgActiveCount
    ? [selectedDepartmentName, selectedTeamName, selectedEmployeeName].filter(Boolean).join(' › ')
    : undefined

  // Любой выбор в "Организация" должен сбрасывать фильтр "Автор"
  const clearAuthorFilter = useCallback(() => {
    setAuthorId("")
    setAuthorSearch("")
  }, [setAuthorId, setAuthorSearch])

  const resetFilters = () => {
    setAuthorId("")
    setAuthorSearch("")
    setDepartment(null)
    setTeam(null)
    setEmployee(null)
    setProject(null)
    setStage(null)
    setObject(null)
    setSection(null)
    setCategoryId("")
    setCategorySearch("")
    setPeriodPreset('m')
    setDateFrom("")
    setDateTo("")
    setProjectSearch("")
    // Сброс пагинации/состояний списка
    setRows([])
    setOffset(0)
    setHasMore(true)
  }

  // Вспомогательные функции для диапазона дат
  const formatDate = (d: Date) => {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }

  const getPeriodRange = (): { from?: string; to?: string } => {
    try {
      if (periodPreset === 'w') {
        const now = new Date()
        const day = now.getDay() || 7 // 1..7, где 1=понедельник
        const start = new Date(now)
        start.setDate(now.getDate() - (day - 1)) // понедельник
        const end = new Date(start)
        end.setDate(start.getDate() + 6) // воскресенье
        return { from: formatDate(start), to: formatDate(end) }
      }
      if (periodPreset === 'm') {
        const now = new Date()
        const start = new Date(now.getFullYear(), now.getMonth(), 1)
        const end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
        return { from: formatDate(start), to: formatDate(end) }
      }
      if (periodPreset === 'pm') {
        const now = new Date()
        const start = new Date(now.getFullYear(), now.getMonth() - 1, 1)
        const end = new Date(now.getFullYear(), now.getMonth(), 0)
        return { from: formatDate(start), to: formatDate(end) }
      }
      if (periodPreset === 'y') {
        const now = new Date()
        const start = new Date(now.getFullYear(), 0, 1)
        const end = new Date(now.getFullYear(), 11, 31)
        return { from: formatDate(start), to: formatDate(end) }
      }
      // custom
      const range: { from?: string; to?: string } = {}
      if (dateFrom) range.from = dateFrom
      if (dateTo) range.to = dateTo
      return range
    } catch {
      return {}
    }
  }

  // Отображение выбранного периода в топ-баре
  const formatDisplayDate = (iso?: string) => {
    if (!iso) return ''
    const [y, m, d] = iso.split('-')
    return `${d}.${m}.${y}`
  }
  const { from: periodFrom, to: periodTo } = getPeriodRange()
  const periodDisplay = periodFrom && periodTo
    ? `${formatDisplayDate(periodFrom)} — ${formatDisplayDate(periodTo)}`
    : periodFrom
      ? `с ${formatDisplayDate(periodFrom)}`
      : periodTo
        ? `по ${formatDisplayDate(periodTo)}`
        : ''
  const isDefaultPeriod = periodPreset === 'm' && !dateFrom && !dateTo

  const buildBaseQuery = () => {
    let query = supabase
        .from("view_work_logs_enriched")
        .select("work_log_id, work_log_date, author_name, section_name, decomposition_item_description, work_category_name, work_log_description, work_log_hours, work_log_hourly_rate, work_log_amount, author_id, work_category_id, project_id, project_name, stage_id, stage_name, object_id, object_name, section_id", { count: 'estimated' })
        .order(sortKey as any, { ascending: sortAsc })
    // Фильтр по периоду
      const { from, to } = getPeriodRange()
      if (from) query = query.gte('work_log_date', from)
      if (to) query = query.lte('work_log_date', to)

      // Приоритет фильтров по автору/сотруднику/организации
      const effectiveAuthorId = selectedEmployeeId || (!selectedDepartmentId && !selectedTeamId ? authorId : "")
      if (effectiveAuthorId) {
        query = query.eq('author_id', effectiveAuthorId)
      } else if (selectedDepartmentId || selectedTeamId) {
        const list = getEmployeesFiltered()
        const ids = list.map(e => e.id).filter(Boolean)
        if (ids.length === 0) {
          return { query: null as any }
        }
        query = query.in('author_id', ids as string[])
      }
      // Пересечение с проектными фильтрами (по section_id)
      if (sectionIdFilter) {
        query = query.eq('section_id', sectionIdFilter)
      } else if (objectId || stageId || projectId) {
        // Фильтруем напрямую по уровням иерархии во view
        if (projectId) query = query.eq('project_id', projectId)
        if (stageId) query = query.eq('stage_id', stageId)
        if (objectId) query = query.eq('object_id', objectId)
      }
      // Фильтр по категории трудозатрат
      if (categoryId) {
        query = query.eq('work_category_id', categoryId)
      }
    return { query }
  }

  const loadPage = async (reset: boolean) => {
    if (reset) {
      setLoading(true)
      setHasMore(true)
      setOffset(0)
    } else {
      setLoadingMore(true)
    }

    const { query } = buildBaseQuery()
    if (!query) {
      setRows([])
      setHasMore(false)
      setLoading(false)
      setLoadingMore(false)
      return
    }

    const currentOffset = reset ? 0 : offset
    const from = currentOffset
    const to = currentOffset + PAGE_SIZE - 1
    const { data, error, count } = await query.range(from, to)

    if (!error && data) {
      const mapped = (data as any[]).map((r) => ({
        work_log_id: r.work_log_id,
        work_log_date: r.work_log_date,
        author_name: r.author_name,
        section_name: r.section_name,
        decomposition_item_description: r.decomposition_item_description,
        work_category_name: r.work_category_name,
        work_log_description: r.work_log_description ?? null,
        work_log_hours: Number(r.work_log_hours || 0),
        work_log_hourly_rate: Number(r.work_log_hourly_rate || 0),
        work_log_amount: Number(r.work_log_amount || 0),
        project_name: r.project_name ?? null,
        stage_name: r.stage_name ?? null,
        object_name: r.object_name ?? null,
      }))
      if (reset) {
        setRows(mapped)
      } else {
        setRows(prev => [...prev, ...mapped])
      }
      const fetched = mapped.length
      setHasMore(fetched === PAGE_SIZE)
      setOffset(currentOffset + fetched)
      if (typeof count === 'number') setTotalCount(count)
    } else {
      if (reset) setRows([])
      setHasMore(false)
    }

    setLoading(false)
    setLoadingMore(false)
  }

  // Перезагрузка при изменении фильтров
  useEffect(() => {
    const sig = [
      authorId || '',
      selectedDepartmentId || '',
      selectedTeamId || '',
      selectedEmployeeId || '',
      projectId || '',
      stageId || '',
      objectId || '',
      sectionIdFilter || '',
      categoryId || '',
      periodPreset,
      dateFrom || '',
      dateTo || '',
      sortKey,
      sortAsc ? '1' : '0'
    ].join('|')

    if (lastQuerySigRef.current === sig) {
      return
    }
    lastQuerySigRef.current = sig
    loadPage(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authorId, selectedDepartmentId, selectedTeamId, selectedEmployeeId, projectId, stageId, objectId, sectionIdFilter, categoryId, periodPreset, dateFrom, dateTo, sortKey, sortAsc])

  // Инициализация организационных фильтров
  useEffect(() => {
    initOrgFilters()
  }, [initOrgFilters])

  // Инициализация проектных фильтров
  useEffect(() => {
    initProjectFilters()
  }, [initProjectFilters])

  // Применение блокировок по permissions (hierarchy)
  useEffect(() => {
    applyReportsLocks().catch(console.error)
  }, [])

  // Убраны глобальные изменения overscroll для html/body

  // Загрузка авторов для фильтра
  useEffect(() => {
    const loadAuthors = async () => {
      const { data, error } = await supabase
        .from('view_work_logs_enriched')
        .select('author_id, author_name')
        .order('author_name', { ascending: true })
      if (!error && data) {
        const map = new Map<string, string>()
        for (const r of data as any[]) {
          if (r.author_id) map.set(r.author_id, r.author_name as string)
        }
        setAuthors(Array.from(map.entries()).map(([author_id, author_name]) => ({ author_id, author_name })))
      }
    }
    loadAuthors()
  }, [])

  // Загрузка категорий трудозатрат
  useEffect(() => {
    const loadCategories = async () => {
      const { data, error } = await supabase
        .from('view_work_logs_enriched')
        .select('work_category_id, work_category_name')
        .order('work_category_name', { ascending: true })
      if (!error && data) {
        const map = new Map<string, string>()
        for (const r of data as any[]) {
          if (r.work_category_id) map.set(r.work_category_id, r.work_category_name as string)
        }
        setCategories(Array.from(map.entries()).map(([id, name]) => ({ id, name })))
      }
    }
    loadCategories()
  }, [])

  // Эффект для определения компактного режима
  useEffect(() => {
    const checkCompactMode = () => {
      // Включаем компактный режим при ширине экрана меньше 1200px
      setIsCompactMode(window.innerWidth < 1200);
    };

    checkCompactMode();
    window.addEventListener('resize', checkCompactMode);
    
    return () => window.removeEventListener('resize', checkCompactMode);
  }, []);

  return (
    <div className="px-0 pt-0 pb-0 h-screen overflow-y-auto overscroll-y-none">
      <FilterBar title="Отчёты" titleClassName="hidden min-[1340px]:block min-[1340px]:text-base xl:text-lg">
          {/* Кнопка: Автор */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-transparent text-[11px] md:text-xs hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap transition-all duration-300 ease-in-out">
                <Users className="h-4 w-4" />
                <span className={`transition-all duration-300 ease-in-out overflow-hidden ${isCompactMode ? 'w-0 opacity-0' : 'w-auto opacity-100'}`}>
                  Автор
                </span>
                {authorId && (
                  <span aria-label="Фильтр применён" className="ml-1 inline-block w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-[260px] p-0">
              <div className="p-2 space-y-2">
                <input
                  type="text"
                  value={authorSearch}
                  onChange={e => setAuthorSearch(e.target.value)}
                  placeholder="Поиск автора..."
                  className="w-full px-2 py-1.5 text-[11px] md:text-xs border border-slate-300 dark:border-slate-700 rounded-md dark:bg-slate-900 dark:text-white"
                />
                <select
                  value={authorId}
                  onChange={e => setAuthorId(e.target.value)}
                  className="w-full px-2 py-1.5 text-[11px] md:text-xs border border-slate-300 dark:border-slate-700 rounded-md dark:bg-slate-900 dark:text-white"
                  size={8}
                >
                  <option value="">Все</option>
                  {authors
                    .filter(a => a.author_name.toLowerCase().includes(authorSearch.trim().toLowerCase()))
                    .map(a => (
                      <option key={a.author_id} value={a.author_id}>{a.author_name}</option>
                    ))}
                </select>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
          {/* Чип автора убран — используем индикатор на кнопке */}

          <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 mx-1" />

          {/* Кнопка: Организация */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-transparent text-[11px] md:text-xs hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap transition-all duration-300 ease-in-out" title={orgTitle}>
                <Building2 className="h-4 w-4" />
                <span className={`transition-all duration-300 ease-in-out overflow-hidden ${isCompactMode ? 'w-0 opacity-0' : 'w-auto opacity-100'}`}>
                  Организация
                </span>
                {orgActiveCount > 0 && (
                  <span aria-label="Фильтр применён" className="ml-1 inline-block w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-[320px] p-0">
              <div className="p-2 space-y-2">
                {/* Отдел */}
                <div>
                  <div className="flex items-center gap-1 text-[10px] text-slate-500 mb-1">
                    <span>Отдел</span>
                    {(useReportsOrgFiltersStore.getState() as any).lockedFilters?.includes('department') && <Lock className="h-3 w-3 text-slate-400" />}
                  </div>

                  <select
                    value={selectedDepartmentId || ""}
                    onChange={e=>{ clearAuthorFilter(); setDepartment(e.target.value || null) }}
                    className="w-full px-2 py-1.5 text-[11px] md:text-xs border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 dark:text-white focus:border-indigo-400 dark:focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 dark:focus:ring-indigo-400/20 transition-all duration-200 rounded-md"
                    size={6}
                    disabled={orgLoading || (useReportsOrgFiltersStore.getState() as any).lockedFilters?.includes('department')}
                  >
                    <option value="">Все</option>
                    {departments.map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
                {/* Команда */}
                <div>
                  <div className="flex items-center gap-1 text-[10px] text-slate-500 mb-1">
                    <span>Команда</span>
                    {(useReportsOrgFiltersStore.getState() as any).lockedFilters?.includes('team') && <Lock className="h-3 w-3 text-slate-400" />}
                  </div>
                  <select
                    value={selectedTeamId || ""}
                    onChange={e=>{ clearAuthorFilter(); setTeam(e.target.value || null) }}
                    className="w-full px-2 py-1.5 text-[11px] md:text-xs border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 dark:text-white focus:border-indigo-400 dark:focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 dark:focus:ring-indigo-400/20 transition-all duration-200 rounded-md"
                    size={6}
                    disabled={orgLoading || (useReportsOrgFiltersStore.getState() as any).lockedFilters?.includes('team')}
                  >
                    <option value="">Все</option>
                    {getTeamsForSelectedDepartment().map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
                {/* Сотрудник */}
                <div>
                  <div className="text-[10px] text-slate-500 mb-1">Сотрудник</div>
                  <select
                    value={selectedEmployeeId || ""}
                    onChange={e=>{ clearAuthorFilter(); setEmployee(e.target.value || null) }}
                    className="w-full px-2 py-1.5 text-[11px] md:text-xs border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 dark:text-white focus:border-indigo-400 dark:focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 dark:focus:ring-indigo-400/20 transition-all duration-200 rounded-md"
                    size={6}
                    disabled={orgLoading}
                  >
                    <option value="">Все</option>
                    {getEmployeesFiltered().map(emp => (
                      <option key={emp.id} value={emp.id}>{emp.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 mx-1" />

          {/* Кнопка: Проект */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-transparent text-[11px] md:text-xs hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap transition-all duration-300 ease-in-out">
                <FolderOpen className="h-4 w-4" />
                <span className={`transition-all duration-300 ease-in-out overflow-hidden ${isCompactMode ? 'w-0 opacity-0' : 'w-auto opacity-100'}`}>
                  Проект
                </span>
                {(projectId || stageId || objectId || sectionIdFilter) && (
                  <span aria-label="Фильтр применён" className="ml-1 inline-block w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-[340px] p-0">
              <div className="p-2 space-y-2">
                {/* Заголовок панели */}
                <div className="flex items-center justify-between">
                  <div className="text-[10px] text-slate-500">Проектная иерархия</div>
                </div>

                {/* Поиск по структуре */}
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3 w-3 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Поиск по структуре..."
                    value={projectSearch}
                    onChange={e => setProjectSearch(e.target.value)}
                    className="w-full pl-7 pr-2 py-1.5 text-[11px] md:text-xs border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 dark:text-white focus:border-indigo-400 dark:focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 dark:focus:ring-indigo-400/20 transition-all duration-200 rounded-md"
                  />
                </div>

                {/* Проект */}
                <div>

                  <div className="flex items-center gap-1 text-[10px] text-slate-500 mb-1">
                    <span>Проект</span>
                    {(useReportsProjectFiltersStore.getState() as any).lockedFilters?.includes('project') && <Lock className="h-3 w-3 text-slate-400" />}
                  </div>
                  <select 
                    value={projectId || ""} 
                    onChange={e=>setProject(e.target.value || null)} 
                    className="w-full px-2 py-1.5 text-[11px] md:text-xs border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 dark:text-white focus:border-indigo-400 dark:focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 dark:focus:ring-indigo-400/20 transition-all duration-200 rounded-md"
                    size={6}
                    disabled={isLoadingProjects}
                  >
                    <option value="">Все</option>
                    {projects
                      .filter(p => p.name.toLowerCase().includes(projectSearch.trim().toLowerCase()))
                      .map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>

                {/* Стадия */}
                <div>

                  <div className="flex items-center gap-1 text-[10px] text-slate-500 mb-1">
                    <span>Стадия</span>
                    {(useReportsProjectFiltersStore.getState() as any).lockedFilters?.includes('stage') && <Lock className="h-3 w-3 text-slate-400" />}
                  </div>
                  <select 
                    value={stageId || ""} 
                    onChange={e=>setStage(e.target.value || null)} 
                    className="w-full px-2 py-1.5 text-[11px] md:text-xs border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 dark:text-white focus:border-indigo-400 dark:focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 dark:focus:ring-indigo-400/20 transition-all duration-200 rounded-md"
                    size={6}
                    disabled={isLoadingStages || !projectId}
                  >
                    <option value="">Все</option>
                    {stages.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>

                {/* Объект */}
                <div>
                  <div className="flex items-center gap-1 text-[10px] text-slate-500 mb-1">
                    <span>Объект</span>
                    {(useReportsProjectFiltersStore.getState() as any).lockedFilters?.includes('object') && <Lock className="h-3 w-3 text-slate-400" />}
                  </div>
                  <select 
                    value={objectId || ""} 
                    onChange={e=>setObject(e.target.value || null)} 
                    className="w-full px-2 py-1.5 text-[11px] md:text-xs border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 dark:text-white focus:border-indigo-400 dark:focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 dark:focus:ring-indigo-400/20 transition-all duration-200 rounded-md"
                    size={6}
                    disabled={isLoadingObjects || !stageId}
                  >
                    <option value="">Все</option>
                    {objects.map(o => (
                      <option key={o.id} value={o.id}>{o.name}</option>
                    ))}
                  </select>
                </div>

                {/* Раздел */}
                <div>

                  <div className="flex items-center gap-1 text-[10px] text-slate-500 mb-1">
                    <span>Раздел</span>
                    {(useReportsProjectFiltersStore.getState() as any).lockedFilters?.includes('section') && <Lock className="h-3 w-3 text-slate-400" />}
                  </div>
                  <select 
                    value={sectionIdFilter || ""} 
                    onChange={e=>setSection(e.target.value || null)} 
                    className="w-full px-2 py-1.5 text-[11px] md:text-xs border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 dark:text-white focus:border-indigo-400 dark:focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 dark:focus:ring-indigo-400/20 transition-all duration-200 rounded-md"
                    size={6}
                    disabled={isLoadingSections || !objectId}
                  >
                    <option value="">Все</option>
                    {sections.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 mx-1" />

          {/* Кнопка: Категория */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-transparent text-[11px] md:text-xs hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap transition-all duration-300 ease-in-out">
                <Tag className="h-4 w-4" />
                <span className={`transition-all duration-300 ease-in-out overflow-hidden ${isCompactMode ? 'w-0 opacity-0' : 'w-auto opacity-100'}`}>
                  Категория
                </span>
                {categoryId && (
                  <span aria-label="Фильтр применён" className="ml-1 inline-block w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-[280px] p-0">
              <div className="p-2 space-y-2">
                <input
                  type="text"
                  value={categorySearch}
                  onChange={e => setCategorySearch(e.target.value)}
                  placeholder="Поиск категории..."
                  className="w-full px-2 py-1.5 text-[11px] md:text-xs border border-slate-300 dark:border-slate-700 rounded-md dark:bg-slate-900 dark:text-white"
                />
                <select
                  value={categoryId}
                  onChange={e => setCategoryId(e.target.value)}
                  className="w-full px-2 py-1.5 text-[11px] md:text-xs border border-slate-300 dark:border-slate-700 rounded-md dark:bg-slate-900 dark:text-white"
                  size={8}
                >
                  <option value="">Все</option>
                  {categories
                    .filter(c => c.name.toLowerCase().includes(categorySearch.trim().toLowerCase()))
                    .map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                </select>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 mx-1" />

          {/* Кнопка: Период */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-transparent text-[11px] md:text-xs hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap transition-all duration-300 ease-in-out">
                <CalendarIcon className="h-4 w-4" />
                <span className={`transition-all duration-300 ease-in-out overflow-hidden ${isCompactMode ? 'w-0 opacity-0' : 'w-auto opacity-100'}`}>
                  Период
                </span>
                {(periodPreset !== 'm' || dateFrom || dateTo) && (
                  <span aria-label="Фильтр применён" className="ml-1 inline-block w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-[320px] p-0">
              <div className="p-2 space-y-2">
                <div className="flex flex-wrap gap-2">
                  {[
                    {key:'w',label:'Текущая неделя'},
                    {key:'m',label:'Текущий месяц'},
                    {key:'pm',label:'Прошлый месяц'},
                    {key:'y',label:'Год'},
                  ].map(p => (
                    <button
                      key={p.key}
                      onClick={()=>setPeriodPreset(p.key as any)}
                      className={`text-xs px-2 py-1 rounded border ${periodPreset===p.key ? 'bg-emerald-600 text-white border-emerald-600' : 'border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                    >{p.label}</button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500 dark:text-slate-400 ml-1">c</span>
                  <input type="date" value={dateFrom} onChange={e=>{setPeriodPreset('custom'); setDateFrom(e.target.value)}} className="px-2 py-1.5 text-sm border border-slate-300 dark:border-slate-700 rounded-md dark:bg-slate-900 dark:text-white" />
                  <span className="text-xs text-slate-500 dark:text-slate-400">по</span>
                  <input type="date" value={dateTo} onChange={e=>{setPeriodPreset('custom'); setDateTo(e.target.value)}} className="px-2 py-1.5 text-sm border border-slate-300 dark:border-slate-700 rounded-md dark:bg-slate-900 dark:text-white" />
                </div>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
          {periodDisplay && (
            <span
              className={
                isDefaultPeriod
                  ? "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] md:text-xs bg-slate-100 text-slate-700 dark:bg-slate-800/60 dark:text-slate-200 border border-slate-300 dark:border-slate-700"
                  : "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] md:text-xs bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-800"
              }
              title={periodDisplay}
            >
              <span className="max-w-[200px] truncate">{periodDisplay}</span>
              {!isDefaultPeriod && (
                <button
                  onClick={() => { setPeriodPreset('m'); setDateFrom(''); setDateTo('') }}
                  className="ml-1 rounded hover:bg-emerald-200/60 dark:hover:bg-emerald-800/60 px-1"
                  aria-label="Очистить период"
                >
                  ×
                </button>
              )}
            </span>
          )}
            {/* Кнопка сброса в стиле планирования */}
            <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 mx-1" />
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={resetFilters} title="Сбросить фильтры">
              <RotateCcw className="h-4 w-4" />
            </Button>
            <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 mx-1" />
            <button
              onClick={() => {
                const next = !showHierarchy
                setShowHierarchy(next)
                try { localStorage.setItem('reports.showHierarchy', next ? '1' : '0') } catch {}
              }}
              className={
                "inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border text-[11px] md:text-xs whitespace-nowrap transition-all duration-300 ease-in-out " +
                (showHierarchy
                  ? "border-emerald-300 dark:border-emerald-800 bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200"
                  : "border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800")
              }
              title={showHierarchy ? "Скрыть иерархию" : "Показать иерархию"}
            >
              <Eye className="h-4 w-4" />
              <span className={`transition-all duration-300 ease-in-out overflow-hidden ${isCompactMode ? 'w-0 opacity-0' : 'w-auto opacity-100'}`}>
                Иерархия
              </span>
            </button>
            <button
              onClick={async () => {
                try {
                  setExportingCsv(true)
                  const { query } = buildBaseQuery()
                  if (!query) return
                  const { data, error } = await query.range(0, 50000)
                  if (error) throw error
                  const rowsToExport = (data as any[]).map(r => ({
                    date: r.work_log_date ? new Date(r.work_log_date).toLocaleDateString('ru-RU') : '',
                    author: r.author_name || '',
                    section: r.section_name || '',
                    category: r.work_category_name || '',
                    decomposition: r.decomposition_item_description || '',
                    description: r.work_log_description || '',
                    hours: Number(r.work_log_hours || 0),
                    rate: Number(r.work_log_hourly_rate || 0),
                    amount: Number(r.work_log_amount || 0),
                  }))
                  const header = ['Дата','Автор','Раздел','Категория','Строка декомпозиции','Описание отчёта','Часы','Ставка','Сумма, BYN']
                  const escape = (s: string) => '"' + s.replace(/"/g, '""').replace(/\r?\n/g, ' ') + '"'
                  const toCsv = (rows: any[]) => [
                    header.join(';'),
                    ...rows.map(r => [
                      escape(r.date),
                      escape(r.author),
                      escape(r.section),
                      escape(r.category),
                      escape(r.decomposition),
                      escape(r.description),
                      String(r.hours).replace('.', ','),
                      String(r.rate).replace('.', ','),
                      String(r.amount).replace('.', ','),
                    ].join(';'))
                  ].join('\n')
                  const csv = '\uFEFF' + toCsv(rowsToExport)
                  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement('a')
                  const ts = new Date()
                  const name = `reports_${ts.getFullYear()}${String(ts.getMonth()+1).padStart(2,'0')}${String(ts.getDate()).padStart(2,'0')}_${String(ts.getHours()).padStart(2,'0')}${String(ts.getMinutes()).padStart(2,'0')}`
                  a.href = url
                  a.download = `${name}.csv`
                  document.body.appendChild(a)
                  a.click()
                  a.remove()
                  URL.revokeObjectURL(url)
                } catch (e) {
                  console.error('Export CSV error:', e)
                } finally {
                  setExportingCsv(false)
                }
              }}
              disabled={exportingCsv}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-transparent text-[11px] md:text-xs hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap transition-all duration-300 ease-in-out"
              title="Выгрузить в CSV"
            >
              <FileDown className="h-4 w-4" />
              <span className={`transition-all duration-300 ease-in-out overflow-hidden ${isCompactMode ? 'w-0 opacity-0' : 'w-auto opacity-100'}`}>
                {exportingCsv ? 'CSV…' : 'CSV'}
              </span>
            </button>
            <button
              onClick={async () => {
                try {
                  setExporting(true)
                  const { query } = buildBaseQuery()
                  if (!query) return
                  const { data, error } = await query.range(0, 50000)
                  if (error) throw error
                  const rowsToExport = (data as any[]).map(r => ({
                    date: r.work_log_date,
                    author: r.author_name,
                    section: r.section_name,
                    category: r.work_category_name,
                    decomposition: r.decomposition_item_description,
                    description: r.work_log_description ?? '',
                    hours: Number(r.work_log_hours || 0),
                    rate: Number(r.work_log_hourly_rate || 0),
                    amount: Number(r.work_log_amount || 0),
                  }))

                  const escapeXml = (s: string) =>
                    s
                      .replace(/&/g, '&amp;')
                      .replace(/</g, '&lt;')
                      .replace(/>/g, '&gt;')
                      .replace(/"/g, '&quot;')
                      .replace(/'/g, '&apos;')

                  const xmlRows = [
                    ['Дата', 'Автор', 'Раздел', 'Категория', 'Строка декомпозиции', 'Описание отчёта', 'Часы', 'Ставка', 'Сумма, BYN'],
                    ...rowsToExport.map(r => [
                      r.date ? new Date(r.date).toISOString().slice(0,10) : '',
                      r.author || '',
                      r.section || '',
                      r.category || '',
                      r.decomposition || '',
                      r.description || '',
                      r.hours,
                      r.rate,
                      r.amount,
                    ])
                  ].map(row =>
                    `<Row>` +
                    row
                      .map(val =>
                        typeof val === 'number'
                          ? `<Cell><Data ss:Type="Number">${val}</Data></Cell>`
                          : `<Cell><Data ss:Type="String">${escapeXml(String(val))}</Data></Cell>`
                      )
                      .join('') +
                    `</Row>`
                  ).join('')

                  const xml = `<?xml version="1.0"?>\n<?mso-application progid="Excel.Sheet"?>\n<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">\n<Worksheet ss:Name="Reports">\n<Table>${xmlRows}</Table>\n</Worksheet>\n</Workbook>`

                  const blob = new Blob([xml], { type: 'application/vnd.ms-excel' })
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement('a')
                  const ts = new Date()
                  const name = `reports_${ts.getFullYear()}${String(ts.getMonth()+1).padStart(2,'0')}${String(ts.getDate()).padStart(2,'0')}_${String(ts.getHours()).padStart(2,'0')}${String(ts.getMinutes()).padStart(2,'0')}`
                  a.href = url
                  a.download = `${name}.xls`
                  document.body.appendChild(a)
                  a.click()
                  a.remove()
                  URL.revokeObjectURL(url)
                } catch (e) {
                  console.error('Export XLS error:', e)
                } finally {
                  setExporting(false)
                }
              }}
              disabled={exporting}
              className="hidden"
              title=""
            >
            </button>
      </FilterBar>
      <div className="relative overflow-x-auto overflow-y-auto border-b border-x-0 rounded-none dark:border-slate-700 flex flex-col" style={{ height: 'calc(100vh - 60px)' }}>
        <table className="min-w-[1160px] lg:min-w-full w-full table-fixed border-separate border-spacing-0 text-[9px] sm:text-[10px] md:text-[11px] lg:text-xs leading-tight">
          <colgroup>
            {[
              'min-w-[78px] w-[9%]',    // Дата
              'min-w-[120px] w-[12%]',   // Автор
              'w-[14%]',   // Раздел
              'w-[12%]',   // Категория
              'w-[24%]',   // Декомпозиция
              'w-[16%]',   // Описание отчёта
              'w-[6%]',    // Часы
              'w-[9%]',    // Ставка
              'w-[10%]',   // Сумма
            ].map((cls, i) => (
              <col key={i} className={cls} />
            ))}
          </colgroup>
          <thead className="sticky top-0 z-20 bg-slate-100/95 dark:bg-slate-800/90 backdrop-blur text-slate-700 dark:text-slate-200 border-t border-slate-200/70 dark:border-slate-700/70">
            <tr>
              <th className="min-w-[78px] px-1 md:px-1.5 lg:px-2 py-1.5 text-left border-b whitespace-nowrap pl-1 sm:pl-1.5 md:pl-2 lg:pl-3 pr-1 sm:pr-2">Дата</th>
              <th className="min-w-[120px] px-1.5 md:px-2 lg:px-3 py-1.5 text-left border-b whitespace-nowrap pl-1 sm:pl-2">
                <button onClick={() => { setSortKey('author_name'); setSortAsc(k=> sortKey==='author_name' ? !k : true) }} className="inline-flex items-center gap-1">
                  Автор {sortKey==='author_name' ? (sortAsc ? <ChevronUp className="h-3 w-3"/> : <ChevronDown className="h-3 w-3"/>) : <ArrowUpDown className="h-3 w-3 opacity-50"/>}
                </button>
              </th>
              <th className="px-1.5 md:px-2 lg:px-3 py-1.5 text-left border-b whitespace-nowrap">
                <button onClick={() => { setSortKey('section_name'); setSortAsc(k=> sortKey==='section_name' ? !k : true) }} className="inline-flex items-center gap-1">
                  Раздел {sortKey==='section_name' ? (sortAsc ? <ChevronUp className="h-3 w-3"/> : <ChevronDown className="h-3 w-3"/>) : <ArrowUpDown className="h-3 w-3 opacity-50"/>}
                </button>
              </th>
              <th className="px-1.5 md:px-2 lg:px-3 py-1.5 text-left border-b whitespace-nowrap">
                <button onClick={() => { setSortKey('work_category_name'); setSortAsc(k=> sortKey==='work_category_name' ? !k : true) }} className="inline-flex items-center gap-1">
                  Категория {sortKey==='work_category_name' ? (sortAsc ? <ChevronUp className="h-3 w-3"/> : <ChevronDown className="h-3 w-3"/>) : <ArrowUpDown className="h-3 w-3 opacity-50"/>}
                </button>
              </th>
              <th className="px-1.5 md:px-2 lg:px-3 py-1.5 text-left border-b">Строка декомпозиции</th>
              <th className="px-1.5 md:px-2 lg:px-3 py-1.5 text-left border-b">Описание отчёта</th>
              <th className="px-1.5 md:px-2 lg:px-3 py-1.5 text-right border-b whitespace-nowrap">Часы</th>
              <th className="px-1.5 md:px-2 lg:px-3 py-1.5 text-right border-b whitespace-nowrap">Ставка</th>
              <th className="px-1.5 md:px-2 lg:px-3 py-1.5 text-right border-b whitespace-nowrap pr-4 sm:pr-6 md:pr-10 lg:pr-12">
                <button onClick={() => { setSortKey('work_log_amount'); setSortAsc(k=> sortKey==='work_log_amount' ? !k : false) }} className="inline-flex items-center gap-1">
                  Сумма, BYN {sortKey==='work_log_amount' ? (sortAsc ? <ChevronUp className="h-3 w-3"/> : <ChevronDown className="h-3 w-3"/>) : <ArrowUpDown className="h-3 w-3 opacity-50"/>}
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td className="px-1.5 md:px-2 lg:px-3 py-3" colSpan={9}>Загрузка...</td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td className="px-1.5 md:px-2 lg:px-3 py-6 text-center text-slate-500 dark:text-slate-400" colSpan={9}>
                  Ничего не найдено по выбранным фильтрам.
                  <button
                    onClick={resetFilters}
                    className="ml-2 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-slate-300 dark:border-slate-700 text-[11px] md:text-xs hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    Сбросить
                  </button>
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.work_log_id} className="odd:bg-slate-100 dark:odd:bg-slate-800/40 border-b border-slate-200 dark:border-slate-700 last:border-b-0">
                  <td className="px-1 md:px-1.5 lg:px-2 py-1.5 pl-1 sm:pl-1.5 md:pl-2 lg:pl-3 pr-3 sm:pr-4 text-left text-[9px] sm:text-[10px] md:text-[11px]">
                    <span className="block lg:hidden leading-3">
                      {(() => {
                        const d = new Date(r.work_log_date)
                        const dd = String(d.getDate()).padStart(2,'0')
                        const mm = String(d.getMonth()+1).padStart(2,'0')
                        return `${dd}.${mm}`
                      })()}
                    </span>
                    <span className="hidden lg:inline tabular-nums tracking-wide">{new Date(r.work_log_date).toLocaleDateString('ru-RU')}</span>
                  </td>
                  <td className="px-1.5 md:px-2 lg:px-3 py-1.5 pl-2 sm:pl-3 whitespace-normal md:whitespace-nowrap break-words text-[9px] sm:text-[10px] md:text-[11px] max-w-[110px] sm:max-w-[140px] md:max-w-[180px] leading-4" title={r.author_name}>{r.author_name}</td>
                  <td className="px-1.5 md:px-2 lg:px-3 py-1.5 align-top max-w-[220px] sm:max-w-[260px] md:max-w-[280px]">
                    <div className="text-slate-700 dark:text-slate-200 whitespace-pre-wrap break-words">
                      {r.section_name || '—'}
                    </div>
                    {showHierarchy && (r.project_name || r.stage_name || r.object_name) && (
                      <div className="mt-0.5 text-[10px] leading-3 text-slate-500 dark:text-slate-400 truncate" title={[r.project_name, r.stage_name, r.object_name].filter(Boolean).join(' › ')}>
                        {[r.project_name, r.stage_name, r.object_name].filter(Boolean).join(' › ')}
                      </div>
                    )}
                  </td>
                  <td className="px-1.5 md:px-2 lg:px-3 py-1.5 align-top max-w-[190px]">
                    <div className="flex flex-wrap items-center gap-1">
                      {r.work_category_name ? (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] md:text-[11px] bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200 border border-emerald-200/70 dark:border-emerald-800/60">
                          {r.work_category_name}
                        </span>
                      ) : (
                        <span className="text-slate-500 dark:text-slate-400">—</span>
                      )}
                    </div>
                  </td>
                  <td className="px-1.5 md:px-2 lg:px-3 py-1.5 align-top">
                    <div
                      className="text-slate-700 dark:text-slate-200 whitespace-pre-wrap break-words max-w-[300px] sm:max-w-[360px] md:max-w-[480px] lg:max-w-[560px] xl:max-w-[680px]"
                      title={r.decomposition_item_description || ''}
                    >
                      {r.decomposition_item_description || '—'}
                    </div>
                  </td>
                  <td className="px-1.5 md:px-2 lg:px-3 py-1.5 align-top">
                    <div
                      className="text-slate-700 dark:text-slate-200 whitespace-pre-wrap break-words max-w-[240px] sm:max-w-[280px] md:max-w-[320px] lg:max-w-[360px]"
                      title={r.work_log_description || ''}
                    >
                      {r.work_log_description || '—'}
                    </div>
                  </td>
                  <td className="px-1.5 md:px-2 lg:px-3 py-1.5 text-right tabular-nums whitespace-nowrap">{r.work_log_hours.toFixed(2)}</td>
                  <td className="px-1.5 md:px-2 lg:px-3 py-1.5 text-right tabular-nums whitespace-nowrap">{r.work_log_hourly_rate.toLocaleString('ru-RU', { maximumFractionDigits: 0 })}</td>
                  <td className="px-1.5 md:px-2 lg:px-3 py-1.5 text-right tabular-nums whitespace-nowrap pr-4 sm:pr-6 md:pr-10 lg:pr-12">{r.work_log_amount.toLocaleString('ru-RU', { maximumFractionDigits: 0 })}</td>
                </tr>
              ))
            )}
            {!loading && rows.length > 0 && (
              (() => {
                const totalHours = rows.reduce((acc, r) => acc + (r.work_log_hours || 0), 0)
                const totalAmount = rows.reduce((acc, r) => acc + (r.work_log_amount || 0), 0)
                const count = rows.length
                return (
                  <tr className="bg-slate-100/80 dark:bg-slate-800/60 font-medium">
                    <td className="px-2 py-1.5" colSpan={6}>
                      Итого: {count.toLocaleString('ru-RU')} записей
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums whitespace-nowrap">{totalHours.toFixed(2)}</td>
                    <td className="px-2 py-1.5 text-right text-slate-400">—</td>
                    <td className="px-2 py-1.5 text-right tabular-nums whitespace-nowrap pr-4 sm:pr-6 md:pr-10 lg:pr-12">{totalAmount.toLocaleString('ru-RU', { maximumFractionDigits: 0 })} BYN</td>
                  </tr>
                )
              })()
            )}
          </tbody>
        </table>
        {!loading && rows.length > 0 && (
          hasMore ? (
            <div className="flex items-center justify-center py-3">
              <button
                onClick={() => loadPage(false)}
                disabled={loadingMore}
                className="inline-flex items-center gap-2 px-3 py-1.5 text-[11px] md:text-xs rounded-md border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                {loadingMore ? 'Загрузка…' : 'Показать ещё'}
              </button>
            </div>
          ) : (
            <div className="px-3 md:px-6 py-3 w-full mt-auto">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                {(() => {
                  const hours = rows.reduce((acc, r) => acc + (r.work_log_hours || 0), 0)
                  const amount = rows.reduce((acc, r) => acc + (r.work_log_amount || 0), 0)
                  const rates = rows.map(r => Number(r.work_log_hourly_rate || 0)).filter(n => n > 0)
                  const avgRate = rates.length ? rates.reduce((a, b) => a + b, 0) / rates.length : 0
                  const uniqueAuthors = new Set(rows.map(r => r.author_name || '—')).size
                  const uniqueCategories = new Set(rows.map(r => r.work_category_name || '—')).size
                  const count = rows.length
                  const avgHoursPerRecord = count ? hours / count : 0
                  const byCategory: Record<string, number> = rows.reduce((map, r) => {
                    const key = r.work_category_name || 'Без категории'
                    map[key] = (map[key] || 0) + (r.work_log_amount || 0)
                    return map
                  }, {} as Record<string, number>)
                  const pieData = Object.entries(byCategory)
                    .map(([name, value]) => ({ name, value }))
                    .sort((a, b) => b.value - a.value)
                  const PIE_COLORS = [
                    '#0ea5e9', '#22c55e', '#a855f7', '#f59e0b', '#ef4444',
                    '#14b8a6', '#3b82f6', '#e11d48', '#6366f1', '#10b981'
                  ]
                  const topCategories = pieData.slice(0, 5)
                  const bySection: Record<string, number> = rows.reduce((map, r) => {
                    const key = r.section_name || '—'
                    map[key] = (map[key] || 0) + (r.work_log_amount || 0)
                    return map
                  }, {} as Record<string, number>)
                  const sectionData = Object.entries(bySection)
                    .map(([name, value]) => ({ name, value }))
                    .sort((a, b) => b.value - a.value)
                  const topSections = sectionData.slice(0, 5)
                  const maxSection = topSections[0]?.value || 0
                  return (
                    <>
                      <div className="rounded-md border border-slate-200 dark:border-slate-700 bg-white/60 dark:bg-slate-900/40 p-2">
                        <div className="text-[10px] text-slate-500 dark:text-slate-400">Записей (стр.)</div>
                        <div className="text-sm font-semibold">{count.toLocaleString('ru-RU')}</div>
                        {typeof totalCount === 'number' && (
                          <div className="text-[10px] text-slate-500 dark:text-slate-400">из {totalCount.toLocaleString('ru-RU')}</div>
                        )}
                      </div>
                      <div className="rounded-md border border-slate-200 dark:border-slate-700 bg-white/60 dark:bg-slate-900/40 p-2">
                        <div className="text-[10px] text-slate-500 dark:text-slate-400">Сумма часов</div>
                        <div className="text-sm font-semibold tabular-nums">{hours.toFixed(2)}</div>
                      </div>
                      <div className="rounded-md border border-slate-200 dark:border-slate-700 bg-white/60 dark:bg-slate-900/40 p-2">
                        <div className="text-[10px] text-slate-500 dark:text-slate-400">Сумма денег</div>
                        <div className="text-sm font-semibold tabular-nums">{amount.toLocaleString('ru-RU', { maximumFractionDigits: 0 })} BYN</div>
                      </div>
                      <div className="rounded-md border border-slate-200 dark:border-slate-700 bg-white/60 dark:bg-slate-900/40 p-2">
                        <div className="text-[10px] text-slate-500 dark:text-slate-400">Средняя ставка</div>
                        <div className="text-sm font-semibold tabular-nums">{Math.round(avgRate).toLocaleString('ru-RU')} BYN/ч</div>
                      </div>
                      <div className="rounded-md border border-slate-200 dark:border-slate-700 bg-white/60 dark:bg-slate-900/40 p-2">
                        <div className="text-[10px] text-slate-500 dark:text-slate-400">Уникальных авторов</div>
                        <div className="text-sm font-semibold">{uniqueAuthors.toLocaleString('ru-RU')}</div>
                      </div>
                      <div className="rounded-md border border-slate-200 dark:border-slate-700 bg-white/60 dark:bg-slate-900/40 p-2">
                        <div className="text-[10px] text-slate-500 dark:text-slate-400">Часы/запись (сред.)</div>
                        <div className="text-sm font-semibold tabular-nums">{avgHoursPerRecord.toFixed(2)}</div>
                      </div>
                      <div className="rounded-md border border-slate-200 dark:border-slate-700 bg-white/60 dark:bg-slate-900/40 p-2 col-span-2 sm:col-span-3 lg:col-span-3">
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 mb-2">Распределение по категориям (BYN)</div>
                        <div className="flex items-start gap-3">
                          <div className="h-40 sm:h-48 flex-1 min-w-[180px]">
                            <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={40} outerRadius={70} paddingAngle={1}>
                                  {pieData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                                  ))}
                                </Pie>
                                <Tooltip formatter={(v: any) => Number(v).toLocaleString('ru-RU', { maximumFractionDigits: 0 }) + ' BYN'} />
                              </PieChart>
                            </ResponsiveContainer>
                          </div>
                          <div className="w-48 sm:w-56">
                            <div className="text-[10px] text-slate-500 dark:text-slate-400 mb-1">Top‑5 категорий</div>
                            <div className="space-y-2">
                              {topCategories.map((c, idx) => {
                                const colorIndex = pieData.findIndex(d => d.name === c.name)
                                const color = PIE_COLORS[(colorIndex >= 0 ? colorIndex : idx) % PIE_COLORS.length]
                                const pct = amount > 0 ? Math.round((c.value / amount) * 100) : 0
                                return (
                                  <div key={c.name} className="text-xs">
                                    <div className="flex items-center justify-between gap-2">
                                      <div className="flex items-center gap-2 min-w-0">
                                        <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: color }} />
                                        <span className="truncate" title={c.name}>{c.name}</span>
                                      </div>
                                      <div className="flex items-center gap-2 tabular-nums whitespace-nowrap">
                                        <span className="px-1.5 py-0.5 rounded bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300">
                                          {pct}%
                                        </span>
                                        <span>{c.value.toLocaleString('ru-RU', { maximumFractionDigits: 0 })}</span>
                                      </div>
                                    </div>
                                    <div className="mt-1 h-1.5 rounded bg-slate-200 dark:bg-slate-800 overflow-hidden">
                                      <div className="h-full bg-green-500 dark:bg-green-600" style={{ width: `${pct}%` }} />
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="rounded-md border border-slate-200 dark:border-slate-700 bg-white/60 dark:bg-slate-900/40 p-2 col-span-2 sm:col-span-3 lg:col-span-3">
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 mb-2">Топ‑5 разделов (BYN)</div>
                        <div className="space-y-1.5">
                          {topSections.map((s, i) => {
                            const share = amount > 0 ? (s.value / amount) : 0
                            const bar = maxSection > 0 ? (s.value / maxSection) : 0
                            return (
                              <div key={`${s.name}-${i}`} className="text-xs">
                                <div className="flex items-center justify-between gap-2">
                                  <div className="truncate" title={s.name}>{i + 1}. {s.name}</div>
                                  <div className="flex items-center gap-2 tabular-nums whitespace-nowrap">
                                    <span className="text-slate-500 dark:text-slate-400">{Math.round(share * 100)}%</span>
                                    <span>{s.value.toLocaleString('ru-RU', { maximumFractionDigits: 0 })}</span>
                                  </div>
                                </div>
                                <div className="mt-1 h-1.5 rounded bg-slate-200 dark:bg-slate-800 overflow-hidden">
                                  <div className="h-full bg-green-500 dark:bg-green-600" style={{ width: `${Math.max(2, Math.round(bar * 100))}%` }} />
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    </>
                  )
                })()}
              </div>
            </div>
          )
        )}
      </div>
    </div>
  )
}

