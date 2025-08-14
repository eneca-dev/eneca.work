"use client"

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useProjectsStore } from './store';
import { ProjectsFilters } from './filters';
import { ProjectsTree } from './components';
import { useUiStore } from '@/stores/useUiStore';
import { InlineDashboard } from '@/modules/dashboard/InlineDashboard';
import { useSidebarState } from '@/hooks/useSidebarState';

import { X } from 'lucide-react';

export default function ProjectsPage() {
  const searchParams = useSearchParams();
  const { collapsed: sidebarCollapsed } = useSidebarState();
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

  // Состояние для дашборда
  const [showDashboard, setShowDashboard] = useState(false);
  const [dashboardProject, setDashboardProject] = useState<{id: string, name: string} | null>(null);
  const [isClosing, setIsClosing] = useState(false);

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

  // Обработчик открытия дашборда проекта
  const handleOpenProjectDashboard = (project: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setDashboardProject({ id: project.id, name: project.name });
    setShowDashboard(true);
  };

  // Обработчик возврата к проектам
  const handleBackToProjects = () => {
    setIsClosing(true);
    // Плавное закрытие с задержкой
    setTimeout(() => {
      setShowDashboard(false);
      setDashboardProject(null);
      setIsClosing(false);
    }, 300); // Соответствует duration-300 анимации
  };

  // Обработчик клика по backdrop (вне дашборда)
  const handleBackdropClick = (e: React.MouseEvent) => {
    // Закрываем только если клик был по backdrop, а не по самому дашборду
    if (e.target === e.currentTarget) {
      handleBackToProjects();
    }
  };

  return (
    <div className={showDashboard ? "" : "p-6 space-y-6"}>
      
      {/* Глобальные уведомления добавлены в ClientProviders */}
      
      {showDashboard && dashboardProject ? (
        /* Показываем встроенный дашборд в полноэкранном режиме с backdrop */
        <div 
          className="fixed inset-0 z-30 bg-black/5 backdrop-blur-sm"
          style={{ marginLeft: sidebarCollapsed ? '80px' : '256px' }}
          onClick={handleBackdropClick}
        >
          <div 
            className="w-full h-full p-4 overflow-auto"
            onClick={handleBackdropClick}
          >
            <InlineDashboard 
              projectId={dashboardProject.id}
              isClosing={isClosing}
              onClose={handleBackToProjects}
            />
          </div>
        </div>
      ) : (
        <>
          {/* Фильтры - точная копия из планирования */}
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
            onOpenProjectDashboard={handleOpenProjectDashboard}
          />
        </>
      )}
    </div>
  );
} 