import { create } from "zustand"
import type { DecompositionItem, DecompositionTemplate, SectionHierarchy, TabType, DecompositionStage } from "./types"
import { createClient } from "@/utils/supabase/client"

const supabase = createClient()

interface DecompositionStore {
  // UI State
  activeTab: TabType
  setActiveTab: (tab: TabType) => void

  // Data
  sections: SectionHierarchy[]
  selectedSectionId: string | null
  decompositionItems: DecompositionItem[]
  templates: DecompositionTemplate[]
  isLoading: boolean
  error: string | null

  // Actions
  fetchSections: (userId: string) => Promise<void>
  selectSection: (sectionId: string | null) => void
  addDecompositionItem: () => void
  updateDecompositionItem: (index: number, field: keyof DecompositionItem, value: string | number) => void
  removeDecompositionItem: (index: number) => void
  setDecompositionItems: (items: DecompositionItem[]) => void
  saveDecomposition: (userId: string, sectionId: string) => Promise<void>
  loadDecomposition: (sectionId: string) => Promise<void>

  // Template actions
  fetchTemplates: (departmentId: string | null) => Promise<void>
  saveAsTemplate: (templateName: string, userId: string, departmentId: string) => Promise<void>
  loadFromTemplate: (templateId: string, userId: string | null, sectionId: string | null) => Promise<void>
  deleteTemplate: (templateId: string) => Promise<void>

  // Stages
  stages: DecompositionStage[]
  stageItems: DecompositionItem[]
  fetchStages: (sectionId: string) => Promise<void>
  createStage: (sectionId: string, payload: { name: string; description?: string | null; start?: string | null; finish?: string | null }) => Promise<void>
  updateStage: (stageId: string, patch: Partial<Omit<DecompositionStage, "decomposition_stage_id" | "decomposition_stage_section_id" | "decomposition_stage_order">>) => Promise<void>
  deleteStage: (stageId: string) => Promise<void>
  reorderStages: (orders: { stageId: string; order: number }[]) => Promise<void>
  fetchStageItems: (sectionId: string) => Promise<void>
  assignItemToStage: (itemId: string, stageId: string | null) => Promise<void>
}

