# Module Meta Schema

JSON Schema для валидации `module.meta.json` файлов в модулях.

## Использование

### 1. Создание module.meta.json

В корне модуля создай файл `module.meta.json`:

```json
{
  "$schema": "../../schemas/module-meta/module.schema.json",

  "meta": {
    "name": "my-module",
    "displayName": "My Module",
    "description": "Описание модуля",
    "status": "stable",
    "route": "/dashboard/my-module",
    "tags": ["feature"]
  },

  "architecture": {
    "structure": {
      "components/": "React компоненты",
      "hooks/": "React хуки"
    },
    "publicApi": ["MyComponent", "useMyHook"]
  },

  "tasks": []
}
```

### 2. Валидация в IDE

VSCode/Cursor автоматически валидируют JSON по указанной схеме.

### 3. Обязательные секции

| Секция | Описание |
|--------|----------|
| `meta` | Метаданные модуля (name, description, status) |
| `architecture` | Структура и public API |
| `tasks` | Список задач (может быть пустым) |

### 4. Опциональные секции

| Секция | Описание |
|--------|----------|
| `hooks` | React хуки |
| `actions` | Server Actions |
| `stores` | Zustand stores |
| `components` | React компоненты |
| `patterns` | Рекомендуемые паттерны |
| `antipatterns` | Антипаттерны |
| `technologies` | Используемые библиотеки |
| `dependencies` | Зависимости (модули, БД) |
| `dependents` | Кто зависит от этого модуля |
| `cache` | Кеширование (query keys, realtime) |
| `permissions` | Используемые permissions |
| `changelog` | История изменений |

## Task Categories

```
feature      - Новый функционал
bug          - Баг
refactor     - Рефакторинг
performance  - Оптимизация
security     - Безопасность
docs         - Документация
tech-debt    - Технический долг
migration    - Миграция данных/кода
```

## Task Statuses

```
backlog      - В бэклоге
todo         - Запланировано
in-progress  - В работе
review       - На ревью
done         - Выполнено
blocked      - Заблокировано
cancelled    - Отменено
```

## Task Priorities

```
critical     - Делать немедленно
high         - В текущем спринте
medium       - В ближайших планах
low          - Когда будет время
```

## ID Format

Task ID должен быть в формате `MODULE-NNN`:
- `RG-001` - Resource Graph
- `CACHE-001` - Cache Module
- `PLAN-001` - Planning Module

## Пример задачи

```json
{
  "id": "RG-001",
  "title": "Оптимизация рендеринга",
  "description": "Внедрить виртуализацию для списков > 100 элементов",
  "category": "performance",
  "priority": "high",
  "status": "in-progress",
  "assignee": "dev1",
  "createdAt": "2025-01-05",
  "updatedAt": "2025-01-05",
  "blockedBy": [],
  "blocks": ["RG-002"]
}
```
