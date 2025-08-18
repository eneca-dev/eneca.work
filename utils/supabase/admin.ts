import { createClient } from "@supabase/supabase-js"

/**
 * Создает admin клиент Supabase с service role key
 * Используется только для административных операций на сервере
 */
export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Отсутствуют необходимые переменные окружения для admin клиента')
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
} 