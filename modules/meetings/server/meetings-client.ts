import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// Серверный клиент к Supabase-проекту meetings (отдельный от основного).
// Использует service-role ключ — ТОЛЬКО на сервере (импортировать лишь из 'use server' actions).
// Никогда не импортировать в клиентские компоненты.
// Гард: ключ не NEXT_PUBLIC (в клиентский бандл его значение не попадёт), плюс явная проверка ниже.

let cached: SupabaseClient | null = null

export function getMeetingsClient(): SupabaseClient {
  if (typeof window !== 'undefined') {
    throw new Error('getMeetingsClient можно вызывать только на сервере')
  }

  const url = process.env.MEETINGS_SUPABASE_URL
  const serviceKey = process.env.MEETINGS_SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceKey) {
    throw new Error(
      'Не заданы MEETINGS_SUPABASE_URL / MEETINGS_SUPABASE_SERVICE_ROLE_KEY в окружении',
    )
  }

  if (!cached) {
    cached = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  }
  return cached
}
