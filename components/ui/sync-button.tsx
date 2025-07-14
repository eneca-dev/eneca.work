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

    const { success, summary, detailed_report, duration } = lastSyncResult

    // Используем правильные данные из summary.total
    const totalCreated = summary?.total?.created || 0
    const totalUpdated = summary?.total?.updated || 0
    const totalUnchanged = summary?.total?.unchanged || 0
    const totalErrors = summary?.total?.errors || 0
    const totalSkipped = summary?.total?.skipped || 0

    // Если нет detailed_report, используем основные данные
    const assignmentSuccess = detailed_report?.assignment_summary?.successful_assignments || summary?.assignments?.successful || 0
    const assignmentTotal = detailed_report?.assignment_summary?.total_assignments_attempted || summary?.assignments?.attempted || 0
    const assignmentRate = detailed_report?.assignment_summary?.success_rate || (assignmentTotal > 0 ? ((assignmentSuccess / assignmentTotal) * 100).toFixed(1) : '0.0')

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
          subtitle={detailed_report?.sync_summary?.timestamp ? `Завершено ${new Date(detailed_report.sync_summary.timestamp).toLocaleString('ru-RU')}` : 'Завершено'}
        />
        
        <Modal.Body>
          <div className="space-y-4">
            {/* Краткая статистика */}
            <div className="bg-slate-50 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-slate-800">📊 Результат синхронизации</h4>
                <div className="text-sm text-slate-600">
                  {detailed_report?.sync_summary?.duration_readable || (duration ? formatDuration(duration) : 'Н/Д')}
                </div>
              </div>
              <div className="grid grid-cols-4 gap-4 mt-3">
                <div className="text-center">
                  <div className="text-xl font-bold text-green-600">{totalCreated}</div>
                  <div className="text-xs text-slate-600">Создано</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-bold text-blue-600">{totalUpdated}</div>
                  <div className="text-xs text-slate-600">Обновлено</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-bold text-slate-600">{totalUnchanged}</div>
                  <div className="text-xs text-slate-600">Без изменений</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-bold text-red-600">{totalErrors}</div>
                  <div className="text-xs text-slate-600">Ошибки</div>
                </div>
              </div>
              {totalSkipped > 0 && (
                <div className="mt-3 text-center">
                  <div className="text-sm text-amber-600">
                    🚫 Пропущено записей: <span className="font-semibold">{totalSkipped}</span> (начинаются с "!")
                  </div>
                </div>
              )}
            </div>

            {/* Статистика назначений */}
            {assignmentTotal > 0 && (
              <div className="bg-blue-50 rounded-lg p-4">
                <h4 className="font-medium text-blue-800 mb-2">👤 Назначения ответственных</h4>
                <div className="flex items-center justify-between">
                  <div className="text-sm text-blue-700">
                    Успешных: <span className="font-semibold">{assignmentSuccess}</span> из <span className="font-semibold">{assignmentTotal}</span>
                  </div>
                  <div className="text-sm font-semibold text-blue-700">
                    {assignmentRate}% успеха
                  </div>
                </div>
              </div>
            )}

            {/* Подробности изменений (только если есть) */}
            {detailed_report?.all_actions && detailed_report.all_actions.length > 0 && (totalCreated > 0 || totalUpdated > 0 || totalErrors > 0) && (
              <div className="bg-slate-50 rounded-lg p-4">
                <h4 className="font-medium text-slate-800 mb-3">📋 Детали изменений</h4>
                <div className="bg-white rounded p-3 max-h-48 overflow-y-auto border">
                  <div className="text-sm space-y-1">
                    {detailed_report.all_actions.filter(action => 
                      action.action === 'created' || 
                      action.action === 'updated' || 
                      action.action === 'error'
                    ).slice(-15).map((action, index) => (
                      <div key={index} className="font-mono text-slate-700 text-xs">
                        {action.action === 'created' && '🆕 Создан'}
                        {action.action === 'updated' && '🔄 Обновлен'}
                        {action.action === 'error' && '❌ Ошибка'}
                        {' '}
                        {action.type === 'project' && '📋 проект'}
                        {action.type === 'stage' && '🎯 стадия'}
                        {action.type === 'object' && '📦 объект'}
                        {action.type === 'section' && '📑 раздел'}
                        {' '}
                        <span className="font-semibold">{action.name}</span>
                        {action.responsible_assigned && ' (назначен ответственный)'}
                        {action.manager_assigned && ' (назначен менеджер)'}
                        {action.error && ` - ${action.error}`}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Рекомендации по улучшению */}
            {detailed_report?.user_search_analysis?.recommendations && detailed_report.user_search_analysis.recommendations.length > 0 && (
              <div className="bg-amber-50 rounded-lg p-4">
                <h4 className="font-medium text-amber-800 mb-2 flex items-center gap-2">
                  <AlertCircle size={16} />
                  Рекомендации по улучшению
                </h4>
                <div className="space-y-1">
                  {detailed_report.user_search_analysis.recommendations.map((rec, index) => (
                    <div key={index} className="text-sm text-amber-700">
                      • {rec}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Modal.Body>
        
        <Modal.Footer>
          <ModalButton variant="cancel" onClick={closeModal}>
            Закрыть
          </ModalButton>
          {(totalCreated > 0 || totalUpdated > 0) && (
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