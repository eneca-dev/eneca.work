"use client"

import React, { useState } from 'react'
import { Modal, useModalState } from '../index'
import { Save, Loader2 } from 'lucide-react'

export function FormModalExample() {
  const { isOpen, openModal, closeModal } = useModalState()
  const [formData, setFormData] = useState({ name: '', email: '', message: '' })
  const [isLoading, setIsLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Простая валидация
    const newErrors: Record<string, string> = {}
    if (!formData.name.trim()) newErrors.name = 'Имя обязательно'
    if (!formData.email.trim()) newErrors.email = 'Email обязателен'
    if (!formData.message.trim()) newErrors.message = 'Сообщение обязательно'
    
    setErrors(newErrors)
    
    if (Object.keys(newErrors).length > 0) return
    
    setIsLoading(true)
    
    // Имитация отправки
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    setIsLoading(false)
    closeModal()
    
    // Сброс формы
    setFormData({ name: '', email: '', message: '' })
    setErrors({})
  }

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    // Очищаем ошибку при вводе
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }))
    }
  }

  return (
    <>
      <button 
        onClick={openModal}
        className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
      >
        Открыть форму
      </button>

      <Modal isOpen={isOpen} onClose={closeModal} size="lg">
        <Modal.Header 
          title="Обратная связь" 
          subtitle="Отправьте нам сообщение"
          onClose={closeModal}
        />
        
        <form onSubmit={handleSubmit}>
          <Modal.Body>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2 dark:text-slate-300">
                  Имя *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-slate-700 dark:text-white ${
                    errors.name ? 'border-red-500' : 'border-gray-300 dark:border-slate-600'
                  }`}
                  placeholder="Введите ваше имя"
                />
                {errors.name && (
                  <p className="text-red-500 text-sm mt-1">{errors.name}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-2 dark:text-slate-300">
                  Email *
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-slate-700 dark:text-white ${
                    errors.email ? 'border-red-500' : 'border-gray-300 dark:border-slate-600'
                  }`}
                  placeholder="Введите ваш email"
                />
                {errors.email && (
                  <p className="text-red-500 text-sm mt-1">{errors.email}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-2 dark:text-slate-300">
                  Сообщение *
                </label>
                <textarea
                  value={formData.message}
                  onChange={(e) => handleInputChange('message', e.target.value)}
                  rows={4}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-slate-700 dark:text-white ${
                    errors.message ? 'border-red-500' : 'border-gray-300 dark:border-slate-600'
                  }`}
                  placeholder="Введите ваше сообщение"
                />
                {errors.message && (
                  <p className="text-red-500 text-sm mt-1">{errors.message}</p>
                )}
              </div>
            </div>
          </Modal.Body>
          
          <Modal.Footer>
            <button 
              type="button"
              onClick={closeModal}
              disabled={isLoading}
              className="px-4 py-2 text-gray-600 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-200 disabled:opacity-50"
            >
              Отмена
            </button>
            <button 
              type="submit"
              disabled={isLoading}
              className="px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 dark:disabled:bg-slate-600 text-white rounded-lg flex items-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Отправка...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Отправить
                </>
              )}
            </button>
          </Modal.Footer>
        </form>
      </Modal>
    </>
  )
} 