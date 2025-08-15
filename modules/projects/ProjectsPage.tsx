"use client"

import { useState, useEffect } from 'react';
import FilterBar from '@/components/filter-bar/FilterBar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Users, Building2, FolderOpen, Filter as FilterIcon } from 'lucide-react';
import { useReportsOrgFiltersStore } from '@/modules/reports/filters/store';
import { useReportsProjectFiltersStore } from '@/modules/reports/filters/projectStore';
import { useReportsAuthorFilterStore } from '@/modules/reports/filters/authorStore';
import { useSearchParams } from 'next/navigation';
import { useProjectsStore } from './store';
import { ProjectsFilters } from './filters';
import { ProjectsTree } from './components';
import { useUiStore } from '@/stores/useUiStore';

import { X } from 'lucide-react';

export default function ProjectsPage() {
  const searchParams = useSearchParams();
  const { 
    filters, 
    clearFilters,
    selectedSectionId,
    isDetailsPanelOpen 
  } = useProjectsStore();

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
    clearFilters();
    setSelectedManagerId(null);
    setSelectedProjectId(null);
    setSelectedStageId(null);
    setSelectedObjectId(null);
    setSelectedDepartmentId(null);
    setSelectedTeamId(null);
    setSelectedEmployeeId(null);
  };

  // Подключаем унифицированные стора (без удаления старых фильтров)
  const { authorId, setAuthorId } = useReportsAuthorFilterStore();
  const orgStore = useReportsOrgFiltersStore();
  const projStore = useReportsProjectFiltersStore();

  // Инициализация стора организации один раз при необходимости
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!orgStore.isLoading && orgStore.departments.length === 0) {
      orgStore.initialize()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgStore.isLoading, orgStore.departments.length])

  return (
    <div className="px-0 pt-0 pb-0">
      {/* Новый липкий FilterBar. Старые фильтры ProjectsFilters оставляем ниже. */}
      <FilterBar title="Проекты">
        {/* Организация — полноценный дропдаун (как в отчётах) */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-transparent text-[11px] md:text-xs hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap"
              title={(() => {
                const d = orgStore.selectedDepartmentId ? orgStore.departments.find(d=>d.id===orgStore.selectedDepartmentId)?.name : ''
                const t = orgStore.selectedTeamId ? orgStore.teams.find(x=>x.id===orgStore.selectedTeamId)?.name : ''
                const e = orgStore.selectedEmployeeId ? orgStore.employees.find(x=>x.id===orgStore.selectedEmployeeId)?.name : ''
                return [d,t,e].filter(Boolean).join(' › ')
              })()}
            >
              <Building2 className="h-4 w-4" /> Организация
              {[orgStore.selectedDepartmentId, orgStore.selectedTeamId, orgStore.selectedEmployeeId].some(Boolean) && (
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
                  value={orgStore.selectedDepartmentId || ''}
                  onChange={e => orgStore.setDepartment(e.target.value || null)}
                  className="w-full px-2 py-1.5 text-[11px] md:text-xs border border-slate-300 dark:border-slate-700 rounded-md dark:bg-slate-900 dark:text-white"
                  size={6}
                >
                  <option value="">Все</option>
                  {orgStore.departments.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
              {/* Команда */}
              <div>
                <div className="text-[10px] text-slate-500 mb-1">Команда</div>
                <select
                  value={orgStore.selectedTeamId || ''}
                  onChange={e => orgStore.setTeam(e.target.value || null)}
                  className="w-full px-2 py-1.5 text-[11px] md:text-xs border border-slate-300 dark:border-slate-700 rounded-md dark:bg-slate-900 dark:text-white"
                  size={6}
                >
                  <option value="">Все</option>
                  {orgStore.getTeamsForSelectedDepartment().map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
              {/* Сотрудник */}
              <div>
                <div className="text-[10px] text-slate-500 mb-1">Сотрудник</div>
                <select
                  value={orgStore.selectedEmployeeId || ''}
                  onChange={e => orgStore.setEmployee(e.target.value || null)}
                  className="w-full px-2 py-1.5 text-[11px] md:text-xs border border-slate-300 dark:border-slate-700 rounded-md dark:bg-slate-900 dark:text-white"
                  size={6}
                >
                  <option value="">Все</option>
                  {orgStore.getEmployeesFiltered().map(e => (
                    <option key={e.id} value={e.id}>{e.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 mx-1" />

        {/* Проектная иерархия (плейсхолдер, позже подключим) */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-transparent text-[11px] md:text-xs hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap">
              <FolderOpen className="h-4 w-4" /> Проект
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-[260px] p-2 text-[12px] text-slate-500">
            Подключим Project → Stage → Object → Section как в отчётах
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

      <div className="p-6 space-y-6">
        {/* Старые фильтры — пока оставляем, чтобы ничего не сломать */}
        <ProjectsFilters
          onProjectChange={handleProjectChange}
          onDepartmentChange={handleDepartmentChange}
          onTeamChange={handleTeamChange}
          onEmployeeChange={handleEmployeeChange}
          onManagerChange={handleManagerChange}
          onStageChange={handleStageChange}
          onObjectChange={handleObjectChange}
          onResetFilters={handleResetFilters}
        />
      
      {/* Структура проектов */}
      <ProjectsTree
        selectedManagerId={selectedManagerId}
        selectedProjectId={selectedProjectId}
        selectedStageId={selectedStageId}
        selectedObjectId={selectedObjectId}
        selectedDepartmentId={selectedDepartmentId}
        selectedTeamId={selectedTeamId}
        selectedEmployeeId={selectedEmployeeId}
        urlSectionId={urlSectionId}
        urlTab={urlTab || 'overview'}
      />
      </div>
    </div>
  );
} 