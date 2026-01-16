'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useUserStore } from '@/stores/useUserStore'
import { createClient } from '@/utils/supabase/client'

/**
 * UserSync - компонент для синхронизации данных пользователя
 * Автоматически загружает данные пользователя из Supabase при монтировании
 */
export function UserSync() {
  const router = useRouter()
  const isMounted = useRef(true)
  const hasInitialized = useRef(false)

  useEffect(() => {
    isMounted.current = true
    return () => {
      isMounted.current = false
    }
  }, [])

  useEffect(() => {
    // Запускаем синхронизацию только один раз
    if (hasInitialized.current) return
    hasInitialized.current = true

    const syncUser = async () => {
      if (!isMounted.current) return

      try {
        const supabase = createClient()
        const { data: { user }, error } = await supabase.auth.getUser()

        if (error) {
          console.error('UserSync: Ошибка при получении пользователя:', error)
          router.push('/auth/login')
          return
        }

        if (!user) {
          console.log('UserSync: Пользователь не авторизован')
          router.push('/auth/login')
          return
        }

        // Проверяем, нужно ли обновлять данные
        const userState = useUserStore.getState()
        const needsRefresh =
          !userState.id ||
          userState.id !== user.id ||
          !userState.profile ||
          !userState.name

        if (needsRefresh) {
          // Загружаем профиль пользователя
          const { data: userData, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('user_id', user.id)
            .single()

          if (profileError) {
            console.error('UserSync: Ошибка при получении профиля:', profileError)
          }

          // Формируем имя пользователя
          const userName = userData
            ? [userData.first_name ?? '', userData.last_name ?? ''].filter(Boolean).join(' ')
            : ''
          const finalName = userName || user.email?.split('@')[0] || 'Пользователь'

          // Обновляем store
          useUserStore.getState().setUser({
            id: user.id,
            email: user.email ?? '',
            name: finalName,
            profile: userData || null,
          })

          console.log('UserSync: Пользователь синхронизирован:', {
            id: user.id,
            email: user.email,
            name: finalName,
          })
        }
      } catch (error) {
        console.error('UserSync: Критическая ошибка при синхронизации:', error)
      }
    }

    syncUser()
  }, [router])

  // Этот компонент не рендерит ничего
  return null
}
