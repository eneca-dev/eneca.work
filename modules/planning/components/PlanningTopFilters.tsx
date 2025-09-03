"use client"

import { useEffect, useMemo, useState } from 'react'
import FilterBar from '@/components/filter-bar/FilterBar'
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Building, Filter as FilterIcon, FolderOpen, Search, Settings, Calendar as CalendarIcon, ChevronLeft, ChevronRight, Eye, EyeOff, Columns3, ChevronsDown, ChevronsUp, RotateCcw, Lock, Network, Layers } from 'lucide-react'
import { useSectionStatuses } from '@/modules/statuses-tags/statuses/hooks/useSectionStatuses'
import { useFilterStore } from '@/modules/planning/filters/store'

import { usePlanningViewStore } from '@/modules/planning/stores/usePlanningViewStore'
import { usePlanningStore } from '@/modules/planning/stores/usePlanningStore'
import { Button } from '@/components/ui/button'
import { applyPlanningLocks } from '@/modules/planning/integration/apply-planning-locks'

export default function PlanningTopFilters() {
  const filterStore = useFilterStore()
  const { statuses } = useSectionStatuses()
  const { startDate, daysToShow, setStartDate, scrollBackward, scrollForward } = usePlanningViewStore()
  const {
    showSections,
    showDepartments,
    toggleShowSections,
    toggleShowDepartments,
    expandAllDepartments,
    collapseAllDepartments,
  } = usePlanningStore()

  const [isCompactMode, setIsCompactMode] = useState(false)
  const [statusSearch, setStatusSearch] = useState('')
  const [projectSearch, setProjectSearch] = useState('')

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
  }, [
    filterStore.managers.length,
    filterStore.departments.length,
    filterStore.employees.length,
    filterStore.projects.length,
    filterStore.selectedManagerId,
    filterStore.loadManagers,
    filterStore.loadDepartments,
    filterStore.loadEmployees,
    filterStore.loadProjects,
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

  const rangeChip = useMemo(() => {
    const start = new Date(startDate)
    const end = new Date(startDate)
    end.setDate(end.getDate() + Math.max(daysToShow - 1, 0))
    const fmt = (d: Date) => d.toLocaleDateString()
    return `${fmt(start)} — ${fmt(end)}`
  }, [startDate, daysToShow])

  const goToday = () => {
    const d = new Date()
    d.setDate(d.getDate() - 30)
    setStartDate(d)
  }

  return (
    <FilterBar title="Планирование" titleClassName="hidden min-[1340px]:block min-[1340px]:text-base xl:text-lg" right={(
      <div className="flex items-center gap-1">
        <span className="hidden sm:inline-flex items-center gap-1 px-2 py-1 text-[10px] md:text-xs rounded-full border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800" title="Текущий диапазон">
          <CalendarIcon className="h-3.5 w-3.5" /> {rangeChip}
        </span>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => scrollBackward(14)} title="Назад на 2 недели">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => scrollForward(14)} title="Вперёд на 2 недели">
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
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => window.dispatchEvent(new CustomEvent('planning:toggleProjectColumn'))} title="Показать/скрыть колонку Проект">
          <Columns3 className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={expandAllDepartments} title="Развернуть все">
          <ChevronsDown className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={collapseAllDepartments} title="Свернуть все">
          <ChevronsUp className="h-4 w-4" />
        </Button>
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
            {[filterStore.selectedDepartmentId, filterStore.selectedTeamId, filterStore.selectedEmployeeId].some(Boolean) && (
              <span className="ml-1 inline-block w-1.5 h-1.5 bg-emerald-500 rounded-full" />
            )}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-[320px] p-0">
          <div className="p-2 space-y-2">
            {/* Отдел */}
            <div>
              <div className="flex items-center gap-1 text-[10px] text-slate-500 mb-1">
                <span>Отдел</span>
                {filterStore.isFilterLocked('department') && <Lock className="h-3 w-3 text-slate-400" />}
              </div>
              <select
                value={filterStore.selectedDepartmentId || ''}
                onChange={e => filterStore.setFilter('department', e.target.value || null)}
                className="w-full px-2 py-1.5 text-[11px] md:text-xs border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 dark:text-white focus:border-indigo-400 dark:focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 dark:focus:ring-indigo-400/20 transition-all duration-200 rounded-md"
                size={6}
                disabled={filterStore.isFilterLocked('department')}
              >
                <option value="">Все</option>
                {filterStore.departments.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
            {/* Команда */}
            <div>
              <div className="flex items-center gap-1 text-[10px] text-slate-500 mb-1">
                <span>Команда</span>
                {filterStore.isFilterLocked('team') && <Lock className="h-3 w-3 text-slate-400" />}
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

      {/* Статусы */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="inline-flex items-center gap-1 px-2 py-1 border border-transparent text-[11px] md:text-xs hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap transition-all duration-200 ease-in-out rounded-md">
            <FilterIcon className="h-3.5 w-3.5 text-slate-600 dark:text-slate-300" />
            <span className={`transition-all duration-300 ease-in-out overflow-hidden ${isCompactMode ? 'w-0 opacity-0' : 'w-auto opacity-100'}`}>
              Статусы
            </span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-[320px] p-0">
          <div className="p-2 space-y-2">
            <div className="text-[10px] text-slate-500 mb-1">Фильтр по статусам</div>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Поиск статусов..."
                className="w-full pl-7 pr-2 py-1 text-[11px] md:text-xs border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 dark:text-white focus:border-indigo-400 dark:focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 dark:focus:ring-indigo-400/20 transition-all duration-200 rounded-md"
                value={statusSearch}
                onChange={(e)=> setStatusSearch(e.target.value)}
              />
            </div>
            <div className="max-h-64 overflow-auto space-y-1">
              {filteredStatuses.map(s => (
                <label key={s.id} className="flex items-center gap-3 px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer transition-colors duration-200">
                  <input type="checkbox" className="border-gray-300 dark:border-slate-500 text-teal-600 focus:ring-teal-500 focus:ring-2" />
                  <div className="w-3 h-3" style={{ backgroundColor: s.color }} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium dark:text-white truncate">{s.name}</div>
                    {s.description && <div className="text-xs text-gray-500 dark:text-slate-400 truncate">{s.description}</div>}
                  </div>
                </label>
              ))}
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
        <DropdownMenuContent align="start" className="w-[340px] p-0">
          <div className="p-2 space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-[10px] text-slate-500">Проектная иерархия</div>
              <button
                className="text-[10px] px-2 py-1 bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-700 border border-slate-300 dark:border-slate-600 hover:from-slate-100 hover:to-slate-200 dark:hover:from-slate-700 dark:hover:to-slate-600 transition-all duration-200 rounded-md"
                onClick={() => { if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('planning:openProjectManagement')) }}
              >
                <Settings className="h-3 w-3" />
              </button>
            </div>

            {/* Поиск по структуре (локально фильтруем список опций проектов) */}
            <div className="relative">
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3 w-3 text-slate-400" />
              <input
                type="text"
                placeholder="Поиск по структуре..."
                value={projectSearch}
                onChange={(e) => setProjectSearch(e.target.value)}
                className="w-full pl-7 pr-2 py-1.5 text-[11px] md:text-xs border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 dark:text-white focus:border-indigo-400 dark:focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 dark:focus:ring-indigo-400/20 transition-all duration-200 rounded-md"
              />
            </div>

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

      {/* Сброс фильтров — кнопка рядом с блоком фильтров */}
      <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 mx-1" />
      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => filterStore.resetFilters()} title="Сбросить фильтры">
        <RotateCcw className="h-4 w-4" />
      </Button>
    </FilterBar>
  )
}


