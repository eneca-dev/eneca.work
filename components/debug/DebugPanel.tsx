'use client'

/**
 * Debug Panel
 *
 * Плавающая панель для отладки. Позволяет:
 * - Переключать роли пользователя
 * - Просматривать логи
 * - Включать/выключать логирование
 *
 * Активируется только при NEXT_PUBLIC_DEBUG_MODE=true
 */

import { useEffect, useState, useCallback } from 'react'
import {
  Bug,
  X,
  ChevronDown,
  ChevronUp,
  Trash2,
  User,
  Users,
  Building2,
  FolderKanban,
  Shield,
  ScrollText,
  Settings,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useDebugStore, isDebugMode } from '@/stores/debug-store'
import {
  getLogHistory,
  clearLogHistory,
  isDebugEnabled,
  setDebugEnabled,
} from '@/lib/debug-logger'
import type { SystemRole } from '@/modules/filter-permissions'

interface LogEntry {
  timestamp: string
  level: 'info' | 'warn' | 'error' | 'debug'
  module: string
  message: string
  data?: unknown
}

const ROLE_OPTIONS: Array<{
  value: SystemRole
  label: string
  icon: React.ReactNode
  description: string
}> = [
  {
    value: 'admin',
    label: 'Администратор',
    icon: <Shield className="h-4 w-4" />,
    description: 'Полный доступ ко всем данным',
  },
  {
    value: 'subdivision_head',
    label: 'Нач. подразделения',
    icon: <Building2 className="h-4 w-4" />,
    description: 'Видит данные подразделения',
  },
  {
    value: 'department_head',
    label: 'Нач. отдела',
    icon: <Building2 className="h-4 w-4" />,
    description: 'Видит данные отдела',
  },
  {
    value: 'project_manager',
    label: 'Руководитель проекта',
    icon: <FolderKanban className="h-4 w-4" />,
    description: 'Видит данные своих проектов',
  },
  {
    value: 'team_lead',
    label: 'Тимлид',
    icon: <Users className="h-4 w-4" />,
    description: 'Видит данные своей команды',
  },
  {
    value: 'user',
    label: 'Сотрудник',
    icon: <User className="h-4 w-4" />,
    description: 'Видит только свои данные',
  },
]

function LogLevelBadge({ level }: { level: LogEntry['level'] }) {
  const variants: Record<LogEntry['level'], string> = {
    info: 'bg-blue-500/20 text-blue-400',
    warn: 'bg-yellow-500/20 text-yellow-400',
    error: 'bg-red-500/20 text-red-400',
    debug: 'bg-gray-500/20 text-gray-400',
  }

  return (
    <span className={`px-1.5 py-0.5 rounded text-xs font-mono ${variants[level]}`}>
      {level.toUpperCase()}
    </span>
  )
}

