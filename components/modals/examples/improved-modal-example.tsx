"use client"

import React from 'react'
import { Modal, ModalButton, useModalState } from '@/components/modals'
import { Save, User, Settings, Trash2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export function ImprovedModalExample() {
  const { isOpen, openModal, closeModal } = useModalState()

  return (
    <div className="p-8 space-y-4">
      <h1 className="text-2xl font-bold">Улучшенные модальные окна</h1>
      
      <div className="space-y-2">
        <p className="text-gray-600">Новый дизайн модальных окон включает:</p>
        <ul className="list-disc list-inside space-y-1 text-sm text-gray-600">
          <li>Современные тени и скругления</li>
          <li>Улучшенная типографика и отступы</li>
          <li>Плавные анимации и переходы</li>
          <li>Лучшие цвета и контрасты</li>
          <li>Аккуратное выравнивание элементов</li>
        </ul>
      </div>

      <ModalButton variant="primary" onClick={openModal}>
        Открыть улучшенное модальное окно
      </ModalButton>

      <Modal isOpen={isOpen} onClose={closeModal} size="lg">
        <Modal.Header 
          title="Редактирование профиля"
          subtitle="Обновите информацию о своем профиле. Все изменения будут сохранены автоматически."
        />
        
        <Modal.Body>
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">Имя</Label>
                <Input 
                  id="firstName" 
                  placeholder="Введите имя"
                  defaultValue="Алексей"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Фамилия</Label>
                <Input 
                  id="lastName" 
                  placeholder="Введите фамилию"
                  defaultValue="Иванов"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input 
                id="email" 
                type="email"
                placeholder="example@company.com"
                defaultValue="alexey.ivanov@company.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="department">Отдел</Label>
              <Select defaultValue="development">
                <SelectTrigger>
                  <SelectValue placeholder="Выберите отдел" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="development">Разработка</SelectItem>
                  <SelectItem value="design">Дизайн</SelectItem>
                  <SelectItem value="marketing">Маркетинг</SelectItem>
                  <SelectItem value="sales">Продажи</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="bio">О себе</Label>
              <Textarea 
                id="bio"
                placeholder="Расскажите немного о себе..."
                rows={3}
                defaultValue="Опытный разработчик с 5+ годами опыта в создании веб-приложений."
              />
            </div>
          </div>
        </Modal.Body>
        
        <Modal.Footer align="between">
          <ModalButton 
            variant="danger"
            icon={<Trash2 />}
          >
            Удалить профиль
          </ModalButton>
          
          <div className="flex gap-3">
            <ModalButton 
              variant="cancel"
              onClick={closeModal}
            >
              Отмена
            </ModalButton>
            <ModalButton 
              variant="success"
              icon={<Save />}
              onClick={closeModal}
            >
              Сохранить изменения
            </ModalButton>
          </div>
        </Modal.Footer>
      </Modal>
    </div>
  )
} 