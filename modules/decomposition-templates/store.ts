import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import type {
  DecompositionTemplate,
  DecompositionTemplateItem,
  CreateTemplatePayload,
  UpdateTemplatePayload,
  CreateTemplateItemPayload,
  UpdateTemplateItemPayload,
} from './types'
import {
  listTemplatesByDepartment,
  getTemplate,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  createTemplateItem,
  updateTemplateItem,
  deleteTemplateItem,
  applyTemplateAppend,
} from './api'

interface TemplatesStore {
  departmentId: string | null
  templates: DecompositionTemplate[]
  selectedTemplate: DecompositionTemplate | null
  templateItems: DecompositionTemplateItem[]
  isLoading: boolean
  setDepartment: (id: string | null) => void
  fetchTemplates: () => Promise<void>
  openTemplate: (id: string) => Promise<void>
  createTemplate: (p: CreateTemplatePayload) => Promise<DecompositionTemplate>
  updateTemplate: (id: string, p: UpdateTemplatePayload) => Promise<DecompositionTemplate>
  deleteTemplate: (id: string) => Promise<void>
  createItem: (p: CreateTemplateItemPayload) => Promise<DecompositionTemplateItem>
  updateItem: (id: string, p: UpdateTemplateItemPayload) => Promise<DecompositionTemplateItem>
  deleteItem: (id: string) => Promise<void>
  applyTemplateAppend: (section_id: string, template_id: string, base_date?: string | null) => Promise<number>
}

export const useTemplatesStore = create<TemplatesStore>()(
  devtools((set, get) => ({
    departmentId: null,
    templates: [],
    selectedTemplate: null,
    templateItems: [],
    isLoading: false,
    setDepartment: (id) => set({ departmentId: id }),
    fetchTemplates: async () => {
      const depId = get().departmentId
      if (!depId) return
      set({ isLoading: true })
      try {
        const data = await listTemplatesByDepartment(depId)
        set({ templates: data })
      } finally {
        set({ isLoading: false })
      }
    },
    openTemplate: async (id: string) => {
      set({ isLoading: true })
      try {
        const { template, items } = await getTemplate(id)
        set({ selectedTemplate: template, templateItems: items })
      } finally {
        set({ isLoading: false })
      }
    },
    createTemplate: async (p) => {
      const t = await createTemplate(p)
      await get().fetchTemplates()
      return t
    },
    updateTemplate: async (id, p) => {
      const t = await updateTemplate(id, p)
      await get().fetchTemplates()
      return t
    },
    deleteTemplate: async (id) => {
      await deleteTemplate(id)
      set({ selectedTemplate: null, templateItems: [] })
      await get().fetchTemplates()
    },
    createItem: async (p) => {
      const it = await createTemplateItem(p)
      await get().openTemplate(p.template_id)
      return it
    },
    updateItem: async (id, p) => {
      const it = await updateTemplateItem(id, p)
      const tpl = get().selectedTemplate
      if (tpl) await get().openTemplate(tpl.id)
      return it
    },
    deleteItem: async (id) => {
      await deleteTemplateItem(id)
      const tpl = get().selectedTemplate
      if (tpl) await get().openTemplate(tpl.id)
    },
    applyTemplateAppend: async (section_id, template_id, base_date) => {
      const res = await applyTemplateAppend({ section_id, template_id, base_date })
      return res.inserted
    },
  }))
)

