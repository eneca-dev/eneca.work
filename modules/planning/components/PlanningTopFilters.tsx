"use client" 

import { useEffect, useMemo, useState, useRef, useCallback } from 'react'
import FilterBar from '@/components/filter-bar/FilterBar'
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Building, Filter as FilterIcon, FolderOpen, Search, Settings, Calendar as CalendarIcon, ChevronLeft, ChevronRight, Eye, EyeOff, Columns3, ChevronsDown, ChevronsUp, Lock, Network, Layers, Info, BarChart3, RotateCcw, Loader2 } from 'lucide-react'
import { Tooltip as UiTooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip'
import { useSectionStatusesStore } from '@/modules/statuses-tags/statuses/store'
import { useFilterStore } from '@/modules/planning/filters/store'
import { useHasPermission } from '@/modules/permissions/hooks/usePermissions'

import { usePlanningViewStore } from '@/modules/planning/stores/usePlanningViewStore'
import { usePlanningStore } from '@/modules/planning/stores/usePlanningStore'
import { useTimelineUiStore } from '@/modules/planning/stores/useTimelineUiStore'
import { Button } from '@/components/ui/button'
import { applyPlanningLocks } from '@/modules/planning/integration/apply-planning-locks'

// ========================= DatePicker Component =========================
const RU_MONTHS = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
]
const RU_WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"]

function toISODate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

function getMonthMatrix(year: number, month: number): Date[] {
  const firstOfMonth = new Date(year, month, 1)
  const weekday = firstOfMonth.getDay()
  const mondayIndex = (weekday + 6) % 7
  const start = new Date(year, month, 1 - mondayIndex)
  const days: Date[] = []
  for (let i = 0; i < 42; i++) {
    const dt = new Date(start)
    dt.setDate(start.getDate() + i)
    days.push(dt)
  }
  return days
}

function cn(...classes: (string | undefined | false)[]) {
  return classes.filter(Boolean).join(' ')
}

type DatePickerProps = {
  value: Date
  onChange: (date: Date) => void
  triggerClassName?: string
  daysToShow?: number
}

