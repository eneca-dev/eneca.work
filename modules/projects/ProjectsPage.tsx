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

  // Состояние для управления отображением отделов (как в планировании)
  const [showDepartments, setShowDepartments] = useState(true);
  const [expandedDepartments, setExpandedDepartments] = useState<Set<string>>(new Set());

  // Состояние фильтров для передачи в дерево
  const [selectedManagerId, setSelectedManagerId] = useState<string | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedStageId, setSelectedStageId] = useState<string | null>(null);
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);

  // Обработчики фильтров
  const handleProjectChange = (projectId: string | null) => {
    setSelectedProjectId(projectId);
  };

  const handleDepartmentChange = (departmentId: string | null) => {
    console.log('Department changed:', departmentId);
  };

  const handleTeamChange = (teamId: string | null) => {
    console.log('Team changed:', teamId);
  };

  const handleEmployeeChange = (employeeId: string | null) => {
    console.log('Employee changed:', employeeId);
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
  };

  const toggleShowDepartments = () => {
    setShowDepartments(!showDepartments);
  };

  const expandAllDepartments = () => {
    // Логика для развертывания всех отделов
    console.log('Expand all departments');
  };

  const collapseAllDepartments = () => {
    // Логика для свертывания всех отделов
    console.log('Collapse all departments');
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
        showDepartments={showDepartments}
        toggleShowDepartments={toggleShowDepartments}
        expandAllDepartments={expandAllDepartments}
        collapseAllDepartments={collapseAllDepartments}
      />
      
      {/* Структура проектов */}
      <ProjectsTree
        selectedManagerId={selectedManagerId}
        selectedProjectId={selectedProjectId}
        selectedStageId={selectedStageId}
        selectedObjectId={selectedObjectId}
      />
    </div>
  );
} 