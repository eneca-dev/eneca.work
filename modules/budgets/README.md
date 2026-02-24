# Модуль бюджетов (budgets)

Система плановых бюджетов для разделов, объектов, стадий и проектов.

## Статус реализации

### ✅ Выполнено

#### БД — Таблицы
- `budget_types` — справочник типов бюджетов (Основной, Премиальный, Дополнительный)
- `budgets` — основная таблица с полиморфной связью (entity_type + entity_id) и FK на тип (budget_type_id)
- `budget_versions` — история изменений сумм с версионированием
- `work_logs.budget_id` — привязка расходов к бюджетам

#### БД — Views
- `v_cache_budgets_current` — активные бюджеты с суммой, расходом, типом
- `v_cache_section_budget_summary` — сводка по разделам
- `v_cache_budget_types` — типы с количеством использований

#### БД — RLS-политики
| Таблица | SELECT | INSERT | UPDATE | DELETE |
|---------|--------|--------|--------|--------|
| `budget_types` | Все авторизованные | budgets.manage_types | budgets.manage_types | budgets.manage_types |
| `budgets` | По ролям* | budgets.create | budgets.edit | budgets.delete |
| `budget_versions` | Наследует от budgets | budgets.edit | budgets.edit | — |

*SELECT для budgets:
- Админ с `budgets.view.all` видит всё
- Тимлид — свои разделы (section_responsible)
- Начальник отдела — разделы с сотрудниками отдела
- Менеджер/ГИП — разделы своих проектов

#### БД — Permissions
| Permission | Роли |
|------------|------|
| `budgets.view.all` | admin, subdivision_head |
| `budgets.create` | admin, subdivision_head, department_head, project_manager |
| `budgets.edit` | admin, subdivision_head, department_head, project_manager |
| `budgets.delete` | admin |
| `budgets.manage_types` | admin |

### ✅ Этап 5: Server Actions и Cache
- [x] Query keys в `modules/cache/keys/query-keys.ts`
- [x] Server actions в `modules/budgets/actions/budget-actions.ts`
- [x] Hooks в `modules/budgets/hooks/`
- [ ] Типы TypeScript (`npm run db:types`) — после применения миграций

### ✅ Тестовая страница
- [x] `/dashboard/budgets-test` — тестовая страница для проверки модуля
  - Фильтр по проектам
  - Просмотр разделов с бюджетами
  - Создание/редактирование бюджетов
  - Выбор типа бюджета (обязательно)
  - Автозаполнение названия из типа
  - **Тестирование влияния на бюджет:**
    - Выбор этапа декомпозиции
    - Список задач этапа
    - Создание отчёта (work_log) с привязкой к бюджету
    - Автоматическое обновление расхода бюджета

### ⚠️ Очистка тестовых данных
Для очистки всех тестовых данных модуля бюджетов выполните:
```sql
-- modules/budgets/migrations/cleanup_test_data.sql
-- Удаляет ВСЕ бюджеты, версии, типы и связанные work_logs
```

### 📋 Планируется

#### Этап 6: Интеграция в UI
- [ ] Выбор бюджета при создании work_log
- [ ] Отображение бюджета в карточке раздела
- [ ] Управление тегами бюджетов

## Схема данных

```
budget_types            budgets                    budget_versions
├── type_id PK         ├── budget_id PK           ├── version_id PK
├── name               ├── entity_type            ├── budget_id FK
├── color              ├── entity_id              ├── planned_amount
├── description        ├── name                   ├── effective_from
├── is_active          ├── budget_type_id FK      ├── effective_to
├── created_at         ├── is_active              ├── comment
        ↓              ├── created_by             ├── created_by
                       ├── created_at             ├── created_at
                       ├── updated_at
                               ↓
                       work_logs
                       ├── budget_id FK (nullable)
                       └── ...
```

## Ключевые концепции

### Полиморфная привязка
Бюджет привязывается к любой сущности:
```typescript
type BudgetEntityType = 'section' | 'object' | 'stage' | 'project'
```

### Версионирование
Каждое изменение суммы создаёт новую версию:
- Текущая версия: `effective_to IS NULL`
- При изменении: закрываем старую (`effective_to = today`), создаём новую

### Расчёт расхода
Фактический расход считается из `work_logs`:
```sql
SELECT SUM(work_log_amount) FROM work_logs WHERE budget_id = ?
```

### Валюта
Единая валюта — **BYN** (белорусский рубль).

## Файлы миграций

```
supabase/migrations/
├── 2025-12-09_budgets_tables.sql      # Таблицы + индексы + триггеры
├── 2025-12-09_budgets_views.sql       # Views для кэширования
├── 2025-12-09_budgets_rls.sql         # RLS-политики
└── 2025-12-09_budgets_permissions.sql # Права доступа
```

## Использование (после реализации этапа 5)

### Получение бюджетов раздела
```typescript
import { useBudgetsBySection } from '@/modules/budgets'

function SectionBudgets({ sectionId }: { sectionId: string }) {
  const { data: budgets, isLoading } = useBudgetsBySection(sectionId)

  return (
    <div>
      {budgets?.map(budget => (
        <BudgetCard key={budget.budget_id} budget={budget} />
      ))}
    </div>
  )
}
```

### Создание бюджета
```typescript
import { useCreateBudget } from '@/modules/budgets'

function CreateBudgetForm({ sectionId }: { sectionId: string }) {
  const { mutate: createBudget } = useCreateBudget()

  const handleSubmit = (data: CreateBudgetInput) => {
    createBudget({
      entity_type: 'section',
      entity_id: sectionId,
      name: data.name,
      planned_amount: data.amount,
      tag_ids: data.tagIds,
    })
  }
}
```

### Проверка прав
```tsx
import { PermissionGuard } from '@/modules/permissions'

<PermissionGuard permission="budgets.create">
  <CreateBudgetButton />
</PermissionGuard>
```

## Связанная документация

- [Общая документация бюджетов](../../docs/budgets.md)
- [Модуль кэширования](../cache/README.md)
- [Система прав доступа](../permissions/README.md)
