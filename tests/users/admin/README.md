# Admin Panel E2E Tests

Тесты для панели администратора модуля Users.

## Структура

```
tests/users/admin/
├── README.md                           # Этот файл
├── constants/
│   └── selectors.ts                    # Централизованные селекторы
├── helpers/
│   └── admin-panel.helper.ts           # Page Object helper
├── smoke.spec.ts                       # Smoke тесты (базовая видимость)
├── cleanup.spec.ts                     # Очистка тестовых данных (ручной запуск)
├── positions/
│   └── crud.spec.ts                    # CRUD тесты для должностей
├── categories/
│   └── crud.spec.ts                    # CRUD тесты для категорий
├── subdivisions/
│   └── crud.spec.ts                    # CRUD тесты для подразделений
├── departments/
│   └── crud.spec.ts                    # CRUD тесты для отделов
└── teams/
    └── crud.spec.ts                    # CRUD тесты для команд
```

## Тестируемые вкладки

| Вкладка | Особенности |
|---------|-------------|
| **Подразделения** | CRUD + назначение руководителя + статистика (отделов/сотрудников) |
| **Отделы** | CRUD + привязка к подразделению + назначение руководителя |
| **Команды** | CRUD + привязка к отделу + фильтр по отделам + назначение тимлида |
| **Должности** | Простой CRUD через EntityTab |
| **Категории** | Простой CRUD через EntityTab |

## Тестовые данные

Все тестовые сущности создаются с префиксом `АВТОТЕСТ-`:

- `АВТОТЕСТ-Подразделение`
- `АВТОТЕСТ-Отдел`
- `АВТОТЕСТ-Команда`
- `АВТОТЕСТ-Должность`
- `АВТОТЕСТ-Категория`

**Важно:** Префикс использует только русские буквы и дефис, чтобы соответствовать правилу валидации: _"Название должно содержать только русские буквы, цифры, пробелы и дефисы"_.

**Cleanup:** После тестов автоматически удаляются все сущности с этим префиксом.

## Запуск тестов

```bash
# Все тесты admin панели
npx playwright test tests/users/admin

# Только smoke тесты
npx playwright test tests/users/admin/smoke.spec.ts

# Тесты для конкретной вкладки
npx playwright test tests/users/admin/positions
npx playwright test tests/users/admin/categories
npx playwright test tests/users/admin/subdivisions
npx playwright test tests/users/admin/departments
npx playwright test tests/users/admin/teams

# UI Mode (рекомендуется для отладки)
npx playwright test tests/users/admin --ui

# Cleanup (очистка тестовых данных)
npx playwright test tests/users/admin/cleanup.spec.ts
```

## Очистка тестовых данных (Cleanup)

Тестовые данные удаляются **автоматически** после каждого файла тестов (`afterAll`), но если тесты упали или хочешь полностью очистить БД:

```bash
# Ручная очистка всех АВТОТЕСТ- данных
npx playwright test tests/users/admin/cleanup.spec.ts
```

### Бизнес-логика удаления

Cleanup учитывает ограничения приложения:

⚠️ **Нельзя удалить последнюю команду в отделе** - вместо этого удаляется весь отдел
⚠️ **Нельзя удалить подразделение с отделами** - сначала нужно удалить отделы

**Порядок удаления (умная логика):**
1. **Teams** — удаляет только если в отделе >1 команды (иначе пропускает)
2. **Departments** — удаляет отделы вместе с оставшимися командами (cascade)
3. **Subdivisions** — удаляет только пустые подразделения
4. **Positions, Categories** — удаляет независимые сущности

**Когда запускать cleanup:**
- ✅ После завершения всех тестов
- ✅ Если тесты упали с ошибкой и данные остались
- ✅ Перед повторным запуском для чистой БД

## Предварительные требования

1. **Авторизация:** Должна быть выполнена (`npx playwright test --project=setup`)
2. **Сессия:** Файл `tests/.auth/admin.json` должен существовать
3. **Права:** Тестовый пользователь должен иметь права администратора

## Покрытые сценарии

### CRUD операции (для каждой вкладки)
- [x] Открытие модалки создания
- [x] Валидация пустого имени
- [x] Создание новой сущности
- [x] Валидация дубликата имени
- [x] Поиск сущности
- [x] Открытие модалки редактирования
- [x] Редактирование имени
- [x] Открытие модалки подтверждения удаления
- [x] Удаление сущности

### Дополнительные сценарии

**Subdivisions:**
- [x] Отображение колонок (Название, Руководитель, Отделов, Сотрудников)
- [x] Отображение "Не назначен" для руководителя
- [x] Кнопка редактирования руководителя
- [x] Popover назначения руководителя
- [x] Модалка назначения руководителя

**Departments:**
- [x] Выбор подразделения при создании
- [x] Отображение привязки к подразделению
- [x] Назначение руководителя отдела

**Teams:**
- [x] Выбор отдела при создании
- [x] Отображение привязки к отделу
- [x] Кнопки фильтрации по отделам
- [x] Фильтрация команд по отделу
- [x] Кнопка "Назначить в команду"
- [x] Назначение тимлида

## Helper API

```typescript
import { AdminPanelHelper } from './helpers/admin-panel.helper'

const helper = new AdminPanelHelper(page)

// Навигация
await helper.goto()                        // Перейти на admin панель
await helper.switchTab('positions')        // Переключить вкладку

// CRUD
await helper.createEntity('position', 'Тестовая должность')
await helper.search('position', 'Тест')
await helper.editEntityName('Старое имя', 'Новое имя')
await helper.deleteEntity('Имя сущности')

// Проверки
await helper.entityExists('Имя')           // Проверить существование
await helper.getVisibleEntityNames()       // Получить все имена

// Head management
await helper.clickEditHeadButton('Отдел')
await helper.clickAssignHeadInPopover()
await helper.searchUserInHeadModal('Иванов')
await helper.selectUserInHeadModal('Иванов Иван')
await helper.confirmHeadAssignment()

// Cleanup
await helper.cleanupTestData('position')   // Удалить тестовые данные
```

## Селекторы

Все селекторы централизованы в `constants/selectors.ts`:

- `SELECTORS.TABS.*` - вкладки админ панели
- `SELECTORS.CONTROLS.*` - кнопки управления (поиск, создание, редактирование)
- `SELECTORS.TABLE.*` - элементы таблицы
- `SELECTORS.ENTITY_MODAL.*` - модалка создания/редактирования
- `SELECTORS.DELETE_MODAL.*` - модалка подтверждения удаления
- `SELECTORS.HEAD_MODAL.*` - модалка назначения руководителя
- `SELECTORS.HEAD_MANAGEMENT.*` - элементы управления руководителями

## Troubleshooting

### Тесты падают с "unauthorized"
```bash
npx playwright test --project=setup
```

### Тесты не находят элементы
- Проверьте актуальность селекторов в `selectors.ts`
- Используйте `--debug` для пошаговой отладки:
```bash
npx playwright test tests/users/admin/positions --debug
```

### Тесты Departments/Teams пропускаются
Тесты пропускаются если нет существующих подразделений/отделов для привязки.
Убедитесь что в БД есть данные.
