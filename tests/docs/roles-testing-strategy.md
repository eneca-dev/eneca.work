# 🔐 Стратегия тестирования разрешений для разных ролей

## 📋 Обзор

Данный документ описывает практичный подход к тестированию функциональности модуля `users` для разных ролей пользователей без создания громоздких дублирующихся тестов.

## 🎯 Цели

1. **Покрытие разрешений** - проверить что каждая роль видит/может делать только то, что ей разрешено
2. **Избежать дублирования** - не создавать полный набор тестов для каждой роли
3. **Поддерживаемость** - легко добавлять новые роли и разрешения
4. **Эффективность** - тестировать только критичные сценарии

---

## 🏗️ Архитектура решения

### 1. Permission Matrix (Матрица разрешений)

Центральная конфигурация, описывающая возможности каждой роли.

**Файл:** `tests/config/permission-matrix.ts`

```typescript
export const PERMISSION_MATRIX = {
  admin: {
    tabs: ['list', 'add-user', 'analytics', 'admin'],
    actions: ['view_all', 'edit_all', 'delete', 'assign_roles'],
    filters: ['all'], // доступны все фильтры
    visibility: 'all_users'
  },
  subdivision_head: {
    tabs: ['list', 'analytics'],
    actions: ['view_subdivision', 'edit_subdivision'],
    filters: ['subdivision_locked'], // подразделение заблокировано на своём
    visibility: 'subdivision_users'
  },
  team_lead: {
    tabs: ['list'],
    actions: ['view_team', 'edit_team'],
    filters: ['team_locked'],
    visibility: 'team_users'
  },
  user: {
    tabs: ['list'],
    actions: ['view_self', 'edit_self'],
    filters: ['none'],
    visibility: 'self_only'
  }
}

export type RoleName = keyof typeof PERMISSION_MATRIX
```

---

### 2. Playwright Projects для разных ролей

Использовать механизм проектов Playwright для параллельного запуска тестов с разными ролями.

**Файл:** `playwright.config.ts`

```typescript
projects: [
  {
    name: 'setup',
    testMatch: /.*\.setup\.ts/,
  },

  // Тесты с правами админа
  {
    name: 'admin',
    use: {
      ...devices['Desktop Chrome'],
      storageState: 'tests/.auth/admin.json',
    },
  },

  // Тесты с правами руководителя подразделения
  {
    name: 'subdivision_head',
    use: {
      ...devices['Desktop Chrome'],
      storageState: 'tests/.auth/subdivision_head.json',
    },
    testIgnore: ['**/*admin-only*'], // Игнорировать админские тесты
  },

  // Тесты с правами руководителя команды
  {
    name: 'team_lead',
    use: {
      ...devices['Desktop Chrome'],
      storageState: 'tests/.auth/team_lead.json',
    },
    testIgnore: ['**/*admin-only*'],
  },

  // Тесты с правами обычного пользователя
  {
    name: 'user',
    use: {
      ...devices['Desktop Chrome'],
      storageState: 'tests/.auth/user.json',
    },
    testMatch: ['**/users/navigation.spec.ts'], // Только базовые тесты
  },
]
```

**Требуемые auth файлы:**
- `tests/.auth/admin.json` ✅ (уже существует)
- `tests/.auth/subdivision_head.json` ⚠️ (создать)
- `tests/.auth/team_lead.json` ⚠️ (создать)
- `tests/.auth/user.json` ⚠️ (создать)

---

### 3. Параметризованные тесты для критичных проверок

Создать helper-функцию, которая генерирует тесты разрешений на основе матрицы.

**Файл:** `tests/helpers/permission-test.helper.ts`

