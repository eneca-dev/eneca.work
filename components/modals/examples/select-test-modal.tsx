"use client"

import React from 'react'
import { Modal, ModalButton, useModalState } from '@/components/modals'
import { Save } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'

export function SelectTestModal() {
  const { isOpen, openModal, closeModal } = useModalState()

  return (
    <div className="p-8">
      <h2 className="text-xl font-bold mb-4">Тест выпадающих списков в модальных окнах</h2>
      
      <ModalButton variant="primary" onClick={openModal}>
        Открыть модальное окно с Select
      </ModalButton>

      <Modal isOpen={isOpen} onClose={closeModal} size="md">
        <Modal.Header 
          title="Тест выпадающих списков"
          subtitle="Проверяем, что Select отображается поверх модального окна"
        />
        
        <Modal.Body>
          <div className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="department">Отдел</Label>
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="Выберите отдел" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="development">Разработка</SelectItem>
                  <SelectItem value="design">Дизайн</SelectItem>
                  <SelectItem value="marketing">Маркетинг</SelectItem>
                  <SelectItem value="sales">Продажи</SelectItem>
                  <SelectItem value="hr">HR</SelectItem>
                  <SelectItem value="finance">Финансы</SelectItem>
                  <SelectItem value="operations">Операции</SelectItem>
                  <SelectItem value="support">Поддержка</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="position">Должность</Label>
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="Выберите должность" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="junior">Junior Developer</SelectItem>
                  <SelectItem value="middle">Middle Developer</SelectItem>
                  <SelectItem value="senior">Senior Developer</SelectItem>
                  <SelectItem value="lead">Team Lead</SelectItem>
                  <SelectItem value="architect">Architect</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="director">Director</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="location">Расположение</Label>
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="Выберите расположение" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="office">В офисе</SelectItem>
                  <SelectItem value="remote">Удаленно</SelectItem>
                  <SelectItem value="hybrid">Гибридный формат</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </Modal.Body>
        
        <Modal.Footer>
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
            Сохранить
          </ModalButton>
        </Modal.Footer>
      </Modal>
    </div>
  )
} 