import * as Sentry from "@sentry/nextjs"
import { supabase, type SectionHierarchy } from "@/lib/supabase-client"
import type { Loading } from "../types"

export async function fetchSectionHierarchy(): Promise<SectionHierarchy[]> {
  return Sentry.startSpan(
    {
      op: "db.query",
      name: "Загрузка иерархии разделов",
    },
    async (span) => {
      try {
        span.setAttribute("table", "view_section_hierarchy_v2")

        const { data, error } = await supabase.from("view_section_hierarchy_v2").select("*")

        if (error) {
          span.setAttribute("db.success", false)
          span.setAttribute("db.error", error.message)
          
          Sentry.captureException(error, {
            tags: { 
              module: 'planning', 
              action: 'fetch_section_hierarchy',
              table: 'view_section_hierarchy_v2'
            },
            extra: {
              error_code: error.code,
              error_details: error.details,
              error_hint: error.hint,
              timestamp: new Date().toISOString()
            }
          })
          throw error
        }

        span.setAttribute("db.success", true)
        span.setAttribute("sections_count", data?.length || 0)
        
        return data || []
      } catch (error) {
        span.setAttribute("db.success", false)
        
        Sentry.captureException(error, {
          tags: { 
            module: 'planning', 
            action: 'fetch_section_hierarchy',
            error_type: 'unexpected_error'
          },
          extra: {
            timestamp: new Date().toISOString()
          }
        })
        return []
      }
    }
  )
}

// Функция для проверки наличия загрузок у раздела
export async function checkSectionHasLoadings(sectionId: string): Promise<boolean> {
  return Sentry.startSpan(
    {
      op: "db.query",
      name: "Проверка наличия загрузок у раздела",
    },
    async (span) => {
      try {
        span.setAttribute("table", "loadings")
        span.setAttribute("section_id", sectionId)
        
        const { count, error } = await supabase
          .from("loadings")
          .select("loading_id", { count: "exact", head: true })
          .eq("loading_section", sectionId)

        if (error) {
          span.setAttribute("db.success", false)
          span.setAttribute("db.error", error.message)
          
          Sentry.captureException(error, {
            tags: { 
              module: 'planning', 
              action: 'check_section_has_loadings',
              table: 'loadings'
            },
            extra: {
              section_id: sectionId,
              error_code: error.code,
              error_details: error.details,
              error_hint: error.hint,
              timestamp: new Date().toISOString()
            }
          })
          throw error
        }

        const hasLoadings = (count || 0) > 0
        span.setAttribute("db.success", true)
        span.setAttribute("loadings_count", count || 0)
        span.setAttribute("has_loadings", hasLoadings)
        
        return hasLoadings
      } catch (error) {
        span.setAttribute("db.success", false)
        
        Sentry.captureException(error, {
          tags: { 
            module: 'planning', 
            action: 'check_section_has_loadings',
            error_type: 'unexpected_error'
          },
          extra: {
            section_id: sectionId,
            timestamp: new Date().toISOString()
          }
        })
        return false
      }
    }
  )
}

// Функция для получения загрузок по разделу
export async function fetchSectionLoadings(sectionId: string): Promise<Loading[]> {
  return Sentry.startSpan(
    {
      op: "db.query",
      name: "Загрузка загрузок по разделу",
    },
    async (span) => {
      try {
        span.setAttribute("table", "loadings")
        span.setAttribute("section_id", sectionId)
        
        const { data, error } = await supabase
          .from("loadings")
          .select(`
            loading_id,
            loading_responsible,
            loading_stage,
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
          span.setAttribute("db.success", false)
          span.setAttribute("db.error", error.message)
          
          Sentry.captureException(error, {
            tags: { 
              module: 'planning', 
              action: 'fetch_section_loadings',
              table: 'loadings'
            },
            extra: {
              section_id: sectionId,
              error_code: error.code,
              error_details: error.details,
              error_hint: error.hint,
              timestamp: new Date().toISOString()
            }
          })
          throw error
        }

        // Преобразуем данные для добавления имени ответственного
        const loadings = (data || []).map((item) => {
          const profile = Array.isArray(item.profiles) 
            ? item.profiles[0] as { first_name: string; last_name: string } | null 
            : item.profiles as { first_name: string; last_name: string } | null
          
          return {
            id: item.loading_id,
            responsibleId: item.loading_responsible,
            responsibleName: profile ? `${profile.first_name} ${profile.last_name}` : "Не указан",
            sectionId: item.loading_section,
            stageId: item.loading_stage ?? null,
            startDate: new Date(item.loading_start),
            endDate: new Date(item.loading_finish),
            rate: item.loading_rate || 1,
            createdAt: item.loading_created ? new Date(item.loading_created) : new Date(),
            updatedAt: item.loading_updated ? new Date(item.loading_updated) : new Date(),
          }
        })
        
        span.setAttribute("db.success", true)
        span.setAttribute("loadings_count", loadings.length)
        
        return loadings
      } catch (error) {
        span.setAttribute("db.success", false)
        
        Sentry.captureException(error, {
          tags: { 
            module: 'planning', 
            action: 'fetch_section_loadings',
            error_type: 'unexpected_error'
          },
          extra: {
            section_id: sectionId,
            timestamp: new Date().toISOString()
          }
        })
        return []
      }
    }
  )
}