```typescript
import { test, expect, Page } from '@playwright/test'
import { PERMISSION_MATRIX, RoleName } from '../config/permission-matrix'

export function testRolePermissions(roleName: RoleName) {
  const permissions = PERMISSION_MATRIX[roleName]

  test.describe(`${roleName} - Permission Tests`, () => {

    // Проверка видимости табов
    test('should show only allowed tabs', async ({ page }) => {
      await page.goto('/users')

      // Проверка разрешённых табов
      for (const tab of permissions.tabs) {
        const tabElement = page.locator(`[data-tab="${tab}"]`)
        await expect(tabElement).toBeVisible()
      }

      // Проверка отсутствия запрещённых табов
      const allTabs = ['list', 'add-user', 'analytics', 'admin']
      const forbiddenTabs = allTabs.filter(t => !permissions.tabs.includes(t))

      for (const tab of forbiddenTabs) {
        const tabElement = page.locator(`[data-tab="${tab}"]`)
        await expect(tabElement).not.toBeVisible()
      }
    })

    // Проверка видимости пользователей
    test('should show only allowed users based on visibility scope', async ({ page }) => {
      await page.goto('/users')
      await page.waitForTimeout(2000) // Дождаться загрузки списка

      const visibleUsers = await page.locator('table tbody tr').count()

      switch (permissions.visibility) {
        case 'all_users':
          // Админ видит всех пользователей
          expect(visibleUsers).toBeGreaterThan(0)
          break

        case 'subdivision_users':
          // Руководитель подразделения видит только своё подразделение
          expect(visibleUsers).toBeGreaterThan(0)
          // TODO: Проверить что все пользователи из одного подразделения
          break

        case 'team_users':
          // Руководитель команды видит только свою команду
          expect(visibleUsers).toBeGreaterThan(0)
          // TODO: Проверить что все пользователи из одной команды
          break

        case 'self_only':
          // Обычный пользователь видит только себя
          expect(visibleUsers).toBe(1)
          break
      }
    })

    // Проверка блокировки фильтров
    test('should lock appropriate filters', async ({ page }) => {
      await page.goto('/users')

      if (permissions.filters[0] === 'subdivision_locked') {
        // Проверить что subdivision dropdown disabled
        const subdivisionFilter = page.locator('[data-filter="SUBDIVISION"]')
        const isDisabled = await subdivisionFilter.evaluate(el =>
          el.hasAttribute('disabled') || el.getAttribute('aria-disabled') === 'true'
        )
        expect(isDisabled).toBe(true)
      }

      if (permissions.filters[0] === 'team_locked') {
        // Проверить что team dropdown disabled
        const teamFilter = page.locator('[data-filter="TEAM"]')
        const isDisabled = await teamFilter.evaluate(el =>
          el.hasAttribute('disabled') || el.getAttribute('aria-disabled') === 'true'
        )
        expect(isDisabled).toBe(true)
      }
    })

    // Проверка доступных действий
    test('should allow only permitted actions', async ({ page }) => {
      await page.goto('/users')
      await page.waitForTimeout(2000)

      // Проверка наличия кнопок действий в зависимости от разрешений
      const hasEditButtons = permissions.actions.some(a =>
        a.includes('edit')
      )
      const hasDeleteButtons = permissions.actions.includes('delete')

      if (hasEditButtons) {
        // Должны быть видны кнопки редактирования
        const editButtons = page.locator('button[aria-label*="Edit"], button:has-text("Редактировать")')
        const count = await editButtons.count()
        expect(count).toBeGreaterThan(0)
      }

      if (hasDeleteButtons) {
        // Должны быть видны кнопки удаления
        const deleteButtons = page.locator('button[aria-label*="Delete"], button:has-text("Удалить")')
        const count = await deleteButtons.count()
        expect(count).toBeGreaterThan(0)
      }
    })
  })
}
```

**Использование:**

**Файл:** `tests/users/permissions.spec.ts`

```typescript
import { test } from '../fixtures/auth.fixture'
import { testRolePermissions } from '../helpers/permission-test.helper'

// Тесты будут запускаться для каждого проекта (роли)
testRolePermissions('admin')
testRolePermissions('subdivision_head')
testRolePermissions('team_lead')
testRolePermissions('user')
```

---

### 4. Роль-специфичные фикстуры

Создать фикстуру, которая автоматически определяет текущую роль из имени проекта.

**Файл:** `tests/fixtures/roles.fixture.ts`

```typescript
import { test as base } from '@playwright/test'
import { PERMISSION_MATRIX, RoleName } from '../config/permission-matrix'

type RoleFixtures = {
  roleName: RoleName
  permissions: typeof PERMISSION_MATRIX[RoleName]
}

export const test = base.extend<RoleFixtures>({
  roleName: async ({}, use, testInfo) => {
    // Определить роль из имени проекта
    const role = testInfo.project.name as RoleName
    await use(role)
  },

  permissions: async ({ roleName }, use) => {
    const perms = PERMISSION_MATRIX[roleName]
    await use(perms)
  },
})

export { expect } from '@playwright/test'
```

**Использование:**

```typescript
import { test, expect } from '../fixtures/roles.fixture'

test('user sees only allowed tabs', async ({ page, permissions }) => {
  await page.goto('/users')

  for (const tab of permissions.tabs) {
    const tabElement = page.locator(`[data-tab="${tab}"]`)
    await expect(tabElement).toBeVisible()
  }
})
```

---

### 5. Приоритизация тестов

Использовать `test.skip()` для условного выполнения тестов в зависимости от роли.

**Пример:** `tests/users/users-list/filters.spec.ts`

