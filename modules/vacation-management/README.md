# 🏖️ Модуль управления отпусками

Модуль для управления отпусками сотрудников с интерфейсом диаграммы Ганта.

## 📋 Возможности

- **Выбор отдела** - просмотр отпусков по отделам
- **Диаграмма Ганта** - визуализация отпусков в виде временной шкалы
- **Управление отпусками**:
  - Создание новых отпусков
  - Редактирование существующих отпусков
  - Удаление отпусков
  - Одобрение запрошенных отпусков
  - Отклонение запрошенных отпусков

## 🏗️ Структура модуля

```
modules/vacation-management/
├── components/
│   ├── VacationManagementModal.tsx  # Главное модальное окно
│   ├── VacationGanttChart.tsx       # Диаграмма Ганта
│   └── VacationFormModal.tsx        # Форма создания/редактирования
├── store.ts                         # Zustand стор
├── types.ts                         # TypeScript типы
├── index.ts                         # Экспорты
└── README.md                        # Документация
```

## 🎯 Интеграция в календарь

Модуль интегрирован в страницу календаря через кнопку "Управление отпусками":

```tsx
import { VacationManagementModal } from '@/modules/vacation-management'

// В компоненте календаря
<VacationManagementModal
  isOpen={showVacationManagement}
  onClose={() => setShowVacationManagement(false)}
/>
```

## 📊 Типы отпусков

- **Отпуск запрошен** - запрос на отпуск (желтый)
- **Отпуск одобрен** - одобренный запрос (зеленый)
- **Отпуск отклонен** - отклоненный запрос (красный)

## 🗄️ Работа с базой данных

Модуль использует следующие таблицы:

### `calendar_events`
- Хранение информации об отпусках
- Поля: `calendar_event_type`, `calendar_event_date_start`, `calendar_event_date_end`

### `profiles`
- Информация о сотрудниках
- Связь с отделами через `department_id`

### `departments`
- Список отделов
- Поля: `department_id`, `department_name`

## 🎨 UI компоненты

### VacationManagementModal
Главное модальное окно размера `full` с:
- Выбором отдела
- Диаграммой Ганта
- Обработкой ошибок

### VacationGanttChart
Диаграмма Ганта с:
- Списком сотрудников слева
- Временной шкалой сверху
- Цветовой кодировкой типов отпусков
- Контекстными меню для действий

### VacationFormModal
Форма с валидацией для:
- Выбора типа отпуска
- Установки дат начала и окончания
- Добавления комментария

## 🔧 Использование стора

```tsx
import { useVacationManagementStore } from '@/modules/vacation-management'

const {
  departments,
  employees,
  vacations,
  selectedDepartmentId,
  isLoading,
  error,
  setSelectedDepartment,
  loadDepartments,
  createVacation,
  updateVacation,
  deleteVacation,
  approveVacation,
  rejectVacation
} = useVacationManagementStore()
```

## 🚀 Запуск и тестирование

1. Откройте страницу календаря
2. Нажмите кнопку "Управление отпусками"
3. Выберите отдел из выпадающего списка
4. Используйте диаграмму Ганта для управления отпусками

## 📝 TODO

- [ ] Добавить фильтрацию по датам
- [ ] Экспорт данных в Excel/PDF
- [ ] Уведомления при изменении статуса отпуска
- [ ] Массовые операции с отпусками
- [ ] Интеграция с календарем Outlook/Google 