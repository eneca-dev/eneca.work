"use client"

import { useState } from 'react';
import { useProjectsStore } from './store';
import { ProjectsFilters } from './filters';
import { ProjectsTree } from './components';
import { Card, CardContent } from '@/components/ui/card';
import { useUiStore } from '@/stores/useUiStore';
import { X } from 'lucide-react';

export default function ProjectsPage() {
  const { 
    filters, 
    clearFilters,
    selectedSectionId,
    isDetailsPanelOpen 
  } = useProjectsStore();

  // Получаем уведомления из UI стора
  const { notification, clearNotification } = useUiStore();

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
      
      {/* Уведомления */}
      {notification && (
        <div className="fixed top-4 right-4 z-50 max-w-md">
          <div className={`border rounded-lg p-4 shadow-lg ${
            notification.includes('успешно') || notification.includes('создана') || notification.includes('обновлен') || notification.includes('удален')
              ? 'bg-green-50 border-green-200' 
              : 'bg-red-50 border-red-200'
          }`}>
            <div className="flex items-start">
              <div className="flex-1">
                <p className={`text-sm font-medium ${
                  notification.includes('успешно') || notification.includes('создана') || notification.includes('обновлен') || notification.includes('удален')
                    ? 'text-green-800' 
                    : 'text-red-800'
                }`}>
                  {notification}
                </p>
              </div>
              <button
                onClick={clearNotification}
                className={`ml-3 flex-shrink-0 ${
                  notification.includes('успешно') || notification.includes('создана') || notification.includes('обновлен') || notification.includes('удален')
                    ? 'text-green-400 hover:text-green-600' 
                    : 'text-red-400 hover:text-red-600'
                }`}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}
      
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