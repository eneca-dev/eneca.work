"use client"

import { useState, useEffect } from 'react';
import FilterBar from '@/components/filter-bar/FilterBar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Users, Building2, FolderOpen, Filter as FilterIcon, Filter, Building, User, Minimize, Settings } from 'lucide-react';
import { useSectionStatuses } from '@/modules/statuses-tags/statuses/hooks/useSectionStatuses';
// Заменяем старый store на новый из planning модуля
import { useFilterStore } from '@/modules/planning/filters/store';

import { getFiltersPermissionContextAsync } from '@/modules/permissions/integration/filters-permission-context'
import * as Sentry from '@sentry/nextjs'
import { useSearchParams } from 'next/navigation';
import { useProjectsStore } from './store';
// Убираем импорт старых фильтров
// import { ProjectsFilters } from './filters';
import { ProjectsTree } from './components';
import { CreateProjectModal } from './components';
import { useUiStore } from '@/stores/useUiStore';
import { SyncButton } from '@/components/ui/sync-button';
import { Search } from 'lucide-react';
import { Modal, ModalButton } from '@/components/modals';
import { InlineDashboard } from '@/modules/dashboard/InlineDashboard';
import { useTaskTransferStore } from '@/modules/task-transfer/store';
import { useSidebarState } from '@/hooks/useSidebarState';

import { X } from 'lucide-react';

