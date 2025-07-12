import React from 'react'
import { RefreshCw, FileText, AlertCircle, CheckCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useWorksectionSync } from '@/hooks/useWorksectionSync'
import { Modal, ModalButton, useModalState } from '@/components/modals'

interface SyncButtonProps {
  className?: string
  size?: 'sm' | 'md' | 'lg'
  variant?: 'default' | 'outline' | 'ghost'
  showText?: boolean
  onSyncComplete?: () => void
  theme?: 'light' | 'dark'
}

export function SyncButton({ 
  className,
  size = 'md',
  variant = 'default',
  showText = true,
  onSyncComplete,
  theme = 'light'
}: SyncButtonProps) {
  const { isSyncing, syncStatus, syncWithWorksection, lastSyncResult } = useWorksectionSync()
  const { isOpen, openModal, closeModal } = useModalState()

  const handleSync = async () => {
    try {
      const result = await syncWithWorksection()
      
      if (result) {
        // Сразу показываем модальное окно с детальным отчётом
        openModal()
        
        // Вызываем колбэк если передан
        onSyncComplete?.()
      }
      
    } catch (error) {
      // Показываем модальное окно с ошибкой
      openModal()
    }
  }

  const sizeClasses = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-1.5 text-xs',
    lg: 'px-4 py-2 text-sm'
  }

  const iconSizes = {
    sm: 12,
    md: 14,
    lg: 16
  }

  const getVariantClasses = () => {
    const baseClasses = "flex items-center gap-1 rounded-md font-medium transition-all duration-200 disabled:cursor-not-allowed"
    
    if (syncStatus === 'success' && !isSyncing) {
      return `${baseClasses} bg-green-100 text-green-700 border border-green-200`
    }
    
    if (syncStatus === 'error' && !isSyncing) {
      return `${baseClasses} bg-red-100 text-red-700 border border-red-200`
    }
    
    if (isSyncing) {
      return `${baseClasses} ${
        theme === 'dark'
          ? "bg-blue-500/10 text-blue-400 border border-blue-500/20"
          : "bg-blue-25 text-blue-500 border border-blue-100"
      }`
    }
    
    // Обычное состояние
    switch (variant) {
      case 'outline':
        return `${baseClasses} border ${
          theme === 'dark'
            ? "border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
            : "border-blue-200 text-blue-600 hover:bg-blue-50"
        }`
      case 'ghost':
        return `${baseClasses} ${
          theme === 'dark'
            ? "text-blue-400 hover:bg-blue-500/10"
            : "text-blue-600 hover:bg-blue-50"
        }`
      default:
        return `${baseClasses} ${
          theme === 'dark'
            ? "bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 border border-blue-500/30"
            : "bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200"
        }`
    }
  }

  const formatDuration = (ms: number): string => {
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    if (minutes > 0) {
      return `${minutes}м ${seconds % 60}с`
    }
    return `${seconds}с`
  }

  const renderSyncModal = () => {
    if (!lastSyncResult) return null

    const { success, summary, issues, logs, metadata } = lastSyncResult

    return (
      <Modal isOpen={isOpen} onClose={closeModal} size="xl">
        <Modal.Header 
          title={
            <div className="flex items-center gap-2">
              {success ? (
                <CheckCircle className="text-green-600" size={20} />
              ) : (
                <AlertCircle className="text-red-600" size={20} />
              )}
              Отчёт о синхронизации
            </div>
          }
          subtitle={metadata?.timestamp ? `Завершено ${new Date(metadata.timestamp).toLocaleString('ru-RU')}` : 'Завершено'}
        />
        
        <Modal.Body>
          <div className="space-y-4">
            {/* Краткая статистика */}
            <div className="bg-slate-50 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-slate-800">📊 Результат синхронизации</h4>
                <div className="text-sm text-slate-600">
                  {metadata?.duration_ms ? formatDuration(metadata.duration_ms) : 'Н/Д'}
                </div>
              </div>
              <div className="grid grid-cols-4 gap-4 mt-3">
                <div className="text-center">
                  <div className="text-xl font-bold text-green-600">{summary?.created || 0}</div>
                  <div className="text-xs text-slate-600">Создано</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-bold text-blue-600">{summary?.updated || 0}</div>
                  <div className="text-xs text-slate-600">Обновлено</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-bold text-slate-600">{summary?.unchanged || 0}</div>
                  <div className="text-xs text-slate-600">Без изменений</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-bold text-red-600">{summary?.errors || 0}</div>
                  <div className="text-xs text-slate-600">Ошибки</div>
                </div>
              </div>
            </div>

            {/* Подробности изменений (только если есть) */}
            {logs && logs.length > 0 && ((summary?.created || 0) > 0 || (summary?.updated || 0) > 0 || (summary?.errors || 0) > 0) && (
              <div className="bg-slate-50 rounded-lg p-4">
                <h4 className="font-medium text-slate-800 mb-3">📋 Детали изменений</h4>
                <div className="bg-white rounded p-3 max-h-48 overflow-y-auto border">
                  <div className="text-sm space-y-1">
                    {logs.filter(log => 
                      log.includes('создано') || 
                      log.includes('обновлено') || 
                      log.includes('ошибка') ||
                      log.includes('Создан') ||
                      log.includes('Обновлен') ||
                      log.includes('❌') ||
                      log.includes('✅') ||
                      log.includes('📝')
                    ).slice(-15).map((log, index) => (
                      <div key={index} className="font-mono text-slate-700 text-xs">
                        {log.replace(/^\[.*?\]\s*/, '')}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Ошибки */}
            {issues?.critical_errors?.length > 0 && (
              <div className="bg-red-50 rounded-lg p-4">
                <h4 className="font-medium text-red-800 mb-2 flex items-center gap-2">
                  <AlertCircle size={16} />
                  Ошибки ({issues.critical_errors.length})
                </h4>
                <div className="space-y-1">
                  {issues.critical_errors.map((error, index) => (
                    <div key={index} className="text-sm text-red-700">
                      • {error}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Предупреждения */}
            {issues?.warnings?.length > 0 && (
              <div className="bg-amber-50 rounded-lg p-4">
                <h4 className="font-medium text-amber-800 mb-2 flex items-center gap-2">
                  <AlertCircle size={16} />
                  Предупреждения ({issues.warnings.length})
                </h4>
                <div className="space-y-1">
                  {issues.warnings.slice(0, 3).map((warning, index) => (
                    <div key={index} className="text-sm text-amber-700">
                      • {warning}
                    </div>
                  ))}
                  {issues.warnings.length > 3 && (
                    <div className="text-sm text-amber-600 italic">
                      ... и ещё {issues.warnings.length - 3} предупреждений
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </Modal.Body>
        
        <Modal.Footer>
          <ModalButton variant="cancel" onClick={closeModal}>
            Закрыть
          </ModalButton>
          {((summary?.created || 0) > 0 || (summary?.updated || 0) > 0) && (
            <ModalButton 
              variant="success" 
              onClick={() => {
                closeModal()
                window.location.reload()
              }}
            >
              Обновить страницу
            </ModalButton>
          )}
        </Modal.Footer>
      </Modal>
    )
  }

  return (
    <>
      <button
        onClick={handleSync}
        disabled={isSyncing}
        title="Синхронизировать данные с Worksection"
        className={cn(
          getVariantClasses(),
          sizeClasses[size],
          className
        )}
      >
        <RefreshCw 
          size={iconSizes[size]} 
          className={cn(
            isSyncing && "animate-spin"
          )} 
        />
        {showText && (
          isSyncing ? 'Синхронизация...' : 'Синхронизировать с Worksection'
        )}
      </button>
      
      {renderSyncModal()}
    </>
  )
} 