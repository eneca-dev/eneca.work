import { createClient } from "@supabase/supabase-js"
import type { Database } from "./types"

// Используем переменные окружения для подключения к Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Создаем клиент Supabase
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey)
