# E2E Tests with Playwright

Этот проект использует Playwright для E2E тестирования.

## Структура

```
tests/
├── auth.setup.ts              # 🔐 Общая авторизация для всех тестов
├── .auth/
│   └── admin.json             # Сохраненная сессия (gitignored)
├── fixtures/
│   └── auth.fixture.ts        # Fixture с авторизованной сессией
├── resource-graph/            # Модуль: Resource Graph
│   ├── constants/
│   ├── helpers/
│   └── filters/
│       └── single-filters.spec.ts
└── users/                     # Модуль: Users
    ├── constants/
    ├── helpers/
    ├── navigation.spec.ts
    └── users-list/
        ├── filters.spec.ts
        ├── search.spec.ts
        ├── grouping.spec.ts
        └── pagination.spec.ts
```

## Как это работает

### 1. Первый раз: Авторизация

Перед запуском тестов нужно **один раз** авторизоваться:

```bash
npx playwright test --project=setup
```

Это запустит `auth.setup.ts`, который:
- Откроет страницу логина
- Войдет с credentials из `.env.local`
- Сохранит сессию в `tests/.auth/admin.json`

**⚠️ ВАЖНО:** В `.env.local` должны быть:
```env
ADMIN_EMAIL=your_email@example.com
ADMIN_PASSWORD=your_password
```

### 2. Запуск тестов

После авторизации все тесты автоматически используют сохраненную сессию:

```bash
# Все тесты
npx playwright test

# Только users модуль
npx playwright test tests/users

# Только navigation
npx playwright test tests/users/navigation.spec.ts

# UI Mode (рекомендуется для разработки)
npm run test:ui

# Dev режим (без production build)
npm run test:ui:dev

# Remote сервер (dev.eneca.work)
npm run test:ui:remote
```

### 3. Когда нужно перезапустить auth.setup?

Перезапустите авторизацию если:
- ❌ Тесты падают с ошибкой "unauthorized" или редиректят на /auth/login
- 🔄 Перезапустили сервер и сессия истекла
- 🔑 Изменились credentials

```bash
npx playwright test --project=setup
```

## Режимы запуска

| Команда | Описание | Когда использовать |
|---------|----------|-------------------|
| `npm run test:ui` | UI Mode (prod build) | Разработка тестов, отладка |
| `npm run test:ui:dev` | UI Mode (dev server) | Работа над кодом приложения |
| `npm run test:ui:remote` | UI Mode (remote) | Тестирование на dev.eneca.work |
| `npm run test` | Headless (prod) | CI/CD, финальная проверка |
| `npm run test:headed` | Headed (prod) | Просмотр выполнения |
| `npm run test:report` | Открыть отчет | Просмотр результатов |

## Написание тестов

### Базовый шаблон

**⚡ ОПТИМИЗАЦИЯ:** Используйте `beforeAll` для загрузки страницы **один раз**, чтобы избежать повторной загрузки данных из Supabase:

```typescript
import { test, expect, Page } from '../fixtures/auth.fixture'
import { UsersPageHelper } from './helpers/users-page.helper'

test.describe('Module - Feature', () => {
  let helper: UsersPageHelper
  let sharedPage: Page

  // Load page ONCE for all tests (избегаем повторной загрузки 538+ пользователей)
  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext({
      storageState: 'tests/.auth/admin.json'
    })
    sharedPage = await context.newPage()
    helper = new UsersPageHelper(sharedPage)
    await helper.goto()
  })

  // After each test, only reset state - don't reload page
  test.afterEach(async () => {
    try {
      await helper.clearSearch()
      await helper.resetAllFilters()
    } catch (e) {
      console.log('Cleanup error:', e)
    }
  })

  // Close page after all tests
  test.afterAll(async () => {
    await sharedPage.close()
  })

  test('should do something', async () => {
    // Arrange
    await helper.search('test')

    // Act
    const results = await helper.getVisibleUsersCount()

    // Assert
    expect(results).toBeGreaterThan(0)
  })
})
```

