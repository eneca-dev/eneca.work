'use client'

import { useState } from 'react'
import { X, User, LogOut, LogIn, ChevronRight, RefreshCw } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useUserStore } from '@/stores/useUserStore'
import { createClient } from '@/utils/supabase/client'
import { cn } from '@/lib/utils'

export function DebugPanel() {
  const [isOpen, setIsOpen] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const router = useRouter()

  const { id, email, name, isAuthenticated, clearUser, setUser } = useUserStore()

  const handleLogout = async () => {
    setIsLoggingOut(true)
    try {
      const supabase = createClient()
      await supabase.auth.signOut()
      clearUser()
      router.push('/auth/login')
    } catch (error) {
      console.error('Logout error:', error)
    } finally {
      setIsLoggingOut(false)
    }
  }

  const handleLogin = () => {
    router.push('/auth/login?next=/resource-graph')
  }

  const handleRefresh = async () => {
    setIsRefreshing(true)
    try {
      const supabase = createClient()
      const { data: { user }, error } = await supabase.auth.getUser()

      if (error || !user) {
        console.error('Refresh error:', error)
        return
      }

      // Загружаем профиль
      const { data: userData } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single()

      const userName = userData
        ? [userData.first_name ?? '', userData.last_name ?? ''].filter(Boolean).join(' ')
        : ''
      const finalName = userName || user.email?.split('@')[0] || 'Пользователь'

      setUser({
        id: user.id,
        email: user.email ?? '',
        name: finalName,
        profile: userData || null,
      })

      console.log('User data refreshed:', { id: user.id, name: finalName })
    } catch (error) {
      console.error('Refresh error:', error)
    } finally {
      setIsRefreshing(false)
    }
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className={cn(
          'fixed bottom-4 right-4 z-50',
          'flex items-center gap-2 px-3 py-2',
          'bg-amber-500 hover:bg-amber-600 text-white',
          'rounded-lg shadow-lg',
          'text-xs font-medium',
          'transition-all duration-200',
          'border border-amber-600'
        )}
        title="Открыть панель дебага"
      >
        <User size={14} />
        Debug
        <ChevronRight size={14} />
      </button>
    )
  }

  return (
    <div
      className={cn(
        'fixed bottom-4 right-4 z-50',
        'w-80 bg-card border border-border rounded-lg shadow-2xl',
        'overflow-hidden'
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-amber-500 text-white">
        <div className="flex items-center gap-2">
          <User size={16} />
          <span className="font-semibold text-sm">Debug Panel</span>
        </div>
        <button
          onClick={() => setIsOpen(false)}
          className="hover:bg-amber-600 rounded p-1 transition-colors"
          title="Закрыть"
        >
          <X size={16} />
        </button>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        {/* User Info */}
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Пользователь
          </h3>

          {isAuthenticated ? (
            <div className="space-y-2 text-sm">
              <div className="flex items-start gap-2">
                <span className="text-muted-foreground min-w-16">Имя:</span>
                <span className="font-medium break-words">{name || 'Не указано'}</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-muted-foreground min-w-16">Email:</span>
                <span className="font-mono text-xs break-all">{email}</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-muted-foreground min-w-16">ID:</span>
                <span className="font-mono text-xs break-all">{id}</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-muted-foreground min-w-16">Статус:</span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-green-500/10 text-green-600 dark:text-green-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                  Авторизован
                </span>
              </div>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-red-500/10 text-red-600 dark:text-red-400">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                Не авторизован
              </span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="space-y-2 pt-2 border-t">
          {isAuthenticated ? (
            <>
              <button
                onClick={handleRefresh}
                disabled={isRefreshing}
                className={cn(
                  'w-full flex items-center justify-center gap-2 px-4 py-2.5',
                  'bg-amber-500 hover:bg-amber-600 text-white',
                  'rounded-md text-sm font-medium',
                  'transition-colors duration-200',
                  'disabled:opacity-50 disabled:cursor-not-allowed'
                )}
              >
                <RefreshCw size={16} className={cn(isRefreshing && 'animate-spin')} />
                {isRefreshing ? 'Обновление...' : 'Обновить данные'}
              </button>
              <button
                onClick={handleLogout}
                disabled={isLoggingOut}
                className={cn(
                  'w-full flex items-center justify-center gap-2 px-4 py-2.5',
                  'bg-red-500 hover:bg-red-600 text-white',
                  'rounded-md text-sm font-medium',
                  'transition-colors duration-200',
                  'disabled:opacity-50 disabled:cursor-not-allowed'
                )}
              >
                <LogOut size={16} />
                {isLoggingOut ? 'Выход...' : 'Выйти из аккаунта'}
              </button>
            </>
          ) : (
            <button
              onClick={handleLogin}
              className={cn(
                'w-full flex items-center justify-center gap-2 px-4 py-2.5',
                'bg-primary hover:bg-primary/90 text-primary-foreground',
                'rounded-md text-sm font-medium',
                'transition-colors duration-200'
              )}
            >
              <LogIn size={16} />
              Войти в аккаунт
            </button>
          )}
        </div>

        {/* Footer Info */}
        <div className="pt-2 border-t">
          <p className="text-xs text-muted-foreground text-center">
            Resource Graph Debug Panel
          </p>
        </div>
      </div>
    </div>
  )
}
