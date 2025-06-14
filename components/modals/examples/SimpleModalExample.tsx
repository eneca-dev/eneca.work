"use client"

import React from 'react'
import { Modal, useModalState } from '../index'

export function SimpleModalExample() {
  const { isOpen, openModal, closeModal } = useModalState()

  return (
    <>
      <button 
        onClick={openModal}
        className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
      >
        Открыть простое модальное окно
      </button>

      <Modal isOpen={isOpen} onClose={closeModal} size="md">
        <Modal.Header 
          title="Простое модальное окно" 
          subtitle="Пример базового использования"
          onClose={closeModal}
        />
        
        <Modal.Body>
          <p className="text-gray-600 dark:text-slate-400">
            Это пример простого модального окна с использованием композитного API.
            Модальное окно автоматически обрабатывает ESC, клики вне области и блокировку скролла.
          </p>
          
          <div className="mt-4 p-4 bg-gray-100 dark:bg-slate-700 rounded-lg">
            <h4 className="font-medium mb-2">Возможности:</h4>
            <ul className="text-sm space-y-1">
              <li>• Автоматическая блокировка скролла</li>
              <li>• Закрытие по ESC</li>
              <li>• Закрытие по клику вне области</li>
              <li>• Поддержка темной темы</li>
              <li>• Адаптивный дизайн</li>
            </ul>
          </div>
        </Modal.Body>
        
        <Modal.Footer>
          <button 
            onClick={closeModal}
            className="px-4 py-2 text-gray-600 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-200"
          >
            Отмена
          </button>
          <button 
            onClick={closeModal}
            className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg"
          >
            Понятно
          </button>
        </Modal.Footer>
      </Modal>
    </>
  )
} 