```typescript
import { test, expect } from '../../fixtures/roles.fixture'

// ✅ Для ВСЕХ ролей - базовые проверки
test.describe('Filters - Basic', () => {
  test('filter dropdown opens', async ({ page }) => {
    // Этот тест запустится для всех ролей
  })
})

// 🔐 Только для админа
test.describe('Filters - Admin Only', () => {
  test.beforeEach(({ roleName }) => {
    test.skip(roleName !== 'admin', 'This test only runs for admin')
  })

  test('admin can see all subdivision filters', async ({ page }) => {
    // Только для admin
  })
})

// 👥 Для subdivision_head и admin
test.describe('Filters - Management Roles', () => {
  test.beforeEach(({ roleName }) => {
    test.skip(
      !['admin', 'subdivision_head'].includes(roleName),
      'Only for management roles'
    )
  })

  test('can filter by departments in subdivision', async ({ page }) => {
    // Для admin и subdivision_head
  })
})

// 👤 Только для обычных пользователей
test.describe('Filters - User Role', () => {
  test.beforeEach(({ roleName }) => {
    test.skip(roleName !== 'user', 'Only for regular users')
  })

  test('user has no filter access', async ({ page }) => {
    // Только для user
  })
})
```

---

## 📁 Итоговая структура файлов

```
tests/
├── .auth/                                  # Auth states для каждой роли
│   ├── admin.json                          ✅ Существует
│   ├── subdivision_head.json               ⚠️ Создать
│   ├── team_lead.json                      ⚠️ Создать
│   └── user.json                           ⚠️ Создать
│
├── config/
│   └── permission-matrix.ts                🆕 Матрица разрешений
│
├── fixtures/
│   ├── auth.fixture.ts                     ✅ Существует
│   └── roles.fixture.ts                    🆕 Роль-aware фикстура
│
├── helpers/
│   ├── users-page.helper.ts                ✅ Существует
│   └── permission-test.helper.ts           🆕 Helpers для тестов разрешений
│
├── docs/
│   └── roles-testing-strategy.md           ✅ Этот документ
│
└── users/
    ├── navigation.spec.ts                  ✅ Общие тесты навигации
    ├── permissions.spec.ts                 🆕 Тесты разрешений (параметризованные)
    ├── users-list/
    │   ├── filters.spec.ts                 ♻️  Обновить с роль-aware логикой
    │   ├── pagination.spec.ts              ✅ Без изменений
    │   ├── search.spec.ts                  ✅ Без изменений
    │   └── grouping.spec.ts                ✅ Без изменений
    └── admin-only/                         🆕 Тесты только для админа
        └── admin-panel.spec.ts             🆕 Тесты админ-панели
```

---

## 🚀 Команды запуска

### Все проекты (все роли)
```bash
npx playwright test
```

### Конкретная роль
```bash
# Только админ
npx playwright test --project=admin

# Только subdivision_head
npx playwright test --project=subdivision_head

# Только team_lead
npx playwright test --project=team_lead

# Только user
npx playwright test --project=user
```

### Конкретный файл
```bash
# Для всех ролей
npx playwright test users/permissions.spec.ts

# Только для админа
npx playwright test users/admin-only/ --project=admin

# Для нескольких ролей
npx playwright test users/navigation.spec.ts --project=admin --project=subdivision_head
```

### Параллельный запуск
```bash
# Запустить все проекты параллельно (если workers > 1)
npx playwright test --project=admin --project=subdivision_head --project=team_lead
```

---

## ✅ Преимущества этого подхода

1. **Не громоздко**
   - Не дублируем все тесты для всех ролей
   - Общие тесты запускаются для всех, специфичные - только для нужных ролей

2. **Гибкость**
   - Легко добавить новую роль в матрицу
   - Легко добавить новое разрешение

3. **Поддерживаемость**
   - Вся конфигурация разрешений в одном месте (`permission-matrix.ts`)
   - Изменения в одном месте распространяются на все тесты

4. **Эффективность**
   - Тестируем только критичные сценарии для каждой роли
   - Избегаем избыточных тестов

5. **Параллельность**
   - Playwright может запускать проекты параллельно
   - Ускоряет выполнение тестов

6. **Читаемость**
   - Понятно, какие тесты для каких ролей
   - Явное указание через `test.skip()` или `testIgnore`

---

## 📝 Чеклист реализации

### Этап 1: Подготовка инфраструктуры
- [ ] Создать `tests/config/permission-matrix.ts`
- [ ] Создать auth states для всех ролей:
  - [ ] `tests/.auth/subdivision_head.json`
  - [ ] `tests/.auth/team_lead.json`
  - [ ] `tests/.auth/user.json`
- [ ] Обновить `playwright.config.ts` с проектами для всех ролей
- [ ] Создать `tests/fixtures/roles.fixture.ts`
- [ ] Создать `tests/helpers/permission-test.helper.ts`

### Этап 2: Создание тестов разрешений
- [ ] Создать `tests/users/permissions.spec.ts` с параметризованными тестами
- [ ] Создать директорию `tests/users/admin-only/`
- [ ] Создать `tests/users/admin-only/admin-panel.spec.ts`

