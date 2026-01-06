"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { 
  Plus, 
  Edit, 
  Trash2, 
  Check, 
  X, 
  Calendar,
  Users,
  MousePointer2,
  Info,
  ChevronLeft,
  ChevronRight,
  Search
} from 'lucide-react'

interface VacationInstructionsModalProps {
  isOpen: boolean
  onClose: () => void
}

export function VacationInstructionsModal({ isOpen, onClose }: VacationInstructionsModalProps) {
  const handleOpenChange = (open: boolean) => {
    if (!open) {
      onClose()
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Info className="h-5 w-5 text-blue-500" />
            Инструкция по управлению отпусками
          </DialogTitle>
          <DialogDescription>
            Подробное руководство по работе с системой управления отпусками
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Общий обзор */}
          <section>
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <Calendar className="h-5 w-5 text-blue-500" />
              Общий обзор
            </h3>
            <div className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
              Система управления отпусками позволяет просматривать, создавать и управлять отпусками сотрудников 
              в удобном формате диаграммы Ганта. Каждый отпуск отображается цветной полосой на временной шкале.
              По умолчанию отображается 3 месяца: текущий и 2 следующих.
            </div>
          </section>

          <Separator />

          {/* Типы отпусков */}
          <section>
            <h3 className="text-lg font-semibold mb-3">Типы отпусков и цветовая кодировка</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-center space-x-3 p-3 bg-gray-50 dark:bg-slate-700 rounded-lg">
                <div className="w-6 h-6 bg-yellow-500 rounded"></div>
                <div>
                  <div className="font-medium text-sm">Отпуск запрошен</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Ожидает рассмотрения</div>
                </div>
              </div>
              <div className="flex items-center space-x-3 p-3 bg-gray-50 dark:bg-slate-700 rounded-lg">
                <div className="w-6 h-6 bg-green-500 rounded"></div>
                <div>
                  <div className="font-medium text-sm">Отпуск одобрен</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Подтвержден НО</div>
                </div>
              </div>
              <div className="flex items-center space-x-3 p-3 bg-gray-50 dark:bg-slate-700 rounded-lg">
                <div className="w-6 h-6 bg-red-500 rounded"></div>
                <div>
                  <div className="font-medium text-sm">Отпуск отклонен</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Отклонен НО</div>
                </div>
              </div>
            </div>
          </section>

          <Separator />

          {/* Как работать с интерфейсом */}
          <section>
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <Users className="h-5 w-5 text-blue-500" />
              Как работать с интерфейсом
            </h3>
            
            <div className="space-y-4">
              <div className="bg-blue-50 dark:bg-slate-700 p-4 rounded-lg">
                <h4 className="font-medium text-sm mb-2">1. Выбор отдела</h4>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Сначала выберите отдел из выпадающего списка. После выбора отобразятся все сотрудники отдела 
                  и их отпуска на диаграмме Ганта.
                </div>
              </div>

              <div className="bg-green-50 dark:bg-slate-700 p-4 rounded-lg">
                <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                  2. Навигация по времени
                </h4>
                <div className="space-y-2">
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    <strong>Панель навигации сверху:</strong>
                  </div>
                  <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1 ml-2">
                    <li>• <Badge variant="outline" className="text-xs mr-1">Сегодня</Badge> - быстрый возврат к текущему месяцу</li>
                    <li>• <Badge variant="outline" className="text-xs mr-1">Перейти к месяцу</Badge> - выбор конкретного месяца и года</li>
                    <li>• <Badge variant="outline" className="text-xs mr-1">← →</Badge> - навигация по месяцам (листание на 1 месяц)</li>
                  </ul>
                  <div className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                    <strong>Прокрутка диаграммы:</strong>
                  </div>
                  <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1 ml-2">
                    <li>• <strong>Горизонтальная прокрутка:</strong> Shift + колёсико мышки</li>
                    <li>• <strong>Вертикальная прокрутка:</strong> колёсико мышки</li>
                  </ul>
                </div>
              </div>

              <div className="bg-purple-50 dark:bg-slate-700 p-4 rounded-lg">
                <h4 className="font-medium text-sm mb-2">3. Взаимодействие с отпусками</h4>
                <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                  <li>• <strong>Наведение:</strong> подсветка отпуска и отображение подсказки с деталями</li>
                  <li>• <strong>Клик:</strong> открытие контекстного меню с действиями</li>
                  <li>• <strong>Клик вне отпуска:</strong> закрытие контекстного меню</li>
                </ul>
              </div>
            </div>
          </section>

          <Separator />

          {/* Навигация по времени */}
          <section>
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <Search className="h-5 w-5 text-blue-500" />
              Навигация по временным периодам
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Отображаемый период */}
              <div className="p-4 border border-gray-200 dark:border-slate-600 dark:bg-slate-700 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="h-4 w-4 text-blue-500" />
                  <h4 className="font-medium text-sm">Отображаемый период</h4>
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                  <div>• Всегда отображается 3 месяца подряд</div>
                  <div>• По умолчанию: текущий + 2 следующих месяца</div>
                  <div>• Если период переходит через год, отображается "2025/2026"</div>
                  <div>• Названия месяцев показаны под годом</div>
                </div>
              </div>

              {/* Кнопка "Сегодня" */}
              <div className="p-4 border border-gray-200 dark:border-slate-600 dark:bg-slate-700 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="h-4 w-4 text-green-500" />
                  <h4 className="font-medium text-sm">Кнопка "Сегодня"</h4>
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Расположена слева в панели навигации. Мгновенно переносит к текущему месяцу 
                  и автоматически прокручивает к сегодняшнему дню.
                </div>
              </div>

              {/* Стрелки навигации */}
              <div className="p-4 border border-gray-200 dark:border-slate-600 dark:bg-slate-700 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex items-center">
                    <ChevronLeft className="h-4 w-4 text-blue-500" />
                    <ChevronRight className="h-4 w-4 text-blue-500" />
                  </div>
                  <h4 className="font-medium text-sm">Стрелки навигации</h4>
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                  <div>• Расположены справа в панели навигации</div>
                  <div>• Каждый клик листает на 1 месяц вперед/назад</div>
                  <div>• Между стрелками показан текущий период</div>
                </div>
              </div>

              {/* Быстрый переход */}
              <div className="p-4 border border-gray-200 dark:border-slate-600 dark:bg-slate-700 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Search className="h-4 w-4 text-purple-500" />
                  <h4 className="font-medium text-sm">Быстрый переход</h4>
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                  <div>• Кнопка "Перейти к месяцу" слева в панели</div>
                  <div>• Открывает поле с выбором месяца и года</div>
                  <div>• Позволяет перейти к любому месяцу (например, "Август 2027")</div>
                  <div>• Автоматически закрывается после перехода</div>
                </div>
              </div>
            </div>
          </section>

          <Separator />

          {/* Действия с отпусками */}
          <section>
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <MousePointer2 className="h-5 w-5 text-blue-500" />
              Действия с отпусками
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Создание отпуска */}
              <div className="p-4 border border-gray-200 dark:border-slate-600 dark:bg-slate-700 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Plus className="h-4 w-4 text-green-500" />
                  <h4 className="font-medium text-sm">Создание отпуска</h4>
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Нажмите кнопку <Badge variant="outline" className="text-xs">+</Badge> рядом с именем сотрудника 
                  для создания нового отпуска. Откроется форма с выбором дат и типа отпуска.
                </div>
              </div>

              {/* Редактирование отпуска */}
              <div className="p-4 border border-gray-200 dark:border-slate-600 dark:bg-slate-700 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Edit className="h-4 w-4 text-blue-500" />
                  <h4 className="font-medium text-sm">Редактирование отпуска</h4>
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Кликните на любой отпуск и выберите "Редактировать" в контекстном меню. 
                  Можно изменить даты, тип и комментарий к отпуску.
                </div>
              </div>

              {/* Одобрение отпуска */}
              <div className="p-4 border border-gray-200 dark:border-slate-600 dark:bg-slate-700 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <h4 className="font-medium text-sm">Одобрение отпуска</h4>
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Для запрошенных отпусков доступна кнопка "Одобрить отпуск" в контекстном меню. 
                  Отпуск изменит статус на "Одобрен" и станет зеленым.
                </div>
              </div>

              {/* Отклонение отпуска */}
              <div className="p-4 border border-gray-200 dark:border-slate-600 dark:bg-slate-700 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <X className="h-4 w-4 text-red-500" />
                  <h4 className="font-medium text-sm">Отклонение отпуска</h4>
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Любой отпуск можно отклонить через контекстное меню. 
                  Отпуск изменит статус на "Отклонен" и станет красным.
                </div>
              </div>

              {/* Удаление отпуска */}
              <div className="p-4 border border-gray-200 dark:border-slate-600 dark:bg-slate-700 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Trash2 className="h-4 w-4 text-red-500" />
                  <h4 className="font-medium text-sm">Удаление отпуска</h4>
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Кликните на отпуск и выберите "Удалить" в контекстном меню. 
                  Появится диалог подтверждения. Удаление нельзя отменить.
                </div>
              </div>
            </div>
          </section>

          {/* Кнопка закрытия */}
          <div className="flex justify-end pt-4">
            <Button onClick={onClose}>
              Понятно
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
} 