export default function ProjectsPage() {
  const searchParams = useSearchParams();
  const { 
    filters, 
    clearFilters,
    selectedSectionId,
    isDetailsPanelOpen,
    showManagers
  } = useProjectsStore();
  
  // Загружаем данные для task-transfer store (нужно для создания заданий)
  const { loadInitialData } = useTaskTransferStore();

  // GlobalNotification компонент сам управляет уведомлениями

  // Читаем параметры из URL для навигации к комментариям (как fallback)
  const urlSectionId = searchParams.get('section');
  const urlTab = searchParams.get('tab') as 'overview' | 'details' | 'comments' | null;

  // Используем новый store фильтров из planning модуля
  const filterStore = useFilterStore();

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
  // "Только разделы" теперь управляется через событие для дерева
  const { statuses } = useSectionStatuses();
  const [statusSearch, setStatusSearch] = useState('');
  const [selectedStatusIdsLocal, setSelectedStatusIdsLocal] = useState<string[]>([]);
  const filteredStatuses = (statuses || []).filter(s => !statusSearch.trim() || s.name.toLowerCase().includes(statusSearch.toLowerCase()) || (s.description && s.description.toLowerCase().includes(statusSearch.toLowerCase())));

  // Состояние для модального окна дашборда проекта
  const [isDashboardModalOpen, setIsDashboardModalOpen] = useState(false);
  const [dashboardProject, setDashboardProject] = useState<{id: string, name: string} | null>(null);
  const [isCreateProjectOpen, setIsCreateProjectOpen] = useState(false);
  
  // Состояние сайдбара для правильного позиционирования модального окна
  const { collapsed: sidebarCollapsed } = useSidebarState();

  // Состояние для адаптивного отображения текста фильтров
  const [isCompactMode, setIsCompactMode] = useState(false);

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

  // Ленивая инициализация данных организации для проектов
  useEffect(() => {
    if (typeof window === 'undefined') return
    // Применяем ограничения по правам (перезагрузим permissions при отсутствии)
    getFiltersPermissionContextAsync()
      .then((ctx) => {
        filterStore.applyPermissionDefaults(ctx)
      })
      .catch((err) => {
        Sentry.captureException(err)
        console.error('Failed to init filter permissions context', err)
      })
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
    <div className="px-0 pt-0 pb-0">
      {/* Новый липкий FilterBar. Старые фильтры ProjectsFilters оставляем ниже. */}
      <FilterBar 
        title="Проекты"
        titleClassName="hidden min-[1340px]:block min-[1340px]:text-base xl:text-lg"
        right={(
          <div className="ml-auto">
            <button
              className="inline-flex items-center gap-1 px-2 py-1 border border-transparent text-[11px] md:text-xs bg-gradient-to-r from-emerald-500/15 to-teal-500/15 text-emerald-700 dark:text-emerald-300 hover:from-emerald-500/25 hover:to-teal-500/25 transition-all duration-200 rounded-md border-emerald-200/60 dark:border-emerald-500/40"
              onClick={() => setIsCreateProjectOpen(true)}
              title="Создать проект"
            >
              <span className="hidden sm:inline">Создать проект</span>
            </button>
          </div>
        )}
      >
        {/* Инструменты: кнопки управления + поиск по структуре */}
        <div className="flex items-center gap-2 mr-2 text-[11px] md:text-xs">
          {/* Блок кнопок управления — свернуть всё + синхронизация */}
          <div className="flex items-center gap-1.5">
            {/* Переключить группировку по руководителям */}
            <button
              className={`flex items-center justify-center p-1.5 h-7 w-7 transition-all duration-200 rounded-md border ${
                showManagers
                  ? 'bg-gradient-to-br from-blue-500/25 to-cyan-500/25 text-blue-600 dark:text-blue-400 border-blue-200/60 dark:border-blue-500/40'
                  : 'bg-gradient-to-br from-blue-500/15 to-cyan-500/15 text-blue-600 dark:text-blue-400 hover:from-blue-500/25 hover:to-cyan-500/25 hover:shadow-sm border-blue-200/50 dark:border-blue-500/30'
              }`}
              title="Переключить группировку по руководителям"
              onClick={() => { if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('projectsTree:toggleShowManagers')) }}
            >
              <Users className="h-3.5 w-3.5" />
            </button>

            {/* Свернуть всё */}
            <button
              className="flex items-center justify-center p-1.5 h-7 w-7 bg-gradient-to-br from-orange-500/15 to-amber-500/15 text-orange-600 hover:from-orange-500/25 hover:to-amber-500/25 hover:shadow-sm dark:from-orange-500/25 dark:to-amber-500/25 dark:text-orange-400 dark:hover:from-orange-500/35 dark:hover:to-amber-500/35 transition-all duration-200 rounded-md border border-orange-200/50 dark:border-orange-500/30"
              title="Свернуть всё"
              onClick={() => { if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('projectsTree:collapseAll')) }}
            >
              <Minimize className="h-3.5 w-3.5" />
            </button>

            {/* Синхронизация с Worksection — перенесена в выпадающий список "Проект" */}
          </div>

          {/* Поиск по структуре — рядом с кнопками */}
          <div className="relative text-[11px] md:text-xs">
            <input
              type="text"
              value={treeSearch}
              onChange={e => setTreeSearch(e.target.value)}
              placeholder="Поиск по структуре..."
              className="pl-7 pr-2 py-1 text-[11px] md:text-xs border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 dark:text-white w-40 md:w-48 focus:border-indigo-400 dark:focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 dark:focus:ring-indigo-400/20 transition-all duration-200 rounded-md"
            />
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          </div>
        </div>

        <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 mx-1" />

        {/* Организация: Department → Team → Employee */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="inline-flex items-center gap-1 px-2 py-1 border border-transparent text-[11px] md:text-xs hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap transition-all duration-200 ease-in-out rounded-md"
              title={(() => {
                const d = filterStore.selectedDepartmentId ? filterStore.departments.find(d=>d.id===filterStore.selectedDepartmentId)?.name : ''
                const t = filterStore.selectedTeamId ? filterStore.teams.find(t=>t.id===filterStore.selectedTeamId)?.name : ''
                const e = filterStore.selectedEmployeeId ? filterStore.employees.find(e=>e.id===filterStore.selectedEmployeeId)?.name : ''
                return [d,t,e].filter(Boolean).join(' › ')
              })()}
            >
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
                <div className="text-[10px] text-slate-500 mb-1">Отдел</div>
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
                <div className="text-[10px] text-slate-500 mb-1">Команда</div>
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

        {/* Статусы — дропдаун в том же стиле */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="inline-flex items-center gap-1 px-2 py-1 border border-transparent text-[11px] md:text-xs hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap transition-all duration-200 ease-in-out rounded-md">
              <Filter className="h-3.5 w-3.5 text-slate-600 dark:text-slate-300" />
              <span className={`transition-all duration-300 ease-in-out overflow-hidden ${isCompactMode ? 'w-0 opacity-0' : 'w-auto opacity-100'}`}>
                Статусы
              </span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-[320px] p-0">
            <div className="p-2 space-y-2">
              <div className="text-[10px] text-slate-500 mb-1">Фильтр по статусам</div>
              <input
                type="text"
                placeholder="Поиск статусов..."
                className="w-full px-2 py-1.5 text-[11px] md:text-xs border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 dark:text-white focus:border-indigo-400 dark:focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 dark:focus:ring-indigo-400/20 transition-all duration-200 rounded-md"
                value={statusSearch}
                onChange={(e)=> setStatusSearch(e.target.value)}
              />
              <div className="flex items-center justify-between">
                <button
                  className="text-[11px] md:text-xs px-2 py-1 bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-700 border border-slate-300 dark:border-slate-600 hover:from-slate-100 hover:to-slate-200 dark:hover:from-slate-700 dark:hover:to-slate-600 transition-all duration-200 rounded-md"
                  onClick={()=> setSelectedStatusIdsLocal([])}
                >
                  Очистить
                </button>
                <button
                  className="text-[11px] md:text-xs px-2 py-1 bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-700 border border-slate-300 dark:border-slate-600 hover:from-slate-100 hover:to-slate-200 dark:hover:from-slate-700 dark:hover:to-slate-600 inline-flex items-center gap-1 transition-all duration-200 rounded-md"
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
                  <label key={s.id} className="flex items-center gap-3 px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer transition-colors duration-200">
                    <input
                      type="checkbox"
                      className="border-gray-300 dark:border-slate-500 text-teal-600 focus:ring-teal-500 focus:ring-2"
                      checked={selectedStatusIdsLocal.includes(s.id)}
                      onChange={() => setSelectedStatusIdsLocal(prev => prev.includes(s.id) ? prev.filter(id => id !== s.id) : [...prev, s.id])}
                    />
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

        {/* Проектная иерархия: Manager → Project → Stage → Object + Поиск по структуре */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="inline-flex items-center gap-1 px-2 py-1 border border-transparent text-[11px] md:text-xs hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap transition-all duration-200 ease-in-out rounded-md"
              title={(() => {
                const m = filterStore.selectedManagerId ? filterStore.managers.find(m=>m.id===filterStore.selectedManagerId)?.name : ''
                const p = filterStore.selectedProjectId ? filterStore.projects.find(p=>p.id===filterStore.selectedProjectId)?.name : ''
                const s = filterStore.selectedStageId ? filterStore.stages.find(s=>s.id===filterStore.selectedStageId)?.name : ''
                const o = filterStore.selectedObjectId ? filterStore.objects.find(o=>o.id===filterStore.selectedObjectId)?.name : ''
                return [m,p,s,o].filter(Boolean).join(' › ')
              })()}
            >
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
              {/* Панель инструментов: синхронизация + поиск по структуре */}
              <div className="flex items-center justify-between">
                <div className="text-[10px] text-slate-500">Проектная иерархия</div>
                <div className="flex items-center gap-1">
                  {/* Синхронизация с Worksection */}
                  <SyncButton 
                    className="h-6 px-2 py-1"
                    size="sm"
                    showText={false}
                  />
                  <button
                    className="text-[10px] px-2 py-1 bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-700 border border-slate-300 dark:border-slate-600 hover:from-slate-100 hover:to-slate-200 dark:hover:from-slate-700 dark:hover:to-slate-600 transition-all duration-200 rounded-md"
                    onClick={() => {
                      if (typeof window !== 'undefined') {
                        window.dispatchEvent(new CustomEvent('projectsTree:openProjectManagement'))
                      }
                    }}
                  >
                    <Settings className="h-3 w-3" />
                  </button>
                </div>
              </div>

              {/* Поиск по структуре */}
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
                <div className="text-[10px] text-slate-500 mb-1">Менеджер</div>
                <select
                  value={filterStore.selectedManagerId || ''}
                  onChange={e => filterStore.setFilter('manager', e.target.value || null)}
                  className="w-full px-2 py-1.5 text-[11px] md:text-xs border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 dark:text-white focus:border-indigo-400 dark:focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 dark:focus:ring-indigo-400/20 transition-all duration-200 rounded-md"
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
                <select
                  value={filterStore.selectedProjectId || ''}
                  onChange={e => filterStore.setFilter('project', e.target.value || null)}
                  className="w-full px-2 py-1.5 text-[11px] md:text-xs border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 dark:text-white focus:border-indigo-400 dark:focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 dark:focus:ring-indigo-400/20 transition-all duration-200 rounded-md"
                  size={6}
                >
                  <option value="">Все</option>
                  {filterStore.getFilteredProjects().map(p => (
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

        <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 mx-1" />

        <button
          onClick={handleResetFilters}
          className="inline-flex items-center gap-1 px-2 py-1 border border-transparent text-[11px] md:text-xs hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap transition-all duration-200 ease-in-out rounded-md"
        >
          <FilterIcon className="h-3.5 w-3.5 rotate-180 text-slate-600 dark:text-slate-300" />
          <span className={`transition-all duration-300 ease-in-out overflow-hidden ${isCompactMode ? 'w-0 opacity-0' : 'w-auto opacity-100'}`}>
            Сбросить
          </span>
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
      {isDashboardModalOpen && (
        <div 
          className="fixed inset-y-0 z-50 flex bg-black bg-opacity-50 transition-all duration-300"
          style={{
            left: sidebarCollapsed ? '80px' : '256px',
            right: '8px',
            width: sidebarCollapsed ? 'calc(100vw - 88px)' : 'calc(100vw - 264px)'
          }}
          onClick={handleCloseDashboardModal}
        >
          <div 
            className="w-full h-full bg-gray-50 dark:bg-gray-900 flex"
            onClick={(e) => e.stopPropagation()}
          >
            {dashboardProject && (
              <div className="flex-1 h-full">
                <InlineDashboard 
                  projectId={dashboardProject.id}
                  isClosing={false}
                  onClose={handleCloseDashboardModal}
                  isModal={true}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Модальное окно создания проекта */}
      {isCreateProjectOpen && (
        <CreateProjectModal
          isOpen={isCreateProjectOpen}
          onClose={() => setIsCreateProjectOpen(false)}
          onSuccess={() => {
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('projectsTree:reload'))
            }
          }}
        />
      )}
    </div>
  );
} 