import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'
import { createClient } from '@/utils/supabase/client'

type Id = string

export interface SimpleOption {
  id: Id
  name: string
}

interface ProjectFiltersState {
  isLoadingProjects: boolean
  isLoadingStages: boolean
  isLoadingObjects: boolean
  isLoadingSections: boolean
  // @ts-ignore runtime: для дизейблов и индикаторов
  lockedFilters?: Array<'manager' | 'project' | 'stage' | 'object' | 'department' | 'team' | 'employee'>

  projects: SimpleOption[]
  stages: SimpleOption[]
  objects: SimpleOption[]
  sections: SimpleOption[]

  selectedProjectId: Id | null
  selectedStageId: Id | null
  selectedObjectId: Id | null
  selectedSectionId: Id | null

  initialize: () => Promise<void>
  setProject: (projectId: Id | null) => void
  setStage: (stageId: Id | null) => void
  setObject: (objectId: Id | null) => void
  setSection: (sectionId: Id | null) => void
}

const supabase = createClient()

export const useReportsProjectFiltersStore = create<ProjectFiltersState>()(
  devtools(
    persist(
      (set, get) => ({
        isLoadingProjects: false,
        isLoadingStages: false,
        isLoadingObjects: false,
        isLoadingSections: false,
        lockedFilters: [],

        projects: [],
        stages: [],
        objects: [],
        sections: [],

        selectedProjectId: null,
        selectedStageId: null,
        selectedObjectId: null,
        selectedSectionId: null,

        initialize: async () => {
          // Загружаем список проектов при инициализации
          set({ isLoadingProjects: true })
          try {
            const { data, error } = await supabase
              .from('projects')
              .select('project_id, project_name')
              .eq('project_status', 'active')
              .order('project_name')
            if (error) throw error
            const projects = (data || []).map((p: any) => ({ id: p.project_id as Id, name: p.project_name as string }))
            set({ projects, isLoadingProjects: false })
          } catch (e) {
            console.error('Ошибка загрузки проектов (reports):', e)
            set({ isLoadingProjects: false })
          }
        },

        setProject: (projectId) => {
          set({ selectedProjectId: projectId, selectedStageId: null, selectedObjectId: null, selectedSectionId: null, stages: [], objects: [], sections: [] })
          if (!projectId) return
          ;(async () => {
            set({ isLoadingStages: true })
            try {
              const { data, error } = await supabase
                .from('stages')
                .select('stage_id, stage_name')
                .eq('stage_project_id', projectId)
                .order('stage_name')
              if (error) throw error
              const stages = (data || []).map((s: any) => ({ id: s.stage_id as Id, name: s.stage_name as string }))
              set({ stages, isLoadingStages: false })
            } catch (e) {
              console.error('Ошибка загрузки стадий (reports):', e)
              set({ isLoadingStages: false })
            }
          })()
        },

        setStage: (stageId) => {
          set({ selectedStageId: stageId, selectedObjectId: null, selectedSectionId: null, objects: [], sections: [] })
          if (!stageId) return
          ;(async () => {
            set({ isLoadingObjects: true })
            try {
              const { data, error } = await supabase
                .from('objects')
                .select('object_id, object_name')
                .eq('object_stage_id', stageId)
                .order('object_name')
              if (error) throw error
              const objects = (data || []).map((o: any) => ({ id: o.object_id as Id, name: o.object_name as string }))
              set({ objects, isLoadingObjects: false })
            } catch (e) {
              console.error('Ошибка загрузки объектов (reports):', e)
              set({ isLoadingObjects: false })
            }
          })()
        },

        setObject: (objectId) => {
          set({ selectedObjectId: objectId, selectedSectionId: null, sections: [] })
          if (!objectId) return
          ;(async () => {
            set({ isLoadingSections: true })
            try {
              const { data, error } = await supabase
                .from('sections')
                .select('section_id, section_name')
                .eq('section_object_id', objectId)
                .order('section_name')
              if (error) throw error
              const sections = (data || []).map((s: any) => ({ id: s.section_id as Id, name: s.section_name as string }))
              set({ sections, isLoadingSections: false })
            } catch (e) {
              console.error('Ошибка загрузки разделов (reports):', e)
              set({ isLoadingSections: false })
            }
          })()
        },

        setSection: (sectionId) => {
          set({ selectedSectionId: sectionId })
        }
      }),
      {
        name: 'reports-project-filters',
        partialize: (state) => ({
          selectedProjectId: state.selectedProjectId,
          selectedStageId: state.selectedStageId,
          selectedObjectId: state.selectedObjectId,
          selectedSectionId: state.selectedSectionId
        })
      }
    )
  )
)

