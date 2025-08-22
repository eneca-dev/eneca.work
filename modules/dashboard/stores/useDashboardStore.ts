import { create } from 'zustand';

// Типы для данных dashboard
interface DashboardData {
  projectInfo?: any;
  statistics?: any;
  dataCompleteness?: any;
  sectionStatuses?: any[];
  taskStatuses?: any[];
  attentionItems?: any[];
  activities?: any[];
  comments?: any[];
}

// Типы для состояний загрузки
interface LoadingStates {
  projectInfo: boolean;
  statistics: boolean;
  dataCompleteness: boolean;
  sectionStatuses: boolean;
  taskStatuses: boolean;
  attentionItems: boolean;
  activities: boolean;
  comments: boolean;
}

// Типы для ошибок
interface ErrorStates {
  projectInfo?: string;
  statistics?: string;
  dataCompleteness?: string;
  sectionStatuses?: string;
  taskStatuses?: string;
  attentionItems?: string;
  activities?: string;
  comments?: string;
}

interface DashboardState {
  projectId: string | null;
  isOpen: boolean;
  autoRefresh: boolean;
  data: DashboardData;
  loading: LoadingStates;
  errors: ErrorStates;
}

interface DashboardActions {
  // Основные действия
  openDashboard: (projectId: string) => void;
  closeDashboard: () => void;
  toggleAutoRefresh: () => void;
  resetData: () => void;
  
  // Сеттеры для данных
  setProjectInfo: (data: any) => void;
  setStatistics: (data: any) => void;
  setDataCompleteness: (data: any) => void;
  setSectionStatuses: (data: any[]) => void;
  setTaskStatuses: (data: any[]) => void;
  setAttentionItems: (data: any[]) => void;
  setActivities: (data: any[]) => void;
  setComments: (data: any[]) => void;
  
  // Сеттеры для состояний загрузки
  setLoading: (key: keyof LoadingStates, loading: boolean) => void;
  setError: (key: keyof ErrorStates, error?: string) => void;
}

const initialLoadingState: LoadingStates = {
  projectInfo: false,
  statistics: false,
  dataCompleteness: false,
  sectionStatuses: false,
  taskStatuses: false,
  attentionItems: false,
  activities: false,
  comments: false,
};

export const useDashboardStore = create<DashboardState & DashboardActions>((set) => ({
  // Состояние
  projectId: null,
  isOpen: false,
  autoRefresh: true,
  data: {},
  loading: initialLoadingState,
  errors: {},

  // Основные действия
  openDashboard: (projectId: string) => {
    set((state) => ({
      ...state,
      projectId,
      isOpen: true,
    }));
  },

  closeDashboard: () => {
    set((state) => ({
      ...state,
      projectId: null,
      isOpen: false,
    }));
  },

  toggleAutoRefresh: () => {
    set((state) => ({
      ...state,
      autoRefresh: !state.autoRefresh,
    }));
  },

  resetData: () => {
    set((state) => ({
      ...state,
      data: {},
      loading: initialLoadingState,
      errors: {},
    }));
  },

  // Сеттеры для данных
  setProjectInfo: (data: any) => {
    set((state) => ({
      ...state,
      data: { ...state.data, projectInfo: data },
    }));
  },

  setStatistics: (data: any) => {
    set((state) => ({
      ...state,
      data: { ...state.data, statistics: data },
    }));
  },

  setDataCompleteness: (data: any) => {
    set((state) => ({
      ...state,
      data: { ...state.data, dataCompleteness: data },
    }));
  },

  setSectionStatuses: (data: any[]) => {
    set((state) => ({
      ...state,
      data: { ...state.data, sectionStatuses: data },
    }));
  },

  setTaskStatuses: (data: any[]) => {
    set((state) => ({
      ...state,
      data: { ...state.data, taskStatuses: data },
    }));
  },

  setAttentionItems: (data: any[]) => {
    set((state) => ({
      ...state,
      data: { ...state.data, attentionItems: data },
    }));
  },

  setActivities: (data: any[]) => {
    set((state) => ({
      ...state,
      data: { ...state.data, activities: data },
    }));
  },

  setComments: (data: any[]) => {
    set((state) => ({
      ...state,
      data: { ...state.data, comments: data },
    }));
  },

  // Сеттеры для состояний
  setLoading: (key: keyof LoadingStates, loading: boolean) => {
    set((state) => ({
      ...state,
      loading: { ...state.loading, [key]: loading },
    }));
  },

  setError: (key: keyof ErrorStates, error?: string) => {
    set((state) => ({
      ...state,
      errors: { ...state.errors, [key]: error },
    }));
  },
}));