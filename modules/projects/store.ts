import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Project, Stage, Object, Section, ProjectFilters } from './types';

interface ProjectsState {
  // Фильтры
  filters: ProjectFilters;
  
  // UI состояние
  selectedSectionId: string | null;
  isDetailsPanelOpen: boolean;
  activeDetailsTab: 'overview' | 'team' | 'files';
  expandedNodes: Set<string>;
  
  // Уведомления
  notification: string | null;
  
  // Данные
  projects: Project[];
  stages: Stage[];
  objects: Object[];
  sections: Section[];
  
  // Действия для фильтров
  setFilter: (key: keyof ProjectFilters, value: string | null) => void;
  clearFilters: () => void;
  
  // Действия для UI
  selectSection: (sectionId: string | null) => void;
  toggleDetailsPanel: () => void;
  setActiveDetailsTab: (tab: ProjectsState['activeDetailsTab']) => void;
  toggleNode: (nodeId: string) => void;
  
  // Действия для уведомлений
  setNotification: (message: string) => void;
  clearNotification: () => void;
  
  // Действия для обновления разделов
  updateSectionResponsible: (sectionId: string, updates: { responsibleName?: string; responsibleAvatarUrl?: string }) => void;
  
  // CRUD операции (заглушки пока)
  setProjects: (projects: Project[]) => void;
  setStages: (stages: Stage[]) => void;
  setObjects: (objects: Object[]) => void;
  setSections: (sections: Section[]) => void;
}

export const useProjectsStore = create<ProjectsState>()(
  persist(
    (set, get) => ({
      filters: {
        managerId: null,
        projectId: null,
        stageId: null,
        objectId: null,
        departmentId: null,
        teamId: null,
        employeeId: null,
      },
      selectedSectionId: null,
      isDetailsPanelOpen: false,
      activeDetailsTab: 'overview',
      expandedNodes: new Set(),
      notification: null,
      projects: [],
      stages: [],
      objects: [],
      sections: [],
      
      setFilter: (key, value) =>
        set((state) => ({
          filters: { ...state.filters, [key]: value }
        })),
        
      clearFilters: () =>
        set(() => ({
          filters: {
            managerId: null,
            projectId: null,
            stageId: null,
            objectId: null,
            departmentId: null,
            teamId: null,
            employeeId: null,
          }
        })),
        
      selectSection: (sectionId) =>
        set(() => ({
          selectedSectionId: sectionId,
          isDetailsPanelOpen: sectionId !== null,
        })),
        
      toggleDetailsPanel: () =>
        set((state) => ({
          isDetailsPanelOpen: !state.isDetailsPanelOpen,
          selectedSectionId: !state.isDetailsPanelOpen ? state.selectedSectionId : null,
        })),
        
      setActiveDetailsTab: (tab) =>
        set(() => ({ activeDetailsTab: tab })),
        
      toggleNode: (nodeId) =>
        set((state) => {
          const newExpandedNodes = new Set(state.expandedNodes);
          if (newExpandedNodes.has(nodeId)) {
            newExpandedNodes.delete(nodeId);
          } else {
            newExpandedNodes.add(nodeId);
          }
          return { expandedNodes: newExpandedNodes };
        }),
        
      setProjects: (projects) => set(() => ({ projects })),
      setStages: (stages) => set(() => ({ stages })),
      setObjects: (objects) => set(() => ({ objects })),
      setSections: (sections) => set(() => ({ sections })),
      
      // Функции уведомлений
      setNotification: (message) => set(() => ({ notification: message })),
      clearNotification: () => set(() => ({ notification: null })),
      
      // Функция обновления ответственного за раздел
      updateSectionResponsible: (sectionId, updates) => {
        // Пока что это заглушка, так как мы работаем с данными из view_section_hierarchy
        // В реальном приложении здесь можно было бы обновить локальное состояние
        console.log('Обновление ответственного за раздел:', sectionId, updates)
      },
    }),
    {
      name: 'projects-storage',
      partialize: (state) => ({
        filters: state.filters,
        expandedNodes: Array.from(state.expandedNodes),
        activeDetailsTab: state.activeDetailsTab,
      }),
      onRehydrateStorage: () => (state) => {
        if (state && Array.isArray(state.expandedNodes)) {
          state.expandedNodes = new Set(state.expandedNodes);
        }
      },
    }
  )
); 