"use client"

import { useState, useEffect } from 'react';
import FilterBar from '@/components/filter-bar/FilterBar';
import { PROJECT_STATUS_OPTIONS, getProjectStatusLabel, getProjectStatusBadgeClasses, normalizeProjectStatus } from '@/modules/projects/constants/project-status';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Users, Building2, FolderOpen, Filter as FilterIcon, Filter, Building, User, Minimize, Settings, Plus, Lock, Layers, Info, RefreshCw } from 'lucide-react';
// Острая звезда для кнопки "только избранные" в панели фильтров
function SharpStarIcon({ className, filled = false }: { className?: string; filled?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="1em" height="1em" className={className} xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.56 5.82 22 7 14.14l-5-4.87 6.91-1.01L12 2z" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.6" strokeLinejoin="miter" />
    </svg>
  )
}
import { useSectionStatusesStore } from '@/modules/statuses-tags/statuses/store';
// Используем изолированный store фильтров для модуля projects
import { useProjectFilterStore } from '@/modules/projects/filters/store';

import { getFiltersPermissionContextAsync } from '@/modules/permissions/integration/filters-permission-context'
import { useUserPermissionsSync } from '@/modules/permissions'
import { applyProjectLocks } from '@/modules/projects/integration/project-filter-locks'
import * as Sentry from '@sentry/nextjs'
import { useSearchParams } from 'next/navigation';
import { useProjectsStore } from './store';
import { useProjectTagsStore } from './stores/useProjectTagsStore';
import { useTheme } from 'next-themes';
import { getTagStyles } from './utils/color';
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
import { Tooltip as UiTooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';

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

  // Локальный стор фильтров модуля projects
  const filterStore = useProjectFilterStore();
  // Состояние готовности прав (инициализация перед загрузкой дерева)
  const { isLoading: permLoading, error: permError } = useUserPermissionsSync()
  const [locksApplied, setLocksApplied] = useState(false)

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
  const statuses = useSectionStatusesStore(state => state.statuses);
  const loadStatuses = useSectionStatusesStore(state => state.loadStatuses);
  const [selectedStatusIdsLocal, setSelectedStatusIdsLocal] = useState<string[]>([]);
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const [selectedProjectStatuses, setSelectedProjectStatuses] = useState<string[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);

  // Теги проектов из store
  const { tags: projectTags, loadTags: loadProjectTags } = useProjectTagsStore();

  // Состояние для модального окна дашборда проекта
  const [isDashboardModalOpen, setIsDashboardModalOpen] = useState(false);
  const [dashboardProject, setDashboardProject] = useState<{id: string, name: string} | null>(null);
  const [isCreateProjectOpen, setIsCreateProjectOpen] = useState(false);
  
  // Состояние сайдбара для правильного позиционирования модального окна
  const { collapsed: sidebarCollapsed } = useSidebarState();

  // Состояние для адаптивного отображения текста фильтров
  const [isCompactMode, setIsCompactMode] = useState(false);
  // Состояние UI для кнопки «только избранные» (синхронизируем через window события)
  const [onlyFavoritesUI, setOnlyFavoritesUI] = useState(false);
  // Состояние для анимации обновления дерева
  const [isRefreshing, setIsRefreshing] = useState(false);

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

  // Обработчик обновления дерева проектов
  const handleRefresh = () => {
    if (isRefreshing) return; // Предотвращаем множественные клики

    // Отправляем событие для перезагрузки дерева
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('projectsTree:reload'));
    }
  };

  const handleResetFilters = () => {
    // [DEBUG:PROJECTS] Лог состояния перед сбросом
    console.log('[DEBUG:PROJECTS] reset:before', {
      selectedManagerId: filterStore.selectedManagerId,
      selectedProjectId: filterStore.selectedProjectId,
      selectedStageId: filterStore.selectedStageId,
      selectedObjectId: filterStore.selectedObjectId,
      selectedDepartmentId: filterStore.selectedDepartmentId,
      selectedTeamId: filterStore.selectedTeamId,
      selectedEmployeeId: filterStore.selectedEmployeeId,
      treeSearch,
      projectSearch,
      selectedStatusIdsLocal,
      selectedProjectStatuses,
    })

    // Сбрасываем фильтры проекта (менеджер/проект/стадия/объект + организация)
    filterStore.resetFilters()

    // Очищаем локальные состояния поиска/статусов дерева
    setProjectSearch('')
    setTreeSearch('')
    setSelectedStatusIdsLocal([])
    setSelectedProjectStatuses([])
    setSelectedTagIds([])

    // [DEBUG:PROJECTS] Лог состояния после сброса
    console.log('[DEBUG:PROJECTS] reset:after', {
      selectedManagerId: useProjectFilterStore.getState().selectedManagerId,
      selectedProjectId: useProjectFilterStore.getState().selectedProjectId,
      selectedStageId: useProjectFilterStore.getState().selectedStageId,
      selectedObjectId: useProjectFilterStore.getState().selectedObjectId,
      selectedDepartmentId: useProjectFilterStore.getState().selectedDepartmentId,
      selectedTeamId: useProjectFilterStore.getState().selectedTeamId,
      selectedEmployeeId: useProjectFilterStore.getState().selectedEmployeeId,
      treeSearch: '',
      projectSearch: '',
      selectedStatusIdsLocal: [],
      selectedProjectStatuses: [],
    })

    // Принудительная перезагрузка дерева, чтобы не зависеть от эффектов синхронизации
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('projectsTree:resetOnlyFavorites'))
      window.dispatchEvent(new CustomEvent('projectsTree:reload'))
    }
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

  // Ленивая инициализация данных организации для проектов (после инициализации прав)
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (permLoading || permError) return
    if (locksApplied) return
    // Инициализация блокировок и справочников строго один раз после загрузки прав
    (async () => {
      try {
        await applyProjectLocks()
        setLocksApplied(true)
        if (filterStore.managers.length === 0) {
          filterStore.loadManagers()
        }
        if (filterStore.departments.length === 0) {
          filterStore.loadDepartments()
        }
        if (filterStore.employees.length === 0) {
          filterStore.loadEmployees()
        }
        // Загружаем статусы разделов
        loadStatuses()
        // Загружаем теги проектов
        loadProjectTags()
      } catch (err) {
        Sentry.captureException(err)
        console.error('Failed to apply project locks', err)
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [permLoading, permError, locksApplied, filterStore.managers.length, filterStore.departments.length, filterStore.employees.length])

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

  // Синхронизация состояния обновления через события от ProjectsTree
  useEffect(() => {
    if (typeof window === 'undefined') return

    const handleRefreshStart = () => setIsRefreshing(true)
    const handleRefreshEnd = () => setIsRefreshing(false)

    window.addEventListener('projectsTree:refreshStart', handleRefreshStart as EventListener)
    window.addEventListener('projectsTree:refreshEnd', handleRefreshEnd as EventListener)

    return () => {
      window.removeEventListener('projectsTree:refreshStart', handleRefreshStart as EventListener)
      window.removeEventListener('projectsTree:refreshEnd', handleRefreshEnd as EventListener)
    }
  }, [])

  // Синхронизация состояния звезды «только избранные» через глобальные события дерева
  useEffect(() => {
    if (typeof window === 'undefined') return
    const handleToggle = () => setOnlyFavoritesUI(prev => !prev)
    const handleReset = () => setOnlyFavoritesUI(false)
    window.addEventListener('projectsTree:toggleOnlyFavorites', handleToggle as EventListener)
    window.addEventListener('projectsTree:resetOnlyFavorites', handleReset as EventListener)
    return () => {
      window.removeEventListener('projectsTree:toggleOnlyFavorites', handleToggle as EventListener)
      window.removeEventListener('projectsTree:resetOnlyFavorites', handleReset as EventListener)
    }
  }, [])

  return (
    <TooltipProvider>
    <div className="px-0 pt-0 pb-0">
      {/* Новый липкий FilterBar. Старые фильтры ProjectsFilters оставляем ниже. */}
      <FilterBar 
        title="Проекты"
        titleClassName="hidden min-[1340px]:block min-[1340px]:text-base xl:text-lg"
        right={(
          <div className="flex items-center gap-1">
            <button
              className="inline-flex items-center justify-center h-7 w-7 text-[11px] md:text-xs rounded-md hover:bg-slate-100 dark:hover:bg-slate-800"
              onClick={() => setIsCreateProjectOpen(true)}
              title="Создать проект"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        )}
      >
        {/* Инструменты: кнопки управления + поиск по структуре */}
        <div className="flex items-center gap-2 mr-2 text-[11px] md:text-xs">
          {/* Блок кнопок управления — группировка, свернуть всё, только избранные */}
          <div className="flex items-center gap-1.5">
            {/* Переключить группировку по руководителям */}
            <button
              className="flex items-center justify-center h-7 w-7 transition-all duration-200 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800"
              title="Переключить группировку по руководителям"
              onClick={() => { if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('projectsTree:toggleShowManagers')) }}
            >
              <Users className="h-4 w-4" />
            </button>

            {/* Свернуть всё */}
            <button
              className="flex items-center justify-center h-7 w-7 transition-all duration-200 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800"
              title="Свернуть всё"
              onClick={() => { if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('projectsTree:collapseAll')) }}
            >
              <Minimize className="h-4 w-4" />
            </button>

            {/* Показать только избранные проекты */}
            <button
              className="flex items-center justify-center h-7 w-7 transition-all duration-200 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800"
              title="Показать только избранные"
              onClick={() => { if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('projectsTree:toggleOnlyFavorites')) }}
              aria-pressed={onlyFavoritesUI ? 'true' : 'false'}
            >
              <SharpStarIcon className={onlyFavoritesUI ? 'h-4 w-4 text-yellow-600' : 'h-4 w-4 text-slate-400'} filled={onlyFavoritesUI} />
            </button>

            {/* Обновить дерево проектов */}
            <button
              className="flex items-center justify-center h-7 w-7 transition-all duration-200 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800"
              title="Обновить дерево проектов"
              onClick={handleRefresh}
              disabled={isRefreshing}
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
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

        {/* Разделитель сделан чуть тоньше для визуального выравнивания с остальными */}
        <div className="h-6 w-[0.5px] bg-slate-200 dark:bg-slate-700 mx-1" />

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
          <DropdownMenuContent align="start" className="w-[320px] p-0 dark:bg-slate-800 dark:border-slate-700">
            <div className="p-2 space-y-2">
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
                  disabled={Array.isArray((filterStore as any).lockedFilters) && (filterStore as any).lockedFilters.includes('department')}
                  
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
                  disabled={Array.isArray((filterStore as any).lockedFilters) && (filterStore as any).lockedFilters.includes('team')}
                  
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
        <div className="hidden">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="inline-flex items-center gap-1 px-2 py-1 border border-transparent text-[11px] md:text-xs hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap transition-all duration-200 ease-in-out rounded-md">
                <Filter className="h-3.5 w-3.5 text-slate-600 dark:text-slate-300" />
                <span className={`transition-all duration-300 ease-in-out overflow-hidden ${isCompactMode ? 'w-0 opacity-0' : 'w-auto opacity-100'}`}>
                  Статусы разделов
                </span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-[280px] p-0 dark:bg-slate-800 dark:border-slate-700">
              <div className="p-2 space-y-2">
                <div className="text-[10px] text-slate-500 mb-1">Фильтр по статусам разделов</div>
                <div className="flex items-center justify-between">
                  <button
                    className="text-[11px] md:text-xs px-2 py-1 bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 hover:bg-slate-200 dark:hover:bg-slate-600 transition-all duration-200 rounded-md"
                    onClick={()=> setSelectedStatusIdsLocal([])}
                  >
                    Очистить
                  </button>
                  <button
                    className="text-[11px] md:text-xs px-2 py-1 bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 hover:bg-slate-200 dark:hover:bg-slate-600 inline-flex items-center gap-1 transition-all duration-200 rounded-md"
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
                <div className="space-y-0.5">
                  {(statuses || []).map((s: { id: string; name: string; color: string; description?: string }) => (
                    <label key={s.id} className="flex items-center gap-2 px-2 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer transition-colors duration-200">
                      <input
                        type="checkbox"
                        className="border-gray-300 dark:border-slate-500 text-teal-600 focus:ring-teal-500 focus:ring-2"
                        checked={selectedStatusIdsLocal.includes(s.id)}
                        onChange={() => setSelectedStatusIdsLocal(prev => prev.includes(s.id) ? prev.filter(id => id !== s.id) : [...prev, s.id])}
                      />
                      <div className="w-2.5 h-2.5" style={{ backgroundColor: s.color }} />
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-medium dark:text-slate-200 truncate">{s.name}</div>
                        {s.description && <div className="text-xs text-slate-400 dark:text-slate-400 truncate">{s.description}</div>}
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 mx-1" />
        </div>

        {/* Статусы проектов и теги — refined professional dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="group relative inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] md:text-xs whitespace-nowrap transition-all duration-300 ease-out rounded-lg hover:bg-primary/5 dark:hover:bg-primary/10">
              {/* Subtle gradient background on hover */}
              <span className="absolute inset-0 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-r from-primary/5 via-transparent to-primary/5" />

              <Layers className="relative h-3.5 w-3.5 text-slate-500 dark:text-slate-400 group-hover:text-primary transition-colors duration-200" />
              <span className={`relative font-medium text-slate-700 dark:text-slate-300 group-hover:text-primary transition-all duration-300 ease-in-out overflow-hidden ${isCompactMode ? 'w-0 opacity-0' : 'w-auto opacity-100'}`}>
                Статусы и теги
              </span>

              {/* Active indicator dot */}
              {(selectedProjectStatuses.length > 0 || selectedTagIds.length > 0) && (
                <span className="ml-1 w-2 h-2 bg-primary rounded-full shadow-sm" />
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            sideOffset={8}
            className="w-[560px] p-0 rounded-2xl border border-border/40 bg-popover/95 backdrop-blur-xl shadow-2xl shadow-black/15 dark:shadow-black/40 overflow-hidden"
          >
            {/* Decorative top accent line */}
            <div className="h-0.5 bg-gradient-to-r from-transparent via-primary/60 to-transparent" />

            {/* Header with subtle pattern */}
            <div className="relative px-5 py-4 border-b border-border/30">
              {/* Subtle dot pattern background */}
              <div
                className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05]"
                style={{
                  backgroundImage: `radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)`,
                  backgroundSize: '16px 16px',
                }}
              />

              <div className="relative flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {/* Icon with gradient background */}
                  <div className="relative">
                    <div className="absolute inset-0 bg-primary/20 rounded-xl blur-md" />
                    <div className="relative p-2 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20">
                      <Layers className="h-4.5 w-4.5 text-primary" />
                    </div>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-foreground tracking-tight">Фильтры проектов</h3>
                    <p className="text-[11px] text-muted-foreground mt-0.5">Выберите статусы и теги для отображения</p>
                  </div>
                </div>

                {(selectedProjectStatuses.length > 0 || selectedTagIds.length > 0) && (
                  <button
                    onClick={() => {
                      setSelectedProjectStatuses([])
                      setSelectedTagIds([])
                    }}
                    className="group/reset flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-destructive px-2.5 py-1.5 rounded-lg hover:bg-destructive/10 transition-all duration-200"
                  >
                    <X className="h-3 w-3 transition-transform duration-200 group-hover/reset:rotate-90" />
                    Сбросить
                  </button>
                )}
              </div>
            </div>

            <div className="p-5">
              <div className="flex gap-6">
                {/* Левая колонка: Статусы проектов */}
                <div className="flex-1 min-w-[240px]">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-foreground uppercase tracking-wider">Статусы</span>
                      {selectedProjectStatuses.length > 0 && (
                        <span className="px-1.5 py-0.5 text-[9px] font-medium bg-primary/10 text-primary rounded-md">
                          {selectedProjectStatuses.length}
                        </span>
                      )}
                    </div>
                    {selectedProjectStatuses.length > 0 && (
                      <button
                        className="text-[10px] text-muted-foreground hover:text-primary transition-colors duration-200"
                        onClick={() => setSelectedProjectStatuses([])}
                      >
                        Очистить
                      </button>
                    )}
                  </div>

                  {/* Статусы как компактный список */}
                  <div className="space-y-1">
                    {PROJECT_STATUS_OPTIONS.map((s, index) => {
                      const norm = normalizeProjectStatus(s)
                      const isSelected = norm ? selectedProjectStatuses.includes(norm) : false
                      const badgeClasses = getProjectStatusBadgeClasses(s)

                      return (
                        <button
                          key={s}
                          onClick={() => setSelectedProjectStatuses(prev => {
                            const normVal = normalizeProjectStatus(s) as string
                            const setNorm = Array.from(new Set((prev || []).map(normalizeProjectStatus).filter(Boolean))) as string[]
                            return setNorm.includes(normVal) ? setNorm.filter(x => x !== normVal) : [...setNorm, normVal]
                          })}
                          className={`
                            group/status w-full flex items-center gap-3 px-3 py-2
                            rounded-xl transition-all duration-200
                            ${isSelected
                              ? 'bg-primary/8 dark:bg-primary/12'
                              : 'hover:bg-accent/50'
                            }
                          `}
                          style={{
                            animationDelay: `${index * 25}ms`,
                          }}
                        >
                          {/* Custom styled checkbox */}
                          <div className={`
                            relative flex-shrink-0 w-[18px] h-[18px] rounded-md
                            flex items-center justify-center
                            transition-all duration-200 ease-out
                            ${isSelected
                              ? 'bg-primary shadow-sm shadow-primary/30'
                              : 'border-2 border-muted-foreground/25 group-hover/status:border-primary/40'
                            }
                          `}>
                            <svg
                              className={`w-2.5 h-2.5 text-primary-foreground transition-all duration-200 ${isSelected ? 'scale-100 opacity-100' : 'scale-50 opacity-0'}`}
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={3}
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          </div>

                          {/* Status badge */}
                          <span className={`
                            flex-1 text-left px-2.5 py-1 text-[11px] font-medium rounded-lg border
                            transition-all duration-200
                            ${badgeClasses}
                            ${!isSelected ? 'opacity-70 group-hover/status:opacity-100' : 'shadow-sm'}
                          `}>
                            {getProjectStatusLabel(s)}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Vertical divider with gradient */}
                <div className="relative w-px self-stretch">
                  <div className="absolute inset-0 bg-gradient-to-b from-transparent via-border/60 to-transparent" />
                </div>

                {/* Правая колонка: Теги проектов */}
                <div className="flex-1 min-w-[240px]">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-foreground uppercase tracking-wider">Теги</span>
                      {selectedTagIds.length > 0 && (
                        <span className="px-1.5 py-0.5 text-[9px] font-medium bg-primary/10 text-primary rounded-md">
                          {selectedTagIds.length}
                        </span>
                      )}
                    </div>
                    {selectedTagIds.length > 0 && (
                      <button
                        className="text-[10px] text-muted-foreground hover:text-primary transition-colors duration-200"
                        onClick={() => setSelectedTagIds([])}
                      >
                        Очистить
                      </button>
                    )}
                  </div>

                  {/* Теги как список с чекбоксами (как статусы) */}
                  {projectTags.length > 0 ? (
                    <div className="space-y-1">
                      {projectTags.map((tag, index) => {
                        const isSelected = selectedTagIds.includes(tag.tag_id)
                        const styles = getTagStyles(tag.color, isDark)

                        return (
                          <button
                            key={tag.tag_id}
                            onClick={() => setSelectedTagIds(prev =>
                              prev.includes(tag.tag_id)
                                ? prev.filter(id => id !== tag.tag_id)
                                : [...prev, tag.tag_id]
                            )}
                            className={`
                              group/tag w-full flex items-center gap-3 px-3 py-2
                              rounded-xl transition-all duration-200
                              ${isSelected
                                ? 'bg-primary/8 dark:bg-primary/12'
                                : 'hover:bg-accent/50'
                              }
                            `}
                            style={{
                              animationDelay: `${index * 25}ms`,
                            }}
                          >
                            {/* Custom styled checkbox */}
                            <div className={`
                              relative flex-shrink-0 w-[18px] h-[18px] rounded-md
                              flex items-center justify-center
                              transition-all duration-200 ease-out
                              ${isSelected
                                ? 'bg-primary shadow-sm shadow-primary/30'
                                : 'border-2 border-muted-foreground/25 group-hover/tag:border-primary/40'
                              }
                            `}>
                              <svg
                                className={`w-2.5 h-2.5 text-primary-foreground transition-all duration-200 ${isSelected ? 'scale-100 opacity-100' : 'scale-50 opacity-0'}`}
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                strokeWidth={3}
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            </div>

                            {/* Tag badge - striped pattern style */}
                            <span
                              className={`
                                relative overflow-hidden flex-1 text-left px-2.5 py-1 text-[11px] font-medium rounded-lg border
                                transition-all duration-200
                                ${isSelected ? 'shadow-sm' : ''}
                              `}
                              style={{
                                backgroundColor: styles.backgroundColor,
                                borderColor: styles.borderColor,
                                color: styles.color,
                              }}
                            >
                              {/* Diagonal stripes overlay */}
                              <span
                                className="absolute inset-0 pointer-events-none opacity-[0.08]"
                                style={{
                                  backgroundImage: `repeating-linear-gradient(
                                    -45deg,
                                    ${styles.stripeColor},
                                    ${styles.stripeColor} 1px,
                                    transparent 1px,
                                    transparent 5px
                                  )`,
                                }}
                              />
                              <span className="relative">{tag.name}</span>
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                      {/* Empty state with decorative element */}
                      <div className="relative mb-3">
                        <div className="absolute inset-0 bg-muted/30 rounded-2xl blur-lg" />
                        <div className="relative w-14 h-14 rounded-2xl bg-gradient-to-br from-muted/60 to-muted/30 border border-border/30 flex items-center justify-center">
                          <Layers className="w-6 h-6 text-muted-foreground/40" />
                        </div>
                      </div>
                      <p className="text-xs font-medium text-muted-foreground/70">Теги пока не созданы</p>
                      <p className="text-[10px] text-muted-foreground/50 mt-0.5">Создайте первый тег в настройках</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Footer accent */}
            <div className="h-0.5 bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
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
          <DropdownMenuContent align="start" className="w-[340px] p-0 dark:bg-slate-800 dark:border-slate-700">
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
              </div>
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
                  disabled={Array.isArray((filterStore as any).lockedFilters) && (filterStore as any).lockedFilters.includes('manager')}
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

        <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 mx-1" />

        {/* Управление статусами разделов */}
        <UiTooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => {
                if (typeof window !== 'undefined') {
                  window.dispatchEvent(new CustomEvent('projectsTree:openStatusManagement'))
                }
              }}
              className="flex items-center justify-center h-7 w-7 transition-all duration-200 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800"
              title="Управление статусами разделов"
            >
              <Settings className="h-4 w-4 text-slate-600 dark:text-slate-300" />
            </button>
          </TooltipTrigger>
          <TooltipContent className="text-xs dark:text-slate-200">
            Управление статусами разделов
          </TooltipContent>
        </UiTooltip>

      </FilterBar>

      {/* Нижняя панель инструментов удалена — инструменты перенесены в верхний дропдаун */}

      <div className="p-0">
        {!locksApplied ? (
          <div className="bg-white dark:bg-slate-900 border-b dark:border-b-slate-700 border-b-slate-200 overflow-hidden">
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500 mx-auto"></div>
              <p className="text-sm dark:text-slate-400 text-slate-500 mt-3">Подготовка фильтров доступа...</p>
            </div>
          </div>
        ) : (
          <ProjectsTree
          selectedManagerId={filterStore.selectedManagerId}
          selectedProjectId={filterStore.selectedProjectId}
          selectedStageId={filterStore.selectedStageId}
          selectedObjectId={filterStore.selectedObjectId}
          selectedDepartmentId={filterStore.selectedDepartmentId}
          selectedTeamId={filterStore.selectedTeamId}
          selectedEmployeeId={filterStore.selectedEmployeeId}
          selectedStatusIds={selectedStatusIdsLocal}
          selectedProjectStatuses={selectedProjectStatuses}
          selectedTagIds={selectedTagIds}
          externalSearchQuery={treeSearch}
          urlSectionId={urlSectionId}
          urlTab={urlTab || 'overview'}
          onOpenProjectDashboard={handleOpenProjectDashboard}
          statuses={statuses}
        />
        )}
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
    </TooltipProvider>
  );
} 