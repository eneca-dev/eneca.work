"use client"

import { useState } from 'react';
import { useProjectsStore } from './store';
import { ProjectsFilters } from './filters';
import { ProjectsTree } from './components';
import { useUiStore } from '@/stores/useUiStore';


export default function ProjectsPage() {
  const { 
    filters, 
    clearFilters,
    selectedSectionId,
    isDetailsPanelOpen 
  } = useProjectsStore();

  // GlobalNotification компонент сам управляет уведомлениями



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

  return (
    <div className="p-6 space-y-6">
      
      {/* Глобальные уведомления добавлены в ClientProviders */}
      
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
      />
    </div>
  );
} 