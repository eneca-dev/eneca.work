"use client"

import { useState, useEffect } from 'react';
import FilterBar from '@/components/filter-bar/FilterBar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Users, Building2, FolderOpen, Filter as FilterIcon, Filter, Building, User, List, Expand, Minimize, Settings } from 'lucide-react';
import { useSectionStatuses } from '@/modules/statuses-tags/statuses/hooks/useSectionStatuses';
import { useFilterStore } from '@/modules/projects/filters/store';
import { useSearchParams } from 'next/navigation';
import { useProjectsStore } from './store';
import { ProjectsFilters } from './filters';
import { ProjectsTree } from './components';
import { useUiStore } from '@/stores/useUiStore';
import { SyncButton } from '@/components/ui/sync-button';
import { Search } from 'lucide-react';
import { Modal, ModalButton } from '@/components/modals';
import { InlineDashboard } from '@/modules/dashboard/InlineDashboard';
import { useTaskTransferStore } from '@/modules/task-transfer/store';

import { X } from 'lucide-react';

export default function ProjectsPage() {
  const searchParams = useSearchParams();
  const { 
    filters, 
    clearFilters,
    selectedSectionId,
    isDetailsPanelOpen 
  } = useProjectsStore();
  
  // Загружаем данные для task-transfer store (нужно для создания заданий)
  const { loadInitialData } = useTaskTransferStore();

  // GlobalNotification компонент сам управляет уведомлениями

  // Читаем параметры из URL для навигации к комментариям (как fallback)
  const urlSectionId = searchParams.get('section');
  const urlTab = searchParams.get('tab') as 'overview' | 'details' | 'comments' | null;

  // Состояние фильтров для передачи в дерево
  const [selectedManagerId, setSelectedManagerId] = useState<string | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedStageId, setSelectedStageId] = useState<string | null>(null);
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string | null>(null);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [projectSearch, setProjectSearch] = useState<string>('');
  const [treeSearch, setTreeSearch] = useState<string>('');
  const [showOnlySections, setShowOnlySections] = useState(false);
  const { statuses } = useSectionStatuses();
  const [statusSearch, setStatusSearch] = useState('');
  const [selectedStatusIdsLocal, setSelectedStatusIdsLocal] = useState<string[]>([]);
  const filteredStatuses = (statuses || []).filter(s => !statusSearch.trim() || s.name.toLowerCase().includes(statusSearch.toLowerCase()) || (s.description && s.description.toLowerCase().includes(statusSearch.toLowerCase())));

  // Состояние для модального окна дашборда проекта
  const [isDashboardModalOpen, setIsDashboardModalOpen] = useState(false);
  const [dashboardProject, setDashboardProject] = useState<{id: string, name: string} | null>(null);

  // Обработчики фильтров
  const handleProjectChange = (projectId: string | null) => {
    setSelectedProjectId(projectId);
  };

  const handleDepartmentChange = (departmentId: string | null) => {
    setSelectedDepartmentId(departmentId);
  };

  const handleTeamChange = (teamId: string | null) => {
    setSelectedTeamId(teamId);
  };

  const handleEmployeeChange = (employeeId: string | null) => {
    setSelectedEmployeeId(employeeId);
  };

  const handleManagerChange = (managerId: string | null) => {
    setSelectedManagerId(managerId);
  };

  const handleStageChange = (stageId: string | null) => {
    setSelectedStageId(stageId);
  };

  const handleObjectChange = (objectId: string | null) => {
    setSelectedObjectId(objectId);
  };

  const handleResetFilters = () => {
    // Сбрасываем фильтры проекта (менеджер/проект/стадия/объект + организация)
    filterStore.resetFilters()
    // Очищаем локальный поиск по проектам
    setProjectSearch('')
  };

  // Обработчик открытия дашборда проекта
  const handleOpenProjectDashboard = (project: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setDashboardProject({ id: project.id, name: project.name });
    setIsDashboardModalOpen(true);
  };

  // Обработчик закрытия модального окна
  const handleCloseDashboardModal = () => {
    setIsDashboardModalOpen(false);
    setDashboardProject(null);
  };

  // Проектный стор фильтров (независимый от отчётов)
  const filterStore = useFilterStore();

  // Ленивая инициализация данных организации для проектов
  useEffect(() => {
    if (typeof window === 'undefined') return
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
      filterStore.loadProjects(filterStore.selectedManagerId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterStore.managers.length, filterStore.departments.length, filterStore.employees.length, filterStore.projects.length, filterStore.selectedManagerId])

  // Синхронизация локальных значений с проектным стором (для совместимости со старыми фильтрами ниже)
  useEffect(() => {
    if (selectedDepartmentId !== filterStore.selectedDepartmentId) {
      setSelectedDepartmentId(filterStore.selectedDepartmentId || null)
    }
    if (selectedTeamId !== filterStore.selectedTeamId) {
      setSelectedTeamId(filterStore.selectedTeamId || null)
    }
    if (selectedEmployeeId !== filterStore.selectedEmployeeId) {
      setSelectedEmployeeId(filterStore.selectedEmployeeId || null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterStore.selectedDepartmentId, filterStore.selectedTeamId, filterStore.selectedEmployeeId])

  // Синхронизация проектной иерархии с проектным стором (для совместимости)
  useEffect(() => {
    if (selectedProjectId !== filterStore.selectedProjectId) {
      setSelectedProjectId(filterStore.selectedProjectId || null)
    }
    if (selectedStageId !== filterStore.selectedStageId) {
      setSelectedStageId(filterStore.selectedStageId || null)
    }
    if (selectedObjectId !== filterStore.selectedObjectId) {
      setSelectedObjectId(filterStore.selectedObjectId || null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterStore.selectedProjectId, filterStore.selectedStageId, filterStore.selectedObjectId])

  // Загружаем данные для task-transfer store (для создания заданий)
  useEffect(() => {
    if (typeof window === 'undefined') return
    loadInitialData()
  }, [loadInitialData])

  return (
    <div className="px-0 pt-0 pb-0">
      {/* Новый липкий FilterBar. Старые фильтры ProjectsFilters оставляем ниже. */}
      <FilterBar 
        title="Проекты"
        titleClassName="hidden min-[1340px]:block min-[1340px]:text-base xl:text-lg"
        bottom={
          <div className="hidden max-[1339px]:flex w-full justify-center">
            {/* Блок управления — во вторую строку на ширине <1100px */}
            <div className="flex items-center gap-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white/70 dark:bg-slate-900/50 px-1 py-1 h-12">
              {/* Группировка по заказчикам */}
              <button
                className="flex items-center justify-center p-2 rounded-md h-8 w-8 bg-indigo-500/10 text-indigo-600 hover:bg-indigo-500/20 dark:bg-indigo-500/20 dark:text-indigo-400 dark:hover:bg-indigo-500/30"
                title="Группировать по заказчикам"
                onClick={() => {
                  if (typeof window !== 'undefined') {
                    window.dispatchEvent(new CustomEvent('projectsTree:toggleGroupByClient'))
                  }
                }}
              >
                <Building size={14} />
              </button>
              {/* Показать/скрыть руководителей */}
              <button
                className="flex items-center justify-center p-2 rounded-md h-8 w-8 bg-blue-500/10 text-blue-600 hover:bg-blue-500/20 dark:bg-blue-500/20 dark:text-blue-400 dark:hover:bg-blue-500/30"
                title="Показать/скрыть руководителей"
                onClick={() => {
                  if (typeof window !== 'undefined') {
                    window.dispatchEvent(new CustomEvent('projectsTree:toggleShowManagers'))
                  }
                }}
              >
                <User size={14} />
              </button>
              {/* Только разделы */}
              <button
                className="flex items-center justify-center p-2 rounded-md h-8 w-8 bg-purple-500/10 text-purple-600 hover:bg-purple-500/20 dark:bg-purple-500/20 dark:text-purple-400 dark:hover:bg-purple-500/30"
                title="Только разделы"
                onClick={() => setShowOnlySections(v => !v)}
              >
                <List size={14} />
              </button>
              {/* Развернуть/свернуть */}
              <button
                className="flex items-center justify-center p-2 rounded-md h-8 w-8 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 dark:bg-emerald-500/20 dark:text-emerald-400 dark:hover:bg-emerald-500/30"
                title="Развернуть все"
                onClick={() => { if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('projectsTree:expandAll')) }}
              >
                <Expand size={14} />
              </button>
              <button
                className="flex items-center justify-center p-2 rounded-md h-8 w-8 bg-orange-500/10 text-orange-600 hover:bg-orange-500/20 dark:bg-orange-500/20 dark:text-orange-400 dark:hover:bg-orange-500/30"
                title="Свернуть все"
                onClick={() => { if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('projectsTree:collapseAll')) }}
              >
                <Minimize size={14} />
              </button>
            </div>
          </div>
        }
      >
        {/* Инструменты: кнопки управления + поиск по структуре */}
        <div className="flex items-center gap-2 mr-2 text-[11px] md:text-xs">
          {/* Блок кнопок управления — показываем только при ширине >= 1100px */}
          <div className="hidden min-[1340px]:flex items-center gap-2">
            {/* Группировка по заказчикам */}
            <button
              className="flex items-center justify-center p-2 rounded-md h-8 w-8 bg-indigo-500/10 text-indigo-600 hover:bg-indigo-500/20 dark:bg-indigo-500/20 dark:text-indigo-400 dark:hover:bg-indigo-500/30"
              title="Группировать по заказчикам"
              onClick={() => {
                if (typeof window !== 'undefined') {
                  window.dispatchEvent(new CustomEvent('projectsTree:toggleGroupByClient'))
                }
              }}
            >
              <Building size={14} />
            </button>
            {/* Показать/скрыть руководителей */}
            <button
              className="flex items-center justify-center p-2 rounded-md h-8 w-8 bg-blue-500/10 text-blue-600 hover:bg-blue-500/20 dark:bg-blue-500/20 dark:text-blue-400 dark:hover:bg-blue-500/30"
              title="Показать/скрыть руководителей"
              onClick={() => {
                if (typeof window !== 'undefined') {
                  window.dispatchEvent(new CustomEvent('projectsTree:toggleShowManagers'))
                }
              }}
            >
              <User size={14} />
            </button>
            {/* Только разделы */}
            <button
              className="flex items-center justify-center p-2 rounded-md h-8 w-8 bg-purple-500/10 text-purple-600 hover:bg-purple-500/20 dark:bg-purple-500/20 dark:text-purple-400 dark:hover:bg-purple-500/30"
              title="Только разделы"
              onClick={() => setShowOnlySections(v => !v)}
            >
              <List size={14} />
            </button>
            {/* Развернуть/свернуть */}
            <button
              className="flex items-center justify-center p-2 rounded-md h-8 w-8 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 dark:bg-emerald-500/20 dark:text-emerald-400 dark:hover:bg-emerald-500/30"
              title="Развернуть все"
              onClick={() => { if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('projectsTree:expandAll')) }}
            >
              <Expand size={14} />
            </button>
            <button
              className="flex items-center justify-center p-2 rounded-md h-8 w-8 bg-orange-500/10 text-orange-600 hover:bg-orange-500/20 dark:bg-orange-500/20 dark:text-orange-400 dark:hover:bg-orange-500/30"
              title="Свернуть все"
              onClick={() => { if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('projectsTree:collapseAll')) }}
            >
              <Minimize size={14} />
            </button>
          </div>
          {/* Поиск по структуре — справа от кнопок управления, перед фильтрами */}
          <div className="relative text-[11px] md:text-xs">
            <input
              type="text"
              value={treeSearch}
              onChange={e => setTreeSearch(e.target.value)}
              placeholder="Поиск по структуре..."
              className="pl-8 pr-2 py-1.5 text-[11px] md:text-xs border border-slate-300 dark:border-slate-700 rounded-md dark:bg-slate-900 dark:text-white w-48 md:w-56"
            />
            <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
          </div>
        </div>
        {/* Организация — отдельная логика для модуля Проекты */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-transparent text-[11px] md:text-xs hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap"
              title={(() => {
                const d = filterStore.selectedDepartmentId ? filterStore.departments.find(d=>d.id===filterStore.selectedDepartmentId)?.name : ''
                const t = filterStore.selectedTeamId ? filterStore.teams.find(x=>x.id===filterStore.selectedTeamId)?.name : ''
                const e = filterStore.selectedEmployeeId ? filterStore.employees.find(x=>x.id===filterStore.selectedEmployeeId)?.name : ''
                return [d,t,e].filter(Boolean).join(' › ')
              })()}
            >
              <Building2 className="h-4 w-4" /> Организация
              {[filterStore.selectedDepartmentId, filterStore.selectedTeamId, filterStore.selectedEmployeeId].some(Boolean) && (
                <span className="ml-1 inline-block w-1.5 h-1.5 rounded-full bg-emerald-500" />
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-[280px] p-0">
            <div className="p-2 space-y-2">
              {/* Отдел */}
              <div>
                <div className="text-[10px] text-slate-500 mb-1">Отдел</div>
                <select
                  value={filterStore.selectedDepartmentId || ''}
                  onChange={e => filterStore.setFilter('department', e.target.value || null)}
                  className="w-full px-2 py-1.5 text-[11px] md:text-xs border border-slate-300 dark:border-slate-700 rounded-md dark:bg-slate-900 dark:text-white"
                  size={6}
                >
                  <option value="">Все</option>
                  {filterStore.departments.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
              {/* Команда */}
              <div>
                <div className="text-[10px] text-slate-500 mb-1">Команда</div>
                <select
                  value={filterStore.selectedTeamId || ''}
                  onChange={e => filterStore.setFilter('team', e.target.value || null)}
                  className="w-full px-2 py-1.5 text-[11px] md:text-xs border border-slate-300 dark:border-slate-700 rounded-md dark:bg-slate-900 dark:text-white"
                  size={6}
                >
                  <option value="">Все</option>
                  {filterStore.teams.filter(t => !filterStore.selectedDepartmentId || t.departmentId === filterStore.selectedDepartmentId).map(t => (
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
                  className="w-full px-2 py-1.5 text-[11px] md:text-xs border border-slate-300 dark:border-slate-700 rounded-md dark:bg-slate-900 dark:text-white"
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

        {/* Статусы — дропдаун в том же стиле */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-transparent text-[11px] md:text-xs hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap">
              <Filter className="h-4 w-4" /> Статусы
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-[320px] p-0">
            <div className="p-2 space-y-2">
              <div className="text-[10px] text-slate-500 mb-1">Фильтр по статусам</div>
              <input
                type="text"
                placeholder="Поиск статусов..."
                className="w-full px-2 py-1.5 text-[11px] md:text-xs border border-slate-300 dark:border-slate-700 rounded-md dark:bg-slate-900 dark:text-white"
                value={statusSearch}
                onChange={(e)=> setStatusSearch(e.target.value)}
              />
              <div className="flex items-center justify-between">
                <button
                  className="text-[11px] md:text-xs px-2 py-1 rounded border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
                  onClick={()=> setSelectedStatusIdsLocal([])}
                >
                  Очистить
                </button>
                <button
                  className="text-[11px] md:text-xs px-2 py-1 rounded border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 inline-flex items-center gap-1"
                  onClick={()=> {
                    if (typeof window !== 'undefined') {
                      window.dispatchEvent(new CustomEvent('projectsTree:openStatusManagement'))
                    }
                  }}
                >
                  <Settings className="h-3 w-3" /> Управление
                </button>
              </div>
              {/* Список статусов */}
              <div className="max-h-64 overflow-auto space-y-1">
                {filteredStatuses.map(s => (
                  <label key={s.id} className="flex items-center gap-3 px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded cursor-pointer">
                    <input
                      type="checkbox"
                      className="rounded border-gray-300 dark:border-slate-500 text-teal-600 focus:ring-teal-500 focus:ring-2"
                      checked={selectedStatusIdsLocal.includes(s.id)}
                      onChange={() => setSelectedStatusIdsLocal(prev => prev.includes(s.id) ? prev.filter(id => id !== s.id) : [...prev, s.id])}
                    />
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: s.color }} />
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

        {/* Проектная иерархия: Manager → Project → Stage → Object + Поиск по структуре */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-transparent text-[11px] md:text-xs hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap"
              title={(() => {
                const m = filterStore.selectedManagerId ? filterStore.managers.find(m=>m.id===filterStore.selectedManagerId)?.name : ''
                const p = filterStore.selectedProjectId ? filterStore.projects.find(p=>p.id===filterStore.selectedProjectId)?.name : ''
                const s = filterStore.selectedStageId ? filterStore.stages.find(s=>s.id===filterStore.selectedStageId)?.name : ''
                const o = filterStore.selectedObjectId ? filterStore.objects.find(o=>o.id===filterStore.selectedObjectId)?.name : ''
                return [m,p,s,o].filter(Boolean).join(' › ')
              })()}
            >
              <FolderOpen className="h-4 w-4" /> Проект
              {[filterStore.selectedManagerId, filterStore.selectedProjectId, filterStore.selectedStageId, filterStore.selectedObjectId].some(Boolean) && (
                <span className="ml-1 inline-block w-1.5 h-1.5 rounded-full bg-emerald-500" />
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-[340px] p-0">
            <div className="p-2 space-y-2">
              {/* Панель инструментов: синхронизация + поиск по структуре */}
              <div className="flex items-center gap-2">
                <SyncButton size="md" showText={false} theme="dark" />
                <input
                  type="text"
                  value={treeSearch}
                  onChange={e => setTreeSearch(e.target.value)}
                  placeholder="Поиск по структуре..."
                  className="flex-1 px-2 py-1.5 text-[11px] md:text-xs border border-slate-300 dark:border-slate-700 rounded-md dark:bg-slate-900 dark:text-white"
                />
              </div>

              {/* Менеджер */}
              <div>
                <div className="text-[10px] text-slate-500 mb-1">Руководитель проекта</div>
                <select
                  value={filterStore.selectedManagerId || ''}
                  onChange={e => filterStore.setFilter('manager', e.target.value || null)}
                  className="w-full px-2 py-1.5 text-[11px] md:text-xs border border-slate-300 dark:border-slate-700 rounded-md dark:bg-slate-900 dark:text-white"
                  size={6}
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
                <input
                  type="text"
                  value={projectSearch}
                  onChange={e => setProjectSearch(e.target.value)}
                  placeholder="Поиск..."
                  className="mb-2 w-full px-2 py-1.5 text-[11px] md:text-xs border border-slate-300 dark:border-slate-700 rounded-md dark:bg-slate-900 dark:text-white"
                />
                <select
                  value={filterStore.selectedProjectId || ''}
                  onChange={e => filterStore.setFilter('project', e.target.value || null)}
                  className="w-full px-2 py-1.5 text-[11px] md:text-xs border border-slate-300 dark:border-slate-700 rounded-md dark:bg-slate-900 dark:text-white"
                  size={6}
                >
                  <option value="">Все</option>
                  {filterStore
                    .getFilteredProjects()
                    .filter(p => !projectSearch || p.name.toLowerCase().includes(projectSearch.toLowerCase()))
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
                  className="w-full px-2 py-1.5 text-[11px] md:text-xs border border-slate-300 dark:border-slate-700 rounded-md dark:bg-slate-900 dark:text-white"
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
                  className="w-full px-2 py-1.5 text-[11px] md:text-xs border border-slate-300 dark:border-slate-700 rounded-md dark:bg-slate-900 dark:text-white"
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

        <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 mx-1" />

        <button
          onClick={handleResetFilters}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-transparent text-[11px] md:text-xs hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap"
        >
          <FilterIcon className="h-4 w-4 rotate-180" /> Сбросить
        </button>
      </FilterBar>

      {/* Нижняя панель инструментов удалена — инструменты перенесены в верхний дропдаун */}

      <div className="p-0">
        <ProjectsTree
          selectedManagerId={filterStore.selectedManagerId}
          selectedProjectId={filterStore.selectedProjectId}
          selectedStageId={filterStore.selectedStageId}
          selectedObjectId={filterStore.selectedObjectId}
          selectedDepartmentId={filterStore.selectedDepartmentId}
          selectedTeamId={filterStore.selectedTeamId}
          selectedEmployeeId={filterStore.selectedEmployeeId}
          selectedStatusIds={selectedStatusIdsLocal}
          externalSearchQuery={treeSearch}
          urlSectionId={urlSectionId}
          urlTab={urlTab || 'overview'}
          onOpenProjectDashboard={handleOpenProjectDashboard}
        />
      </div>

      {/* Модальное окно с дашбордом проекта */}
      <Modal 
        isOpen={isDashboardModalOpen} 
        onClose={handleCloseDashboardModal} 
        size="xl"
      >
        <Modal.Header 
          title={`Дашборд проекта: ${dashboardProject?.name || ''}`}
          subtitle="Детальная информация о проекте"
        />
        <Modal.Body className="p-4">
          {dashboardProject && (
            <div className="h-[80vh] overflow-auto">
              <InlineDashboard 
                projectId={dashboardProject.id}
                isClosing={false}
                onClose={handleCloseDashboardModal}
                isModal={true}
              />
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <ModalButton variant="cancel" onClick={handleCloseDashboardModal}>
            Закрыть
          </ModalButton>
        </Modal.Footer>
      </Modal>
    </div>
  );
} 