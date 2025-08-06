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
  
  // Подсвеченный раздел для навигации к комментариям
  highlightedSectionId: string | null;
  
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
  
  // Действия для навигации к разделам (всегда открывает комментарии)
  highlightSection: (sectionId: string) => void;
  clearHighlight: () => void;
  
  // Действия для уведомлений
  setNotification: (message: string) => void;
  clearNotification: () => void;
  
  // Действия для обновления разделов
  updateSectionResponsible: (sectionId: string, updates: { responsibleName?: string; responsibleAvatarUrl?: string }) => void;
  updateSectionStatus: (sectionId: string, updates: { statusId?: string | null; statusName?: string | null; statusColor?: string | null }) => void;
  
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
      highlightedSectionId: null,
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
        
      highlightSection: (sectionId) =>
        set({ 
          highlightedSectionId: sectionId
        }),
        
      clearHighlight: () =>
        set({ 
          highlightedSectionId: null
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

      // Функция обновления статуса раздела
      updateSectionStatus: (sectionId, updates) => {
        set((state) => ({
          sections: state.sections.map(section =>
            section.section_id === sectionId
              ? { ...section, section_status_id: updates.statusId || section.section_status_id }
              : section
          )
        }));
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
        // Восстанавливаем Set из массива при загрузке из localStorage
        if (state && state.expandedNodes) {
          if (Array.isArray(state.expandedNodes)) {
            state.expandedNodes = new Set(state.expandedNodes);
          } else {
            // Если по какой-то причине expandedNodes не массив, создаем пустой Set
            state.expandedNodes = new Set();
          }
        }
      },
    }
  )
); 