export function DebugPanel() {
  const [isMinimized, setIsMinimized] = useState(true)
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [activeTab, setActiveTab] = useState('roles')

  const {
    isPanelOpen,
    setIsPanelOpen,
    isLoggingEnabled,
    setLoggingEnabled,
    roleOverride,
    setRoleOverride,
    clearRoleOverride,
    actionHistory,
    clearHistory,
  } = useDebugStore()

  // Не рендерим если debug режим выключен
  if (!isDebugMode()) {
    return null
  }

  // Слушаем новые логи
  useEffect(() => {
    const handleLog = (event: CustomEvent<LogEntry>) => {
      setLogs((prev) => [event.detail, ...prev.slice(0, 99)])
    }

    window.addEventListener('debug-log', handleLog as EventListener)
    // Загружаем существующие логи
    setLogs(getLogHistory().reverse())

    return () => {
      window.removeEventListener('debug-log', handleLog as EventListener)
    }
  }, [])

  const handleRoleChange = useCallback(
    (role: SystemRole) => {
      if (role === 'admin') {
        // Для админа не нужны дополнительные данные
        setRoleOverride({ role })
      } else {
        // Для остальных ролей устанавливаем с пустыми ID
        // В реальном использовании можно добавить выбор конкретных ID
        setRoleOverride({ role })
      }
    },
    [setRoleOverride]
  )

  const handleClearLogs = useCallback(() => {
    clearLogHistory()
    setLogs([])
  }, [])

  // Минимизированная кнопка
  if (!isPanelOpen) {
    return (
      <Button
        variant="outline"
        size="icon"
        className="fixed bottom-4 right-4 z-[9999] h-12 w-12 rounded-full bg-amber-500 hover:bg-amber-600 border-amber-600 shadow-lg"
        onClick={() => setIsPanelOpen(true)}
      >
        <Bug className="h-6 w-6 text-black" />
      </Button>
    )
  }

  return (
    <div
      className={`fixed bottom-4 right-4 z-[9999] bg-zinc-900 border border-zinc-700 rounded-lg shadow-2xl transition-all duration-200 ${
        isMinimized ? 'w-80' : 'w-[500px]'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-700 bg-zinc-800 rounded-t-lg">
        <div className="flex items-center gap-2">
          <Bug className="h-4 w-4 text-amber-500" />
          <span className="text-sm font-semibold text-zinc-100">Debug Panel</span>
          {roleOverride && (
            <Badge variant="secondary" className="bg-amber-500/20 text-amber-400 text-xs">
              {ROLE_OPTIONS.find((r) => r.value === roleOverride.role)?.label}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-zinc-400 hover:text-zinc-100"
            onClick={() => setIsMinimized(!isMinimized)}
          >
            {isMinimized ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-zinc-400 hover:text-zinc-100"
            onClick={() => setIsPanelOpen(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Content */}
      {!isMinimized && (
        <div className="p-3">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="w-full bg-zinc-800 mb-3">
              <TabsTrigger value="roles" className="flex-1 text-xs">
                <Users className="h-3 w-3 mr-1" />
                Роли
              </TabsTrigger>
              <TabsTrigger value="logs" className="flex-1 text-xs">
                <ScrollText className="h-3 w-3 mr-1" />
                Логи
              </TabsTrigger>
              <TabsTrigger value="settings" className="flex-1 text-xs">
                <Settings className="h-3 w-3 mr-1" />
                Настройки
              </TabsTrigger>
            </TabsList>

            {/* Roles Tab */}
            <TabsContent value="roles" className="mt-0">
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-zinc-400 mb-1.5 block">
                    Эмулировать роль
                  </label>
                  <Select
                    value={roleOverride?.role || ''}
                    onValueChange={(value) => handleRoleChange(value as SystemRole)}
                  >
                    <SelectTrigger className="bg-zinc-800 border-zinc-700 text-zinc-100">
                      <SelectValue placeholder="Выберите роль..." />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-800 border-zinc-700">
                      {ROLE_OPTIONS.map((option) => (
                        <SelectItem
                          key={option.value}
                          value={option.value}
                          className="text-zinc-100 focus:bg-zinc-700"
                        >
                          <div className="flex items-center gap-2">
                            {option.icon}
                            <div>
                              <div>{option.label}</div>
                              <div className="text-xs text-zinc-500">
                                {option.description}
                              </div>
                            </div>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {roleOverride && (
                  <div className="p-2 bg-amber-500/10 border border-amber-500/30 rounded-md">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Shield className="h-4 w-4 text-amber-500" />
                        <span className="text-sm text-amber-400">
                          Роль переопределена
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs text-amber-400 hover:text-amber-300"
                        onClick={clearRoleOverride}
                      >
                        Сбросить
                      </Button>
                    </div>
                    <p className="text-xs text-zinc-400 mt-1">
                      Фильтры будут применяться как для роли:{' '}
                      <strong className="text-zinc-200">
                        {ROLE_OPTIONS.find((r) => r.value === roleOverride.role)?.label}
                      </strong>
                    </p>
                  </div>
                )}

                {/* Quick role buttons */}
                <div className="grid grid-cols-3 gap-2">
                  {ROLE_OPTIONS.slice(0, 6).map((option) => (
                    <Button
                      key={option.value}
                      variant={roleOverride?.role === option.value ? 'default' : 'outline'}
                      size="sm"
                      className={`text-xs h-8 ${
                        roleOverride?.role === option.value
                          ? 'bg-amber-500 hover:bg-amber-600 text-black'
                          : 'border-zinc-700 text-zinc-300 hover:bg-zinc-800'
                      }`}
                      onClick={() => handleRoleChange(option.value)}
                    >
                      {option.icon}
                      <span className="ml-1 truncate">{option.label.split(' ')[0]}</span>
                    </Button>
                  ))}
                </div>
              </div>
            </TabsContent>

            {/* Logs Tab */}
            <TabsContent value="logs" className="mt-0">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-400">
                    {logs.length} записей
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs text-zinc-400 hover:text-zinc-100"
                    onClick={handleClearLogs}
                  >
                    <Trash2 className="h-3 w-3 mr-1" />
                    Очистить
                  </Button>
                </div>

                <ScrollArea className="h-64 rounded border border-zinc-700 bg-zinc-950">
                  <div className="p-2 space-y-1 font-mono text-xs">
                    {logs.length === 0 ? (
                      <div className="text-zinc-500 text-center py-4">
                        Логи пусты
                      </div>
                    ) : (
                      logs.map((log, i) => (
                        <div
                          key={i}
                          className="flex items-start gap-2 py-1 border-b border-zinc-800 last:border-0"
                        >
                          <span className="text-zinc-600 shrink-0">
                            {log.timestamp}
                          </span>
                          <LogLevelBadge level={log.level} />
                          <span className="text-cyan-400 shrink-0">
                            [{log.module}]
                          </span>
                          <span className="text-zinc-300 break-all">
                            {log.message}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </div>
            </TabsContent>

            {/* Settings Tab */}
            <TabsContent value="settings" className="mt-0">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-zinc-100">Логирование</div>
                    <div className="text-xs text-zinc-500">
                      Записывать действия в консоль
                    </div>
                  </div>
                  <Switch
                    checked={isLoggingEnabled}
                    onCheckedChange={(checked) => {
                      setLoggingEnabled(checked)
                      setDebugEnabled(checked)
                    }}
                  />
                </div>

                <div className="border-t border-zinc-700 pt-3">
                  <div className="text-xs text-zinc-400 mb-2">
                    История действий ({actionHistory.length})
                  </div>
                  <ScrollArea className="h-32">
                    <div className="space-y-1">
                      {actionHistory.map((item, i) => (
                        <div key={i} className="text-xs text-zinc-500">
                          <span className="text-zinc-600">
                            {new Date(item.timestamp).toLocaleTimeString()}
                          </span>{' '}
                          <span className="text-zinc-300">{item.action}</span>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                  {actionHistory.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-xs text-zinc-400 mt-2"
                      onClick={clearHistory}
                    >
                      Очистить историю
                    </Button>
                  )}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      )}

      {/* Minimized state - just show role if overridden */}
      {isMinimized && roleOverride && (
        <div className="px-3 py-2 text-xs text-zinc-400">
          Активная роль:{' '}
          <span className="text-amber-400">
            {ROLE_OPTIONS.find((r) => r.value === roleOverride.role)?.label}
          </span>
        </div>
      )}
    </div>
  )
}