export const useDecompositionStore = create<DecompositionStore>((set, get) => ({
  // UI State
  activeTab: "create",
  setActiveTab: (tab) => set({ activeTab: tab }),

  // Data
  sections: [],
  selectedSectionId: null,
  decompositionItems: [{ work_type: "", work_content: "", labor_costs: 0, duration_days: 0, execution_period: 0 }],
  templates: [],
  isLoading: false,
  error: null,

  // Stages
  stages: [],
  stageItems: [],

  // Actions
  fetchSections: async (userId) => {
    set({ isLoading: true, error: null })
    try {
      console.log("Fetching sections from Supabase for user ID:", userId)

      // Используем правильное поле section_responsible_id для фильтрации
      const { data, error } = await supabase
        .from("view_section_hierarchy_v2")
        .select("*")
        .eq("section_responsible_id", userId)

      if (error) {
        console.error("Supabase error:", error)
        throw error
      }

      console.log("Sections data received:", data ? data.length : 0, "records")
      set({ sections: data || [] })
    } catch (error) {
      console.error("Error fetching sections:", error)
      set({ error: (error as Error).message })
    } finally {
      set({ isLoading: false })
    }
  },

  selectSection: (sectionId) => {
    set({ selectedSectionId: sectionId })
    if (sectionId !== null) {
      get().loadDecomposition(sectionId)
    } else {
      // Если раздел не выбран, очищаем элементы декомпозиции
      set({
        decompositionItems: [
          { work_type: "", work_content: "", labor_costs: 0, duration_days: 0, execution_period: 0 },
        ],
      })
    }
  },

  addDecompositionItem: () => {
    set((state) => ({
      decompositionItems: [
        ...state.decompositionItems,
        { work_type: "", work_content: "", labor_costs: 0, duration_days: 0, execution_period: 0 },
      ],
    }))
  },

  updateDecompositionItem: (index, field, value) => {
    set((state) => {
      const newItems = [...state.decompositionItems]
      newItems[index] = { ...newItems[index], [field]: value }
      return { decompositionItems: newItems }
    })
  },

  removeDecompositionItem: (index) => {
    set((state) => ({
      decompositionItems: state.decompositionItems.filter((_, i) => i !== index),
    }))
  },

  setDecompositionItems: (items) => {
    set({ decompositionItems: items })
  },

  saveDecomposition: async (userId, sectionId) => {
    set({ isLoading: true, error: null })
    try {
      // Проверяем, существует ли уже декомпозиция для этого раздела
      const { data: existingData, error: fetchError } = await supabase
        .from("decompositions")
        .select("decomposition_id")
        .eq("decomposition_section_id", sectionId)
        .single()

      if (fetchError && fetchError.code !== "PGRST116") {
        // PGRST116 - "no rows returned"
        throw fetchError
      }

      const decompositionContent = get().decompositionItems

      if (existingData) {
        // Обновляем существующую декомпозицию
        const { error } = await supabase
          .from("decompositions")
          .update({
            decomposition_content: decompositionContent,
          })
          .eq("decomposition_id", existingData.decomposition_id)

        if (error) throw error
      } else {
        // Создаем новую декомпозицию
        const { error } = await supabase.from("decompositions").insert({
          decomposition_creator_id: userId,
          decomposition_section_id: sectionId,
          decomposition_content: decompositionContent,
        })

        if (error) throw error
      }
    } catch (error) {
      set({ error: (error as Error).message })
      console.error("Error saving decomposition:", error)
    } finally {
      set({ isLoading: false })
    }
  },

  loadDecomposition: async (sectionId) => {
    // Проверяем, что sectionId не null и не undefined
    if (!sectionId) {
      console.warn("Attempted to load decomposition with null or undefined sectionId")
      return
    }

    set({ isLoading: true, error: null })
    try {
      const { data, error } = await supabase
        .from("decompositions")
        .select("decomposition_content")
        .eq("decomposition_section_id", sectionId)
        .single()

      if (error && error.code !== "PGRST116") {
        // PGRST116 - "no rows returned"
        throw error
      }

      if (data && data.decomposition_content) {
        set({ decompositionItems: data.decomposition_content })
      } else {
        set({
          decompositionItems: [
            { work_type: "", work_content: "", labor_costs: 0, duration_days: 0, execution_period: 0 },
          ],
        })
      }
    } catch (error) {
      set({ error: (error as Error).message })
      console.error("Error loading decomposition:", error)
    } finally {
      set({ isLoading: false })
    }
  },

  // Новые методы для работы с шаблонами
  fetchTemplates: async (departmentId) => {
    set({ isLoading: true, error: null })
    try {
      console.log("Fetching templates for department:", departmentId)

      let query = supabase
        .from("decomposition_templates")
        .select(`
        decomposition_template_id,
        decomposition_template_name,
        decomposition_department_id,
        decomposition_template_creator_id,
        decomposition_template_created_at,
        decomposition_template_content,
        departments:decomposition_department_id(department_name),
        profiles:decomposition_template_creator_id(first_name, last_name)
      `)

      // Добавляем фильтр по departmentId если он предоставлен
      if (departmentId) {
        query = query.eq("decomposition_department_id", departmentId)
      }

      const { data, error } = await query.order("decomposition_template_created_at", { ascending: false })

      if (error) throw error

      // Преобразуем данные в нужный формат
      const templates = data.map((item) => {
        // Обработка даты для предотвращения ошибок
        let formattedDate = item.decomposition_template_created_at
        try {
          if (formattedDate) {
            // Убедимся, что дата в правильном формате
            const parsedDate = new Date(formattedDate)
            if (isNaN(parsedDate.getTime())) {
              console.warn("Invalid date detected:", formattedDate)
              formattedDate = null
            }
          }
        } catch (e) {
          console.error("Error parsing date:", e)
          formattedDate = null
        }

        return {
          decomposition_template_id: item.decomposition_template_id,
          decomposition_template_name: item.decomposition_template_name,
          decomposition_department_id: item.decomposition_department_id,
          department_name: (item.departments as any)?.department_name || undefined,
          decomposition_template_creator_id: item.decomposition_template_creator_id,
          creator_name: (item.profiles as any) ? `${(item.profiles as any).first_name} ${(item.profiles as any).last_name}` : undefined,
          decomposition_template_created_at: formattedDate,
          decomposition_template_content: item.decomposition_template_content,
        }
      })

      console.log("Templates loaded:", templates.length)
      set({ templates })
    } catch (error) {
      console.error("Error fetching templates:", error)
      set({ error: (error as Error).message })
    } finally {
      set({ isLoading: false })
    }
  },

  saveAsTemplate: async (templateName, userId, departmentId) => {
    set({ isLoading: true })
    try {
      const items = get().decompositionItems

      // Проверяем, что есть хотя бы один непустой элемент
      const hasValidItems = items.some((item) => item.work_type.trim() !== "" || item.work_content.trim() !== "")

      if (!hasValidItems) {
        throw new Error("Невозможно сохранить пустой шаблон")
      }

      // Проверяем уникальность имени шаблона
      const { data: existingTemplate, error: checkError } = await supabase
        .from("decomposition_templates")
        .select("decomposition_template_id")
        .eq("decomposition_template_name", templateName.trim())
        .maybeSingle()

      if (checkError) {
        throw checkError
      }

      if (existingTemplate) {
        throw new Error("Шаблон с таким названием уже существует. Выберите другое название.")
      }

      // Сохраняем шаблон
      const { error } = await supabase
        .from("decomposition_templates")
        .insert({
          decomposition_template_name: templateName.trim(),
          decomposition_department_id: departmentId,
          decomposition_template_creator_id: userId,
          decomposition_template_content: items,
        })

      if (error) throw error

      // Обновляем список шаблонов - теперь загружаем все шаблоны
      await get().fetchTemplates(null)
    } catch (error) {
      console.error("Error saving template:", error)
      throw error
    } finally {
      set({ isLoading: false })
    }
  },

  loadFromTemplate: async (templateId, userId, sectionId) => {
    set({ isLoading: true })
    try {
      // Проверяем, что у нас есть необходимые параметры
      if (!userId) {
        throw new Error("Не указан ID пользователя")
      }

      if (!sectionId) {
        throw new Error("Не выбран раздел для сохранения")
      }

      // Загружаем шаблон
      const { data, error } = await supabase
        .from("decomposition_templates")
        .select("decomposition_template_content")
        .eq("decomposition_template_id", templateId)
        .single()

      if (error) throw error

      if (data && data.decomposition_template_content) {
        // Обновляем состояние
        set({ decompositionItems: data.decomposition_template_content })

        // Автоматически сохраняем загруженные данные в таблицу decompositions
        console.log("Автоматическое сохранение данных из шаблона в decompositions")
        await get().saveDecomposition(userId, sectionId)
      }
    } catch (error) {
      console.error("Error loading template:", error)
      throw error
    } finally {
      set({ isLoading: false })
    }
  },

  // Новый метод для удаления шаблона
  deleteTemplate: async (templateId) => {
    set({ isLoading: true })
    try {
      // Удаляем шаблон
      const { error } = await supabase
        .from("decomposition_templates")
        .delete()
        .eq("decomposition_template_id", templateId)

      if (error) throw error

      // Обновляем список всех шаблонов
      await get().fetchTemplates(null)
    } catch (error) {
      console.error("Error deleting template:", error)
      throw error
    } finally {
      set({ isLoading: false })
    }
  },

  // ===== Stages CRUD and loading =====
  fetchStages: async (sectionId) => {
    if (!sectionId) return
    set({ isLoading: true, error: null })
    try {
      const { data, error } = await supabase
        .from("decomposition_stages")
        .select("*")
        .eq("decomposition_stage_section_id", sectionId)
        .order("decomposition_stage_order", { ascending: true })
        // .order("created_at", { ascending: true }) // created_at может отсутствовать

      if (error) throw error

      const stages: DecompositionStage[] = (data || []).map((row: any) => ({
        decomposition_stage_id: row.decomposition_stage_id,
        decomposition_stage_section_id: row.decomposition_stage_section_id,
        decomposition_stage_name: row.decomposition_stage_name,
        decomposition_stage_description: row.decomposition_stage_description ?? null,
        decomposition_stage_start: row.decomposition_stage_start ?? null,
        decomposition_stage_finish: row.decomposition_stage_finish ?? null,
        decomposition_stage_order: row.decomposition_stage_order ?? 0,
      }))

      set({ stages })
    } catch (error) {
      console.error("Error fetching stages:", error)
      set({ error: (error as Error).message })
    } finally {
      set({ isLoading: false })
    }
  },

  createStage: async (sectionId, payload) => {
    set({ isLoading: true, error: null })
    try {
      // Определяем следующий order
      const current = get().stages.filter((s) => s.decomposition_stage_section_id === sectionId)
      const nextOrder = current.length > 0 ? Math.max(...current.map((s) => s.decomposition_stage_order)) + 1 : 1

      const { error } = await supabase.from("decomposition_stages").insert({
        decomposition_stage_section_id: sectionId,
        decomposition_stage_name: payload.name,
        decomposition_stage_description: payload.description ?? null,
        decomposition_stage_start: payload.start ?? null,
        decomposition_stage_finish: payload.finish ?? null,
        decomposition_stage_order: nextOrder,
      })

      if (error) throw error

      await get().fetchStages(sectionId)
    } catch (error) {
      console.error("Error creating stage:", error)
      set({ error: (error as Error).message })
    } finally {
      set({ isLoading: false })
    }
  },

  updateStage: async (stageId, patch) => {
    set({ isLoading: true, error: null })
    try {
      const { error } = await supabase
        .from("decomposition_stages")
        .update({
          decomposition_stage_name: patch.decomposition_stage_name,
          decomposition_stage_description: patch.decomposition_stage_description,
          decomposition_stage_start: patch.decomposition_stage_start,
          decomposition_stage_finish: patch.decomposition_stage_finish,
        })
        .eq("decomposition_stage_id", stageId)

      if (error) throw error

      // Обновляем локально
      set((state) => ({
        stages: state.stages.map((s) =>
          s.decomposition_stage_id === stageId ? { ...s, ...patch } as DecompositionStage : s,
        ),
      }))
    } catch (error) {
      console.error("Error updating stage:", error)
      set({ error: (error as Error).message })
    } finally {
      set({ isLoading: false })
    }
  },

  deleteStage: async (stageId) => {
    set({ isLoading: true, error: null })
    try {
      // Освобождаем элементы
      const { error: updErr } = await supabase
        .from("decomposition_items")
        .update({ decomposition_item_stage_id: null })
        .eq("decomposition_item_stage_id", stageId)

      if (updErr) throw updErr

      const { error } = await supabase
        .from("decomposition_stages")
        .delete()
        .eq("decomposition_stage_id", stageId)

      if (error) throw error

      set((state) => ({ stages: state.stages.filter((s) => s.decomposition_stage_id !== stageId) }))
    } catch (error) {
      console.error("Error deleting stage:", error)
      set({ error: (error as Error).message })
    } finally {
      set({ isLoading: false })
    }
  },

  reorderStages: async (orders) => {
    set({ isLoading: true, error: null })
    try {
      for (const { stageId, order } of orders) {
        const { error } = await supabase
          .from("decomposition_stages")
          .update({ decomposition_stage_order: order })
          .eq("decomposition_stage_id", stageId)
        if (error) throw error
      }
      // Обновляем локально
      set((state) => ({
        stages: state.stages
          .map((s) => {
            const found = orders.find((o) => o.stageId === s.decomposition_stage_id)
            return found ? { ...s, decomposition_stage_order: found.order } : s
          })
          .sort((a, b) => a.decomposition_stage_order - b.decomposition_stage_order),
      }))
    } catch (error) {
      console.error("Error reordering stages:", error)
      set({ error: (error as Error).message })
    } finally {
      set({ isLoading: false })
    }
  },

  fetchStageItems: async (sectionId) => {
    if (!sectionId) return
    set({ isLoading: true, error: null })
    try {
      const { data, error } = await supabase
        .from("decomposition_items")
        .select(`
          decomposition_item_id,
          decomposition_item_section_id,
          decomposition_item_description,
          decomposition_item_planned_hours,
          decomposition_item_planned_due_date,
          decomposition_item_stage_id,
          decomposition_item_work_category_id,
          work_categories:decomposition_item_work_category_id(work_category_name)
        `)
        .eq("decomposition_item_section_id", sectionId)
        .order("decomposition_item_order", { ascending: true })

      if (error) throw error

      const items: DecompositionItem[] = (data || []).map((row: any) => ({
        id: row.decomposition_item_id,
        work_type: row?.work_categories?.work_category_name || "",
        work_content: row?.decomposition_item_description || "",
        complexity_level: "",
        labor_costs: Number(row?.decomposition_item_planned_hours) || 0,
        duration_days: 0,
        execution_period: 0,
        decomposition_item_stage_id: row?.decomposition_item_stage_id || null,
      }))

      set({ stageItems: items })
    } catch (error) {
      console.error("Error fetching stage items:", error)
      set({ error: (error as Error).message })
    } finally {
      set({ isLoading: false })
    }
  },

  assignItemToStage: async (itemId, stageId) => {
    set({ isLoading: true, error: null })
    try {
      const { error } = await supabase
        .from("decomposition_items")
        .update({ decomposition_item_stage_id: stageId })
        .eq("decomposition_item_id", itemId)

      if (error) throw error

      // Обновляем локально
      set((state) => ({
        stageItems: state.stageItems.map((it) =>
          it.id === itemId ? { ...it, decomposition_item_stage_id: stageId || null } : it,
        ),
      }))
    } catch (error) {
      console.error("Error assigning item to stage:", error)
      set({ error: (error as Error).message })
    } finally {
      set({ isLoading: false })
    }
  },
}))