function DatePickerCalendar({ value, onChange, triggerClassName, daysToShow = 180 }: DatePickerProps) {
  const [open, setOpen] = useState(false)
  const [viewYear, setViewYear] = useState<number>(value.getFullYear())
  const [viewMonth, setViewMonth] = useState<number>(value.getMonth())
  const [focusedISO, setFocusedISO] = useState<string>(toISODate(value))

  const triggerElRef = useRef<HTMLButtonElement | null>(null)
  const popoverRef = useRef<HTMLDivElement | null>(null)
  const gridRef = useRef<HTMLDivElement | null>(null)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const prevOpenRef = useRef<boolean>(false)

  const updatePosition = useCallback(() => {
    const el = triggerElRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const width = 300
    // Размещаем правее: выравниваем правый край календаря по левому краю триггера + 300px
    const left = Math.max(rect.left + window.scrollX - width + 300, 8)
    // Размещаем снизу от триггера
    const top = rect.bottom + window.scrollY + 6
    setPos({ top, left })
  }, [])

  useEffect(() => {
    if (!open) return
    updatePosition()
    const onDocClick = (e: MouseEvent) => {
      const t = e.target as Node | null
      if (!t) return
      if (popoverRef.current?.contains(t)) return
      if (triggerElRef.current?.contains(t)) return
      setOpen(false)
    }
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false)
    }
    const onWin = () => updatePosition()
    document.addEventListener("mousedown", onDocClick)
    window.addEventListener("resize", onWin)
    window.addEventListener("scroll", onWin, true)
    window.addEventListener("keydown", onEsc)
    return () => {
      document.removeEventListener("mousedown", onDocClick)
      window.removeEventListener("resize", onWin)
      window.removeEventListener("scroll", onWin, true)
      window.removeEventListener("keydown", onEsc)
    }
  }, [open, updatePosition])

  useEffect(() => {
    if (!open) return
    const justOpened = !prevOpenRef.current && open
    if (!justOpened) return
    const d = value
    setViewYear(d.getFullYear())
    setViewMonth(d.getMonth())
    const id = window.setTimeout(() => {
      gridRef.current?.focus()
    }, 0)
    return () => window.clearTimeout(id)
  }, [open, value])

  useEffect(() => {
    prevOpenRef.current = open
  }, [open])

  const days = getMonthMatrix(viewYear, viewMonth)
  const todayISO = toISODate(new Date())
  const selectedISO = toISODate(value)

  const goPrevMonth = () => {
    const d = new Date(viewYear, viewMonth, 1)
    d.setMonth(d.getMonth() - 1)
    setViewYear(d.getFullYear())
    setViewMonth(d.getMonth())
  }
  const goNextMonth = () => {
    const d = new Date(viewYear, viewMonth, 1)
    d.setMonth(d.getMonth() + 1)
    setViewYear(d.getFullYear())
    setViewMonth(d.getMonth())
  }

  const goToday = () => {
    const now = new Date()
    setViewYear(now.getFullYear())
    setViewMonth(now.getMonth())
    setFocusedISO(toISODate(now))
    gridRef.current?.focus()
  }

  const selectDate = (d: Date) => {
    onChange(d)
    setOpen(false)
  }

  const isCurrentMonth = (d: Date) => d.getMonth() === viewMonth && d.getFullYear() === viewYear

  const formatDisplay = (date: Date) => {
    const start = date
    const end = new Date(date)
    end.setDate(end.getDate() + Math.max(daysToShow - 1, 0))
    const fmt = (d: Date) => {
      const dd = String(d.getDate()).padStart(2, "0")
      const mm = String(d.getMonth() + 1).padStart(2, "0")
      const yyyy = String(d.getFullYear())
      return `${dd}.${mm}.${yyyy}`
    }
    return `${fmt(start)} — ${fmt(end)}`
  }

  return (
    <>
      <button
        ref={triggerElRef}
        type="button"
        role="combobox"
        aria-haspopup="dialog"
        aria-expanded={open}
        className={cn(
          "hidden sm:inline-flex items-center gap-1 px-2 py-1 text-[10px] md:text-xs rounded-full border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer transition-colors",
          triggerClassName
        )}
        onClick={() => {
          if (open) {
            setOpen(false)
          } else {
            setOpen(true)
            setFocusedISO(toISODate(value))
            setViewYear(value.getFullYear())
            setViewMonth(value.getMonth())
          }
        }}
        title="Выбрать дату начала"
      >
        <CalendarIcon className="h-3.5 w-3.5" />
        <span className="tabular-nums select-none">{formatDisplay(value)}</span>
      </button>

      {open && pos && typeof document !== 'undefined' && createPortal(
        <div
          ref={popoverRef}
          className="fixed z-[100] w-[300px] rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-lg p-1.5"
          style={{ top: pos.top, left: pos.left }}
        >
          <div className="flex items-center justify-between px-1 py-1">
            <div className="flex items-center gap-1">
              <button
                type="button"
                className="h-6 w-6 inline-flex items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-700"
                onClick={goPrevMonth}
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                className="h-6 w-6 inline-flex items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-700"
                onClick={goToday}
                aria-label="Сегодня"
                title="Сегодня"
              >
                <CalendarIcon className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="text-[13px] font-medium dark:text-white">
              {RU_MONTHS[viewMonth]} {viewYear}
            </div>
            <div className="flex items-center">
              <button
                type="button"
                className="h-6 w-6 inline-flex items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-700"
                onClick={goNextMonth}
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-[3px] px-1">
            {RU_WEEKDAYS.map((d) => (
              <div key={d} className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400 text-center py-[2px]">
                {d}
              </div>
            ))}
          </div>
          <div
            className="grid grid-cols-7 gap-[3px] p-1"
            ref={gridRef}
            onKeyDown={(e) => {
              const current = new Date(focusedISO)
              if (e.key === "ArrowLeft") {
                e.preventDefault()
                const d = new Date(current)
                d.setDate(d.getDate() - 1)
                setFocusedISO(toISODate(d))
                setViewYear(d.getFullYear())
                setViewMonth(d.getMonth())
              } else if (e.key === "ArrowRight") {
                e.preventDefault()
                const d = new Date(current)
                d.setDate(d.getDate() + 1)
                setFocusedISO(toISODate(d))
                setViewYear(d.getFullYear())
                setViewMonth(d.getMonth())
              } else if (e.key === "ArrowUp") {
                e.preventDefault()
                const d = new Date(current)
                d.setDate(d.getDate() - 7)
                setFocusedISO(toISODate(d))
                setViewYear(d.getFullYear())
                setViewMonth(d.getMonth())
              } else if (e.key === "ArrowDown") {
                e.preventDefault()
                const d = new Date(current)
                d.setDate(d.getDate() + 7)
                setFocusedISO(toISODate(d))
                setViewYear(d.getFullYear())
                setViewMonth(d.getMonth())
              } else if (e.key === "Enter") {
                e.preventDefault()
                const d = new Date(focusedISO)
                selectDate(d)
              }
            }}
            tabIndex={0}
          >
            {days.map((d) => {
              const iso = toISODate(d)
              const isSel = iso === selectedISO
              const isToday = iso === todayISO
              const isOut = !isCurrentMonth(d)
              const isFocus = iso === focusedISO
              const isPast = iso < todayISO

              return (
                <button
                  key={iso + (isOut ? "-out" : "")}
                  type="button"
                  className={cn(
                    "h-7 w-7 rounded-full text-[11px] inline-flex items-center justify-center transition-colors",
                    isPast ? "text-slate-400 dark:text-slate-600" : "text-slate-900 dark:text-slate-100",
                    !isSel && !isOut && "hover:bg-slate-100 dark:hover:bg-slate-700",
                    isSel && "bg-indigo-500 text-white hover:bg-indigo-600",
                    !isSel && isToday && "ring-1 ring-indigo-500",
                    isFocus && "ring-2 ring-slate-400 dark:ring-slate-500"
                  )}
                  onClick={() => selectDate(d)}
                  onMouseEnter={() => setFocusedISO(iso)}
                >
                  {d.getDate()}
                </button>
              )
            })}
          </div>

          {/* Подсказка о диапазоне */}
          <div className="px-2 py-2 text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed border-t border-slate-200 dark:border-slate-700 mt-1">
            Конец диапазона задаётся автоматически: через 180 дней после выбранной даты
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
// ========================= End DatePicker Component =========================
import { useRouter } from 'next/navigation'
import { createPortal } from 'react-dom'

export default function PlanningTopFilters() {
  const router = useRouter()
  const filterStore = useFilterStore()
  const statuses = useSectionStatusesStore(state => state.statuses)
  const loadStatuses = useSectionStatusesStore(state => state.loadStatuses)
  const { startDate, daysToShow, setStartDate, scrollBackward, scrollForward } = usePlanningViewStore()
  const {
    showSections,
    showDepartments,
    toggleShowSections,
    toggleShowDepartments,
    expandAllSections,
    collapseAllSections,
    expandAllProjectGroups,
    collapseAllProjectGroups,
    expandAllDepartments,
    collapseAllDepartments,
    expandAllTeams,
    collapseAllTeams,
    expandAllEmployees,
    collapseAllEmployees,
    groupByProject,
    fetchSections,
    fetchDepartments,
    loadVacations,
    loadFreshness,
    toggleSectionExpanded,
    toggleDepartmentExpanded,
    isLoadingSections,
    isLoadingDepartments,
    vacationsCache,
  } = usePlanningStore()
  const expandedSections = usePlanningStore(s => s.expandedSections)
  const expandedProjectGroups = usePlanningStore(s => s.expandedProjectGroups)

  // Проверяем разрешение на просмотр аналитики планирования
  const canViewPlanningAnalytics = useHasPermission('planning.analytics_view')

  const [isCompactMode, setIsCompactMode] = useState(false)
  const [statusSearch, setStatusSearch] = useState('')
  const [projectSearch, setProjectSearch] = useState('')
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Комбинированный флаг загрузки: показывает индикатор при любой загрузке данных
  const isAnyLoading = isRefreshing || isLoadingSections || isLoadingDepartments || vacationsCache.isLoading

  // Гарантируем дефолт: отделы включены, разделы выключены при первом монтировании
  const [initialized, setInitialized] = useState(false)
  useEffect(() => {
    if (initialized) return
    if (!showDepartments) {
      toggleShowDepartments()
    }
    if (showSections) {
      toggleShowSections()
    }
    setInitialized(true)
  }, [initialized, showDepartments, showSections, toggleShowDepartments, toggleShowSections])

  useEffect(() => {
    const checkCompactMode = () => setIsCompactMode(window.innerWidth < 1200)
    checkCompactMode()
    window.addEventListener('resize', checkCompactMode)
    return () => window.removeEventListener('resize', checkCompactMode)
  }, [])

  const filteredStatuses = useMemo(
    () => (statuses || []).filter(s => !statusSearch.trim() || s.name.toLowerCase().includes(statusSearch.toLowerCase()) || (s.description && s.description.toLowerCase().includes(statusSearch.toLowerCase()))),
    [statuses, statusSearch]
  )

  // Базовая инициализация справочников фильтров (если пусто)
  useEffect(() => {
    // Применяем блокировки по permissions (hierarchy)
    applyPlanningLocks().catch(console.error)

    if (filterStore.subdivisions.length === 0) {
      filterStore.loadSubdivisions()
    }
    if (filterStore.managers.length === 0) {
      filterStore.loadManagers()
    }
    if (filterStore.departments.length === 0) {
      filterStore.loadDepartments()
    }
    if (filterStore.employees.length === 0) {
      filterStore.loadEmployees()
    }
    if (filterStore.projects.length === 0) {
      filterStore.loadProjects(filterStore.selectedManagerId || null)
    }
    // Загружаем статусы разделов
    if ((statuses || []).length === 0) {
      loadStatuses()
    }  }, [
    filterStore.subdivisions.length,
    filterStore.managers.length,
    filterStore.departments.length,
    filterStore.employees.length,
    filterStore.projects.length,
    filterStore.selectedManagerId,
    filterStore.loadSubdivisions,
    filterStore.loadManagers,
    filterStore.loadDepartments,
    filterStore.loadEmployees,
    filterStore.loadProjects,
    loadStatuses,
  ])

  // Каскадная подзагрузка при выборе проекта/стадии
  useEffect(() => {
    if (filterStore.selectedProjectId && filterStore.stages.length === 0) {
      filterStore.loadStages(filterStore.selectedProjectId)
    }
  }, [filterStore.selectedProjectId, filterStore.stages.length, filterStore.loadStages])

  useEffect(() => {
    if (filterStore.selectedStageId && filterStore.objects.length === 0) {
      filterStore.loadObjects(filterStore.selectedStageId)
    }
  }, [filterStore.selectedStageId, filterStore.objects.length, filterStore.loadObjects])

  const goToday = () => {
    const d = new Date()
    d.setDate(d.getDate() - 7)
    setStartDate(d)
  }

  // Универсальные функции для разворачивания/сворачивания всех групп
  const handleExpandAll = async () => {
    // 0-й уровень: загрузки внутри этапов (если показываются разделы)
    if (showSections) {
      const { stageLoadingsCollapsed, setStageLoadingsCollapsed } = useTimelineUiStore.getState()
      if (stageLoadingsCollapsed !== false) {
        setStageLoadingsCollapsed(false)
        return
      }
    }
    // Если показываются только отделы — двухшагово: 1) команды, 2) сотрудники
    if (showDepartments && !showSections) {
      // Если есть свернутые команды — сначала команды
      const hasCollapsedTeams = Object.values(usePlanningStore.getState().expandedTeams).some((v) => v === false) || Object.keys(usePlanningStore.getState().expandedTeams).length === 0
      if (hasCollapsedTeams) {
        expandAllTeams()
        return
      }
      // Иначе — раскрываем сотрудников
      expandAllEmployees()
      return
    }

    // Если показываются и разделы, и отделы — второй шаг: раскрываем разделы, третий — проекты/команды
    if (showSections && showDepartments) {
      const anySectionCollapsed = Object.values(expandedSections).some(v => !v) || Object.keys(expandedSections).length === 0
      if (anySectionCollapsed) {
        await expandAllSections()
        return
      }
      const hasCollapsedProjectGroups = groupByProject && Object.values(expandedProjectGroups).some(v => v === false)
      const expandedTeamsMap = usePlanningStore.getState().expandedTeams
      const hasCollapsedTeams = Object.values(expandedTeamsMap).some((v) => v === false) || Object.keys(expandedTeamsMap).length === 0
      if (hasCollapsedProjectGroups) {
        expandAllProjectGroups()
        return
      }
      if (hasCollapsedTeams) {
        expandAllTeams()
        return
      }
      // Последним шагом — сотрудники
      expandAllEmployees()
      return
    }

    // Иначе (только разделы): 2-й шаг — разделы, 3-й — проекты
    const anySectionCollapsed = Object.values(expandedSections).some(v => !v) || Object.keys(expandedSections).length === 0
    if (anySectionCollapsed) {
      await expandAllSections()
      return
    }
    const hasCollapsedProjectGroups = groupByProject && Object.values(expandedProjectGroups).some(v => v === false)
    if (hasCollapsedProjectGroups) {
      expandAllProjectGroups()
      return
    }
  }

  const handleCollapseAll = () => {
    // 0-й уровень: загрузки внутри этапов (если показываются разделы)
    if (showSections) {
      const { stageLoadingsCollapsed, setStageLoadingsCollapsed } = useTimelineUiStore.getState()
      if (stageLoadingsCollapsed !== true) {
        setStageLoadingsCollapsed(true)
        return
      }
    }
    // Если показываются только отделы — двухшагово: 1) сотрудники внутрь команд, 2) команды внутрь отделов
    if (showDepartments && !showSections) {
      const anyEmployeeExpanded = Object.values(usePlanningStore.getState().expandedEmployees).some(Boolean)
      if (anyEmployeeExpanded) {
        collapseAllEmployees()
        return
      }
      collapseAllTeams()
      return
    }

    // Если показываются и разделы, и отделы — второй шаг: сворачиваем разделы, затем сотрудники/проекты/команды
    if (showSections && showDepartments) {
      const anySectionExpanded = Object.values(expandedSections).some(Boolean)
      if (anySectionExpanded) {
        collapseAllSections()
        return
      }
      const anyEmployeeExpanded = Object.values(usePlanningStore.getState().expandedEmployees).some(Boolean)
      if (anyEmployeeExpanded) {
        collapseAllEmployees()
        return
      }
      if (groupByProject) {
        collapseAllProjectGroups()
        return
      }
      collapseAllTeams()
      return
    }

    // Иначе (только разделы): 2-й шаг — разделы, 3-й — проекты
    const anySectionExpanded = Object.values(expandedSections).some(Boolean)
    if (anySectionExpanded) {
      collapseAllSections()
      return
    }
    if (groupByProject) {
      collapseAllProjectGroups()
    }
  }

  return (
    <TooltipProvider>
    <FilterBar title="Планирование" titleClassName="hidden min-[1340px]:block min-[1340px]:text-base xl:text-lg" right={(
      <div className="flex items-center gap-1">
        <DatePickerCalendar
          value={startDate}
          onChange={setStartDate}
          daysToShow={daysToShow}
        />
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={scrollBackward} title="Назад на 2 недели">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={scrollForward} title="Вперёд на 2 недели">
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={goToday} title="Сегодня">
          <CalendarIcon className="h-4 w-4" />
        </Button>
        <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 mx-1" />
        {/* Отделы */}
        <Button variant="ghost" size="icon" className={`h-7 w-7 ${showDepartments ? 'text-teal-600 dark:text-teal-400' : ''}`} onClick={toggleShowDepartments} title={showDepartments ? 'Скрыть отделы' : 'Показать отделы'}>
          {showDepartments ? <Network className="h-4 w-4" /> : <Network className="h-4 w-4 opacity-50" />}
        </Button>
        {/* Разделы */}
        <Button variant="ghost" size="icon" className={`h-7 w-7 ${showSections ? 'text-teal-600 dark:text-teal-400' : ''}`} onClick={toggleShowSections} title={showSections ? 'Скрыть разделы' : 'Показать разделы'}>
          {showSections ? <Layers className="h-4 w-4" /> : <Layers className="h-4 w-4 opacity-50" />}
        </Button>
        {/* Развернуть/Свернуть все */}
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleExpandAll} title="Развернуть все">
          <ChevronsDown className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleCollapseAll} title="Свернуть все">
          <ChevronsUp className="h-4 w-4" />
        </Button>
        {/* Аналитика - показывается только пользователям с разрешением planning.analytics_view */}
        {canViewPlanningAnalytics && (
          <>
            <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 mx-1" />
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => router.push('/dashboard/planning-analytics')} title="Аналитика планирования">
              <BarChart3 className="h-4 w-4" />
            </Button>
          </>
        )}
        {/* Кнопка сброса перенесена в блок фильтров слева */}
      </div>
    )}>
      {/* Организация */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="inline-flex items-center gap-1 px-2 py-1 border border-transparent text-[11px] md:text-xs hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap transition-all duration-200 ease-in-out rounded-md">
            <Building className="h-3.5 w-3.5 text-slate-600 dark:text-slate-300" />
            <span className={`transition-all duration-300 ease-in-out overflow-hidden ${isCompactMode ? 'w-0 opacity-0' : 'w-auto opacity-100'}`}>
              Организация
            </span>
            {[filterStore.selectedSubdivisionId, filterStore.selectedDepartmentId, filterStore.selectedTeamId, filterStore.selectedEmployeeId].some(Boolean) && (
              <span className="ml-1 inline-block w-1.5 h-1.5 bg-emerald-500 rounded-full" />
            )}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-[320px] p-0 dark:bg-slate-800 dark:border-slate-700">
          <div className="p-2 space-y-2">
            {/* Подразделение */}
            <div>
              <div className="flex items-center gap-1 text-[10px] text-slate-500 mb-1">
                <span>Подразделение</span>
                {filterStore.isFilterLocked('subdivision') && (
                  <>
                    <Lock className="h-3 w-3 text-slate-400" />
                    <UiTooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3 w-3 text-slate-400 cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="text-xs dark:text-slate-200 leading-tight">
                        Недостаточно прав для изменения подразделения
                      </TooltipContent>
                    </UiTooltip>
                  </>
                )}
              </div>
              <select
                value={filterStore.selectedSubdivisionId || ''}
                onChange={e => filterStore.setFilter('subdivision', e.target.value || null)}
                className="w-full px-2 py-1.5 text-[11px] md:text-xs border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 dark:text-white focus:border-indigo-400 dark:focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 dark:focus:ring-indigo-400/20 transition-all duration-200 rounded-md"
                size={6}
                disabled={filterStore.isFilterLocked('subdivision')}
              >
                <option value="">Все</option>
                {filterStore.subdivisions.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            {/* Отдел */}
            <div>
              <div className="flex items-center gap-1 text-[10px] text-slate-500 mb-1">
                <span>Отдел</span>
                {filterStore.isFilterLocked('department') && (
                  <>
                    <Lock className="h-3 w-3 text-slate-400" />
                    <UiTooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3 w-3 text-slate-400 cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="text-xs dark:text-slate-200 leading-tight">
                        Недостаточно прав для изменения отдела
                      </TooltipContent>
                    </UiTooltip>
                  </>
                )}
              </div>
              <select
                value={filterStore.selectedDepartmentId || ''}
                onChange={e => filterStore.setFilter('department', e.target.value || null)}
                className="w-full px-2 py-1.5 text-[11px] md:text-xs border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 dark:text-white focus:border-indigo-400 dark:focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 dark:focus:ring-indigo-400/20 transition-all duration-200 rounded-md"
                size={6}
                disabled={filterStore.isFilterLocked('department')}
              >
                <option value="">Все</option>
                {filterStore.getFilteredDepartments().map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
            {/* Команда */}
            <div>
              <div className="flex items-center gap-1 text-[10px] text-slate-500 mb-1">
                <span>Команда</span>
                {filterStore.isFilterLocked('team') && (
                  <>
                    <Lock className="h-3 w-3 text-slate-400" />
                    <UiTooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3 w-3 text-slate-400 cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="text-xs dark:text-slate-200 leading-tight">
                        Недостаточно прав для изменения команды
                      </TooltipContent>
                    </UiTooltip>
                  </>
                )}
              </div>
              <select
                value={filterStore.selectedTeamId || ''}
                onChange={e => filterStore.setFilter('team', e.target.value || null)}
                className="w-full px-2 py-1.5 text-[11px] md:text-xs border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 dark:text-white focus:border-indigo-400 dark:focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 dark:focus:ring-indigo-400/20 transition-all duration-200 rounded-md"
                size={6}
                disabled={filterStore.isFilterLocked('team')}
              >
                <option value="">Все</option>
                {filterStore.getFilteredTeams().map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
            {/* Сотрудник */}
            <div>
              <div className="text-[10px] text-slate-500 mb-1">Сотрудник</div>
              <select
                value={filterStore.selectedEmployeeId || ''}
                onChange={e => filterStore.setFilter('employee', e.target.value || null)}
                className="w-full px-2 py-1.5 text-[11px] md:text-xs border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 dark:text-white focus:border-indigo-400 dark:focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 dark:focus:ring-indigo-400/20 transition-all duration-200 rounded-md"
                size={6}
              >
                <option value="">Все</option>
                {filterStore.getFilteredEmployees().map(e => (
                  <option key={e.id} value={e.id}>{e.name}</option>
                ))}
              </select>
            </div>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 mx-1" />

      {/* Проектная иерархия */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="inline-flex items-center gap-1 px-2 py-1 border border-transparent text-[11px] md:text-xs hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap transition-all duration-200 ease-in-out rounded-md">
            <FolderOpen className="h-3.5 w-3.5 text-slate-600 dark:text-slate-300" />
            <span className={`transition-all duration-300 ease-in-out overflow-hidden ${isCompactMode ? 'w-0 opacity-0' : 'w-auto opacity-100'}`}>
              Проект
            </span>
            {[filterStore.selectedManagerId, filterStore.selectedProjectId, filterStore.selectedStageId, filterStore.selectedObjectId].some(Boolean) && (
              <span className="ml-1 inline-block w-1.5 h-1.5 bg-emerald-500 rounded-full" />
            )}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-[340px] p-0 dark:bg-slate-800 dark:border-slate-700">
          <div className="p-2 space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-[10px] text-slate-500">Проектная иерархия</div>
            </div>

            {/* Поиск по структуре удалён по требованию */}

            {/* Менеджер */}
            <div>
              <div className="flex items-center gap-1 text-[10px] text-slate-500 mb-1">
                <span>Менеджер</span>
                {filterStore.isFilterLocked('manager') && <Lock className="h-3 w-3 text-slate-400" />}
              </div>
              <select
                value={filterStore.selectedManagerId || ''}
                onChange={e => filterStore.setFilter('manager', e.target.value || null)}
                className="w-full px-2 py-1.5 text-[11px] md:text-xs border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 dark:text-white focus:border-indigo-400 dark:focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 dark:focus:ring-indigo-400/20 transition-all duration-200 rounded-md"
                size={6}
                disabled={filterStore.isFilterLocked('manager')}
              >
                <option value="">Все</option>
                {filterStore.managers.map(m => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
            {/* Проект */}
            <div>
              <div className="text-[10px] text-slate-500 mb-1">Проект</div>
              <select
                value={filterStore.selectedProjectId || ''}
                onChange={e => filterStore.setFilter('project', e.target.value || null)}
                className="w-full px-2 py-1.5 text-[11px] md:text-xs border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 dark:text-white focus:border-indigo-400 dark:focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 dark:focus:ring-indigo-400/20 transition-all duration-200 rounded-md"
                size={6}
              >
                <option value="">Все</option>
                {filterStore.getFilteredProjects()
                  .filter(p => !projectSearch.trim() || p.name.toLowerCase().includes(projectSearch.toLowerCase()))
                  .map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
              </select>
            </div>
            {/* Стадия */}
            <div>
              <div className="text-[10px] text-slate-500 mb-1">Стадия</div>
              <select
                value={filterStore.selectedStageId || ''}
                onChange={e => filterStore.setFilter('stage', e.target.value || null)}
                className="w-full px-2 py-1.5 text-[11px] md:text-xs border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 dark:text-white focus:border-indigo-400 dark:focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 dark:focus:ring-indigo-400/20 transition-all duration-200 rounded-md"
                size={6}
              >
                <option value="">Все</option>
                {filterStore.getFilteredStages().map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            {/* Объект */}
            <div>
              <div className="text-[10px] text-slate-500 mb-1">Объект</div>
              <select
                value={filterStore.selectedObjectId || ''}
                onChange={e => filterStore.setFilter('object', e.target.value || null)}
                className="w-full px-2 py-1.5 text-[11px] md:text-xs border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 dark:text-white focus:border-indigo-400 dark:focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 dark:focus:ring-indigo-400/20 transition-all duration-200 rounded-md"
                size={6}
              >
                <option value="">Все</option>
                {filterStore.getFilteredObjects().map(o => (
                  <option key={o.id} value={o.id}>{o.name}</option>
                ))}
              </select>
            </div>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Сброс фильтров — стиль как в Проектах: перевёрнутая колба + текст */}
      <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 mx-1" />
      <button
        onClick={() => filterStore.resetFilters()}
        className="inline-flex items-center gap-1 px-2 py-1 border border-transparent text-[11px] md:text-xs hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap transition-all duration-200 ease-in-out rounded-md"
        title="Сбросить фильтры"
      >
        <FilterIcon className="h-3.5 w-3.5 rotate-180 text-slate-600 dark:text-slate-300" />
        <span className={`transition-all duration-300 ease-in-out overflow-hidden ${isCompactMode ? 'w-0 opacity-0' : 'w-auto opacity-100'}`}>
          Сбросить фильтры
        </span>
      </button>

      {/* Обновить данные таблицы (фильтры сохраняются) */}
      <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 mx-1" />

      <button
        onClick={async () => {
          if (isAnyLoading) return
          setIsRefreshing(true)
          try {
            // Сохраняем текущее положение прокрутки страницы
            const scrollY = typeof window !== 'undefined' ? window.scrollY : 0

            // Сохраняем раскрытые идентификаторы разделов и отделов
            const stateBefore = usePlanningStore.getState()
            const expandedSectionIds = Object.keys(stateBefore.expandedSections).filter((id) => stateBefore.expandedSections[id])
            const expandedDepartmentIds = Object.keys(stateBefore.expandedDepartments).filter((id) => stateBefore.expandedDepartments[id])

            // Обновляем данные с сохранением текущих фильтров
            await fetchSections()
            if (showDepartments) {
              // Форсируем обновление отпусков (игнорируя кэш)
              await loadVacations(true)
              await fetchDepartments()
            }

             // Форсируем обновление актуальности команд (игнорируя кэш)
            await loadFreshness(true)
            // Детерминированно восстанавливаем раскрытые разделы и отделы (не переворачиваем уже корректные)
            const stateAfter = usePlanningStore.getState()
            expandedSectionIds.forEach((id) => {
              if (!stateAfter.expandedSections[id]) {
                toggleSectionExpanded(id)
              }
            })
            if (showDepartments) {
              expandedDepartmentIds.forEach((id) => {
                if (!stateAfter.expandedDepartments[id]) {
                  toggleDepartmentExpanded(id)
                }
              })
            }

            // Восстанавливаем позицию прокрутки после перерисовки
            if (typeof window !== 'undefined') {
              requestAnimationFrame(() => {
                window.scrollTo({ top: scrollY, behavior: 'auto' })
              })
            }
          } catch (e) {
            console.error('Не удалось обновить данные планирования', e)
          } finally {
            setIsRefreshing(false)
          }
        }}
        className={`inline-flex items-center gap-1 px-2 py-1 border border-transparent text-[11px] md:text-xs hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap transition-all duration-200 ease-in-out rounded-md ${isAnyLoading ? 'opacity-60 cursor-not-allowed' : ''}`}
        title="Обновить данные"
        disabled={isAnyLoading}
        aria-busy={isAnyLoading}
      >
        {isAnyLoading ? (
          <Loader2 className="h-4 w-4 animate-spin text-slate-600 dark:text-slate-300" />
        ) : (
          <RotateCcw className="h-4 w-4 text-slate-600 dark:text-slate-300" />
        )}
        <span className={`transition-all duration-300 ease-in-out overflow-hidden ${isCompactMode ? 'w-0 opacity-0' : 'w-auto opacity-100'}`}>
          Обновить
        </span>
      </button>
    </FilterBar>
    </TooltipProvider>
  )
}