**Преимущества оптимизации:**
- ✅ Загрузка данных из Supabase **один раз** для всех тестов
- ✅ **~10x быстрее** - нет повторной загрузки пользователей/разрешений перед каждым тестом
- ✅ **Меньше нагрузки** на Supabase (меньше queries, Realtime подписок)
- ✅ Тесты остаются изолированными через `afterEach` cleanup

### Импорт auth.fixture

**ВСЕГДА** используйте `test` и `expect` из `auth.fixture.ts`:

```typescript
// ✅ ПРАВИЛЬНО
import { test, expect } from '../fixtures/auth.fixture'
import { test, expect } from '../../fixtures/auth.fixture'

// ❌ НЕПРАВИЛЬНО - тесты не будут авторизованы!
import { test, expect } from '@playwright/test'
```

### Helper классы

Каждый модуль должен иметь helper класс для взаимодействия со страницей:

```typescript
// tests/users/helpers/users-page.helper.ts
export class UsersPageHelper {
  constructor(private page: Page) {}

  async goto(tab?: TabType): Promise<void> {
    // Navigation logic
  }

  async search(query: string): Promise<void> {
    // Search logic
  }

  // ... other methods
}
```

### ⚠️ Тесты с перезагрузкой страницы (Page Reload)

**Важно:** Если нужно протестировать восстановление состояния после перезагрузки (persistence после reload), группируйте такие тесты **в конце файла** в отдельном `test.describe.serial` блоке:

```typescript
// ===========================================================================
// ⚠️ Persistence Tests with Page Reload
// ===========================================================================
// These tests explicitly reload the page to verify persistence functionality.
// They are grouped at the end and run serially to minimize Supabase load.
// Each reload will re-fetch ~538 users, permissions, and notifications.

test.describe.serial('Persistence Tests (with Page Reload)', () => {
  test('filters restored from URL on page reload', async () => {
    // Setup state
    await usersPage.selectFilter('DEPARTMENT', 'IT')
    await sharedPage.waitForTimeout(1000)

    // ⚠️ This reload will trigger full page re-initialization
    await sharedPage.reload()
    await usersPage.waitForUsersLoaded()

    // Verify state restored
    const count = await usersPage.getFilterCount('DEPARTMENT')
    expect(count).toBeGreaterThan(0)
  })
})
```

**Почему это важно:**
- ⚠️ Каждый `reload()` вызывает **полную перезагрузку страницы**
- ⚠️ Это приводит к повторной загрузке ~538 пользователей, разрешений, уведомлений из Supabase
- ✅ Группировка reload-тестов в конце минимизирует количество перезагрузок
- ✅ `test.describe.serial` гарантирует последовательное выполнение (один reload за раз)

## Troubleshooting

### Тесты падают с "unauthorized"

```bash
# Перезапустите авторизацию
npx playwright test --project=setup
```

### Тесты долго запускаются

- Используйте `npm run test:ui` (production build)
- Избегайте `npm run test:ui:dev` (медленный dev server)

### Селекторы не работают

- Проверьте актуальность селекторов в `constants/selectors.ts`
- Используйте Playwright Inspector: `npx playwright test --debug`

### Не находит элементы после первого теста

- Используйте `test.beforeEach` для очистки состояния
- Вызывайте `clearStorage()` в helper

## CI/CD

В CI/CD pipeline:

```yaml
- name: Install dependencies
  run: npm ci

- name: Install Playwright
  run: npx playwright install --with-deps

- name: Run auth setup
  run: npx playwright test --project=setup
  env:
    ADMIN_EMAIL: ${{ secrets.ADMIN_EMAIL }}
    ADMIN_PASSWORD: ${{ secrets.ADMIN_PASSWORD }}

- name: Run tests
  run: npm run test
```

## Полезные ссылки

- [Playwright Documentation](https://playwright.dev)
- [Best Practices](https://playwright.dev/docs/best-practices)
- [Selectors](https://playwright.dev/docs/selectors)
- [Debugging](https://playwright.dev/docs/debug)