### Этап 3: Обновление существующих тестов
- [ ] Обновить `tests/users/users-list/filters.spec.ts` с роль-aware логикой
- [ ] Добавить `test.skip()` для роль-специфичных тестов
- [ ] Убедиться что базовые тесты запускаются для всех ролей

### Этап 4: Тестирование и документация
- [ ] Запустить тесты для каждой роли отдельно
- [ ] Запустить все тесты параллельно
- [ ] Убедиться что результаты соответствуют ожиданиям
- [ ] Обновить README с инструкциями по запуску

---

## 🔍 Примеры сценариев

### Сценарий 1: Admin видит всё
```typescript
test.describe('Admin - Full Access', () => {
  test.skip(({ roleName }) => roleName !== 'admin')

  test('admin sees all tabs', async ({ page }) => {
    await page.goto('/users')

    await expect(page.locator('[data-tab="list"]')).toBeVisible()
    await expect(page.locator('[data-tab="add-user"]')).toBeVisible()
    await expect(page.locator('[data-tab="analytics"]')).toBeVisible()
    await expect(page.locator('[data-tab="admin"]')).toBeVisible()
  })

  test('admin can edit any user', async ({ page }) => {
    await page.goto('/users')

    // Кликнуть на первого пользователя
    await page.locator('table tbody tr').first().click()

    // Должна открыться модалка редактирования
    await expect(page.locator('[role="dialog"]')).toBeVisible()

    // Кнопка сохранения должна быть активна
    await expect(page.locator('button:has-text("Сохранить")')).toBeEnabled()
  })
})
```

### Сценарий 2: Subdivision Head - ограниченный доступ
```typescript
test.describe('Subdivision Head - Limited Access', () => {
  test.skip(({ roleName }) => roleName !== 'subdivision_head')

  test('sees only list and analytics tabs', async ({ page }) => {
    await page.goto('/users')

    await expect(page.locator('[data-tab="list"]')).toBeVisible()
    await expect(page.locator('[data-tab="analytics"]')).toBeVisible()
    await expect(page.locator('[data-tab="add-user"]')).not.toBeVisible()
    await expect(page.locator('[data-tab="admin"]')).not.toBeVisible()
  })

  test('subdivision filter is locked to own subdivision', async ({ page }) => {
    await page.goto('/users')

    const subdivisionFilter = page.locator('[data-filter="SUBDIVISION"]')
    const isDisabled = await subdivisionFilter.evaluate(el =>
      el.hasAttribute('disabled') || el.getAttribute('aria-disabled') === 'true'
    )

    expect(isDisabled).toBe(true)
  })

  test('sees only users from own subdivision', async ({ page }) => {
    await page.goto('/users')

    // Получить всех видимых пользователей
    const users = await page.locator('table tbody tr').all()

    // Проверить что все из одного подразделения
    for (const user of users) {
      const subdivision = await user.locator('td[data-column="subdivision"]').textContent()
      // TODO: Проверить что это подразделение пользователя
    }
  })
})
```

### Сценарий 3: Regular User - минимальный доступ
```typescript
test.describe('User - Minimal Access', () => {
  test.skip(({ roleName }) => roleName !== 'user')

  test('sees only list tab', async ({ page }) => {
    await page.goto('/users')

    await expect(page.locator('[data-tab="list"]')).toBeVisible()
    await expect(page.locator('[data-tab="add-user"]')).not.toBeVisible()
    await expect(page.locator('[data-tab="analytics"]')).not.toBeVisible()
    await expect(page.locator('[data-tab="admin"]')).not.toBeVisible()
  })

  test('sees only self in user list', async ({ page }) => {
    await page.goto('/users')
    await page.waitForTimeout(2000)

    const visibleUsers = await page.locator('table tbody tr').count()
    expect(visibleUsers).toBe(1)
  })

  test('cannot edit other users', async ({ page }) => {
    await page.goto('/users')

    // Кнопки редактирования для других пользователей не должны быть видны
    const editButtons = await page.locator('button[aria-label*="Edit"]').count()
    expect(editButtons).toBe(0)
  })
})
```

---

## 🎯 Метрики успеха

После реализации этой стратегии ожидаются следующие результаты:

1. **Покрытие**: 100% критичных сценариев для каждой роли
2. **Время выполнения**: Не более 10 минут для всех ролей (параллельно)
3. **Поддерживаемость**: Добавление новой роли занимает < 30 минут
4. **Стабильность**: < 5% flaky tests
5. **Читаемость**: Понятно с первого взгляда что тестируется для какой роли

---

## 📚 Дополнительные ресурсы

- [Playwright Projects Documentation](https://playwright.dev/docs/test-projects)
- [Playwright Parametrize Tests](https://playwright.dev/docs/test-parameterize)
- [Playwright Authentication](https://playwright.dev/docs/auth)
- [Current Permission System Docs](../../docs/roles-and-permissions.md)
