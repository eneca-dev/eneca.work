'use client'

import React, { useState, useEffect } from 'react'
import { Calendar, Download, FileText, TrendingUp, AlertCircle, CheckCircle, Clock, Activity } from 'lucide-react'
import { Modal, ModalButton, useModalState } from '@/components/modals'

interface SyncReport {
  filename: string
  created_at: string
  size: number
  path: string
}

interface SyncReportDetails {
  success: boolean
  duration: string
  summary: {
    total_operations: number
    created: number
    updated: number
    unchanged: number
    errors: number
    warnings: number
    critical_errors: number
    performance: number
  }
  details: {
    projects?: any
    stages?: any
    objects?: any
    sections?: any
  }
  issues: {
    warnings: string[]
    critical_errors: string[]
  }
  logs: string[]
  metadata: {
    timestamp: string
    duration_ms: number
    environment: any
    configuration: any
  }
  report_metadata: {
    generated_at: string
    report_type: string
    version: string
  }
}

interface SyncReportsViewerProps {
  className?: string
}

export function SyncReportsViewer({ className }: SyncReportsViewerProps) {
  const [reports, setReports] = useState<SyncReport[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedReport, setSelectedReport] = useState<SyncReportDetails | null>(null)
  const [error, setError] = useState<string | null>(null)
  
  const { isOpen, openModal, closeModal } = useModalState()

  useEffect(() => {
    fetchReports()
  }, [])

  const fetchReports = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const integrationUrl = process.env.NEXT_PUBLIC_WS_INTEGRATION_URL || 'https://ws-to-work-integration-eneca-7cab192e5438.herokuapp.com'
      
      const response = await fetch(`${integrationUrl}/api/reports/list`)
      
      if (!response.ok) {
        // Специальная обработка 404 - API отчётов ещё не задеплоено
        if (response.status === 404) {
          throw new Error('API_NOT_DEPLOYED')
        }
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const data = await response.json()
      
      if (data.success) {
        setReports(data.reports)
      } else {
        throw new Error(data.error || 'Неизвестная ошибка')
      }
      
    } catch (err) {
      if (err instanceof Error && err.message === 'API_NOT_DEPLOYED') {
        setError('API_NOT_DEPLOYED')
      } else {
        setError(err instanceof Error ? err.message : 'Неизвестная ошибка')
      }
    } finally {
      setLoading(false)
    }
  }

  const downloadReport = async (filename: string) => {
    try {
      const integrationUrl = process.env.NEXT_PUBLIC_WS_INTEGRATION_URL || 'https://ws-to-work-integration-eneca-7cab192e5438.herokuapp.com'
      
      const response = await fetch(`${integrationUrl}/api/reports/download/${filename}`)
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      
    } catch (err) {
      alert(`Ошибка загрузки отчёта: ${err instanceof Error ? err.message : 'Неизвестная ошибка'}`)
    }
  }

  const viewReport = async (filename: string) => {
    try {
      const integrationUrl = process.env.NEXT_PUBLIC_WS_INTEGRATION_URL || 'https://ws-to-work-integration-eneca-7cab192e5438.herokuapp.com'
      
      const response = await fetch(`${integrationUrl}/api/reports/download/${filename}`)
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const reportData: SyncReportDetails = await response.json()
      setSelectedReport(reportData)
      openModal()
      
    } catch (err) {
      alert(`Ошибка просмотра отчёта: ${err instanceof Error ? err.message : 'Неизвестная ошибка'}`)
    }
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const formatDuration = (ms: number): string => {
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    if (minutes > 0) {
      return `${minutes}м ${seconds % 60}с`
    }
    return `${seconds}с`
  }

  const getSuccessRate = (report: SyncReportDetails): number => {
    const { total_operations, errors } = report.summary
    if (total_operations === 0) return 0
    return ((total_operations - errors) / total_operations) * 100
  }

  const renderReportModal = () => {
    if (!selectedReport) return null

    const { success, summary, issues, logs, metadata } = selectedReport
    const successRate = getSuccessRate(selectedReport)

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
              Подробный отчёт о синхронизации
            </div>
          }
          subtitle={`Создан ${new Date(metadata.timestamp).toLocaleString('ru-RU')}`}
        />
        
        <Modal.Body>
          <div className="space-y-6">
            {/* Общие метрики */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-blue-50 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-blue-600">{summary.total_operations}</div>
                <div className="text-sm text-blue-700">Всего операций</div>
              </div>
              <div className="bg-green-50 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-green-600">{successRate.toFixed(1)}%</div>
                <div className="text-sm text-green-700">Успешность</div>
              </div>
              <div className="bg-purple-50 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-purple-600">{summary.performance.toFixed(1)}</div>
                <div className="text-sm text-purple-700">Оп/сек</div>
              </div>
              <div className="bg-slate-50 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-slate-600">
                  {formatDuration(metadata.duration_ms)}
                </div>
                <div className="text-sm text-slate-700">Длительность</div>
              </div>
            </div>

            {/* Детальная статистика */}
            <div className="bg-slate-50 rounded-lg p-4">
              <h4 className="font-medium text-slate-800 mb-3">📊 Детальная статистика</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-xl font-bold text-green-600">{summary.created}</div>
                  <div className="text-sm text-slate-600">Создано</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-bold text-blue-600">{summary.updated}</div>
                  <div className="text-sm text-slate-600">Обновлено</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-bold text-slate-600">{summary.unchanged}</div>
                  <div className="text-sm text-slate-600">Без изменений</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-bold text-red-600">{summary.errors}</div>
                  <div className="text-sm text-slate-600">Ошибки</div>
                </div>
              </div>
            </div>

            {/* Проблемы */}
            {(issues.warnings.length > 0 || issues.critical_errors.length > 0) && (
              <div className="space-y-3">
                {issues.warnings.length > 0 && (
                  <div className="bg-amber-50 rounded-lg p-4">
                    <h4 className="font-medium text-amber-800 mb-2 flex items-center gap-2">
                      <AlertCircle size={16} />
                      Предупреждения ({issues.warnings.length})
                    </h4>
                    <div className="space-y-1">
                      {issues.warnings.map((warning, index) => (
                        <div key={index} className="text-sm text-amber-700">
                          • {warning}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {issues.critical_errors.length > 0 && (
                  <div className="bg-red-50 rounded-lg p-4">
                    <h4 className="font-medium text-red-800 mb-2 flex items-center gap-2">
                      <AlertCircle size={16} />
                      Критические ошибки ({issues.critical_errors.length})
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
              </div>
            )}

            {/* Лог */}
            <div className="bg-slate-900 rounded-lg p-4">
              <h4 className="font-medium text-slate-200 mb-3 flex items-center gap-2">
                <FileText size={16} />
                Лог синхронизации
              </h4>
              <div className="bg-slate-800 rounded p-3 max-h-48 overflow-y-auto">
                <div className="text-sm font-mono text-slate-300 space-y-1">
                  {logs.slice(-15).map((log, index) => (
                    <div key={index} className="whitespace-pre-wrap text-xs">
                      {log}
                    </div>
                  ))}
                  {logs.length > 15 && (
                    <div className="text-slate-500 text-xs italic">
                      ... показаны последние 15 из {logs.length} записей
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </Modal.Body>
        
        <Modal.Footer>
          <ModalButton variant="cancel" onClick={closeModal}>
            Закрыть
          </ModalButton>
        </Modal.Footer>
      </Modal>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="flex items-center gap-2 text-slate-600">
          <Activity className="animate-spin" size={20} />
          Загрузка отчётов...
        </div>
      </div>
    )
  }

  if (error) {
    if (error === 'API_NOT_DEPLOYED') {
      return (
        <div className="bg-blue-50 rounded-lg p-6 text-center">
          <div className="flex items-center justify-center gap-2 text-blue-800 mb-3">
            <FileText size={24} />
            <h3 className="text-lg font-medium">Отчёты о синхронизации</h3>
          </div>
          <div className="text-blue-700 mb-4">
            <p className="mb-2">🚀 Функция отчётов в разработке!</p>
            <p className="text-sm">API для просмотра отчётов ещё не задеплоен на сервер интеграции.</p>
          </div>
          <div className="bg-blue-100 rounded-lg p-4 text-sm text-blue-700">
            <p className="font-medium mb-2">Что делать:</p>
            <ul className="text-left space-y-1">
              <li>• Синхронизация работает - можете использовать кнопку "Синхронизировать с Worksection"</li>
              <li>• Детальные отчёты будут доступны после обновления сервера</li>
              <li>• Следите за обновлениями системы</li>
            </ul>
          </div>
          <button
            onClick={fetchReports}
            className="mt-4 px-4 py-2 bg-blue-100 text-blue-700 rounded text-sm hover:bg-blue-200"
          >
            Проверить снова
          </button>
        </div>
      )
    }
    
    return (
      <div className="bg-red-50 rounded-lg p-4">
        <div className="flex items-center gap-2 text-red-800">
          <AlertCircle size={20} />
          Ошибка загрузки отчётов: {error}
        </div>
        <button
          onClick={fetchReports}
          className="mt-2 px-3 py-1 bg-red-100 text-red-700 rounded text-sm hover:bg-red-200"
        >
          Попробовать снова
        </button>
      </div>
    )
  }

  return (
    <>
      <div className={`space-y-4 ${className}`}>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-slate-800">
            📊 История синхронизации
          </h3>
          <button
            onClick={fetchReports}
            className="flex items-center gap-1 px-3 py-1 bg-blue-50 text-blue-600 rounded text-sm hover:bg-blue-100"
          >
            <Activity size={14} />
            Обновить
          </button>
        </div>

        {reports.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            <FileText size={48} className="mx-auto mb-2 text-slate-300" />
            <p>Отчёты о синхронизации не найдены</p>
          </div>
        ) : (
          <div className="space-y-2">
            {reports.map((report, index) => (
              <div
                key={report.filename}
                className="bg-white rounded-lg border border-slate-200 p-4 hover:border-slate-300 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                      <FileText className="text-blue-600" size={20} />
                    </div>
                    <div>
                      <div className="font-medium text-slate-800">
                        Синхронизация #{reports.length - index}
                      </div>
                      <div className="text-sm text-slate-500 flex items-center gap-4">
                        <span className="flex items-center gap-1">
                          <Calendar size={14} />
                          {new Date(report.created_at).toLocaleString('ru-RU')}
                        </span>
                        <span className="flex items-center gap-1">
                          <TrendingUp size={14} />
                          {formatFileSize(report.size)}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => viewReport(report.filename)}
                      className="flex items-center gap-1 px-3 py-1 bg-slate-100 text-slate-700 rounded text-sm hover:bg-slate-200"
                    >
                      <FileText size={14} />
                      Просмотреть
                    </button>
                    <button
                      onClick={() => downloadReport(report.filename)}
                      className="flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-700 rounded text-sm hover:bg-blue-200"
                    >
                      <Download size={14} />
                      Скачать
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      
      {renderReportModal()}
    </>
  )
} 