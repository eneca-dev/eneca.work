import { create } from "zustand"
import type { DecompositionItem, DecompositionTemplate, SectionHierarchy, TabType } from "./types"
import { supabase } from "./utils"

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

  // Actions
  fetchSections: async (userId) => {
    set({ isLoading: true, error: null })
    try {
      console.log("Fetching sections from Supabase for user ID:", userId)

      // Используем правильное поле section_responsible_id для фильтрации
      const { data, error } = await supabase
        .from("view_section_hierarchy")
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
}))
