import { supabase, type SectionHierarchy } from "@/lib/supabase-client"
import type { Loading } from "../types"

export async function fetchSectionHierarchy(): Promise<SectionHierarchy[]> {
  try {
    const { data, error } = await supabase.from("view_section_hierarchy").select("*")

    if (error) {
      console.error("Ошибка при загрузке разделов:", error)
      throw error
    }

    return data || []
  } catch (error) {
    console.error("Ошибка при загрузке разделов:", error)
    return []
  }
}

// Функция для проверки наличия загрузок у раздела
export async function checkSectionHasLoadings(sectionId: string): Promise<boolean> {
  try {
    const { count, error } = await supabase
      .from("loadings")
      .select("loading_id", { count: "exact", head: true })
      .eq("loading_section", sectionId)

    if (error) {
      console.error("Ошибка при проверке загрузок:", error)
      throw error
    }

    return (count || 0) > 0
  } catch (error) {
    console.error("Ошибка при проверке загрузок:", error)
    return false
  }
}

// Функция для получения загрузок по разделу
export async function fetchSectionLoadings(sectionId: string): Promise<Loading[]> {
  try {
    const { data, error } = await supabase
      .from("loadings")
      .select(`
        loading_id,
        loading_responsible,
        profiles:loading_responsible (
          first_name,
          last_name
        ),
        loading_section,
        loading_start,
        loading_finish,
        loading_rate,
        loading_created,
        loading_updated
      `)
      .eq("loading_section", sectionId)

    if (error) {
      console.error("Ошибка при загрузке загрузок:", error)
      throw error
    }

    // Преобразуем данные для добавления имени ответственного
    return (data || []).map((item) => {
      const profile = item.profiles as { first_name: string; last_name: string } | null
      return {
        id: item.loading_id,
        responsibleId: item.loading_responsible,
        responsibleName: profile ? `${profile.first_name} ${profile.last_name}` : "Не указан",
        sectionId: item.loading_section,
        startDate: new Date(item.loading_start),
        endDate: new Date(item.loading_finish),
        rate: item.loading_rate || 1,
        createdAt: item.loading_created ? new Date(item.loading_created) : undefined,
        updatedAt: item.loading_updated ? new Date(item.loading_updated) : undefined,
      }
    })
  } catch (error) {
    console.error("Ошибка при загрузке загрузок:", error)
    return []
  }
}
