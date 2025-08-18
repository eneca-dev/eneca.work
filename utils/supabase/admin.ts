import { createClient as createSupabaseClient } from "@supabase/supabase-js"

/**
 * Создает админский клиент Supabase с Service Role Key
 * Используется для операций, требующих админских прав, 
 * таких как создание пользователей через Admin API
 */
export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

  if (!supabaseUrl) {
    throw new Error("Отсутствует NEXT_PUBLIC_SUPABASE_URL в переменных окружения")
  }

  if (!serviceRoleKey) {
    throw new Error("Отсутствует SUPABASE_SERVICE_ROLE_KEY в переменных окружения")
  }

  return createSupabaseClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
}
