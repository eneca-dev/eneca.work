# AI Dashboard Module

Модуль для аналитики данных с использованием AI агента.

## 🎯 Описание

AI Dashboard предоставляет универсальный интерфейс для взаимодействия с AI агентом. Модуль поддерживает различные форматы ответов (текст, таблицы, графики) и обеспечивает бесшовную интеграцию с существующей архитектурой приложения.

## 🏗️ Архитектура

### Структура модуля

```
modules/ai-dashboard/
├── components/              # React компоненты
│   ├── AIAnalyticsPage.tsx # Главная страница
│   ├── InputSection.tsx    # Секция ввода
│   ├── ResultRenderer.tsx  # Рендерер результатов
│   ├── LoadingState.tsx    # Состояние загрузки
│   ├── widgets/            # Widget система
│   │   ├── TextWidget.tsx  # Markdown текст
│   │   ├── TableWidget.tsx # Табличные данные
│   │   └── ErrorWidget.tsx # Обработка ошибок
│   └── index.ts            # Экспорты
├── hooks/
│   ├── useAIAnalytics.ts   # Основной хук
│   └── index.ts            # Экспорты
├── services/
│   └── aiAgentService.ts   # API интеграция (Mock/Real)
├── types.ts                # TypeScript типы
├── index.ts                # Public API
└── README.md               # Эта документация
```

### Ключевые компоненты

- **Hook:** `useAIAnalytics` - управление состоянием и запросами
- **Service:** `aiAgentService` - Mock/Real API интеграция
- **Components:** Widget system для универсального рендеринга

## 📦 Установка и использование

### Использование в Next.js page

```tsx
import { AIAnalyticsPage } from '@/modules/ai-dashboard'

export default function Page() {
  return <AIAnalyticsPage />
}
```

### Использование хука напрямую

```tsx
'use client'

import { useAIAnalytics } from '@/modules/ai-dashboard'

export function MyComponent() {
  const { isLoading, error, result, runAnalysis, reset } = useAIAnalytics()

  const handleAnalysis = async () => {
    await runAnalysis('Покажи топ 5 проектов по бюджету')
  }

  return (
    <div>
      <button onClick={handleAnalysis} disabled={isLoading}>
        Запустить анализ
      </button>
      {result && <div>{result.response.type}</div>}
    </div>
  )
}
```

## ⚙️ Конфигурация

### Environment Variables

Добавьте в `.env.local`:

```bash
# AI Dashboard Configuration
NEXT_PUBLIC_AI_MOCK=true  # true для mock режима, false для real API
NEXT_PUBLIC_AI_AGENT_URL=https://ai-bot.eneca.work/analytics
```

### Mock режим (разработка)

В mock режиме модуль использует предопределенные ответы:

```typescript
const MOCK_RESPONSES = {
  'проект': { type: 'table', columns: [...], rows: [...] },
  'бюджет': { type: 'mixed', summary: '...', data: {...} },
  'задач': { type: 'text', content: '...' },
  default: { type: 'mixed', ... }
}
```

Ключевые слова в запросе триггерят соответствующий mock ответ.

## 🎨 Форматы ответов

### 1. Text (Markdown)

```json
{
  "type": "text",
  "content": "## Заголовок\n\nТекст с **форматированием**..."
}
```

### 2. Table (Табличные данные)

```json
{
  "type": "table",
  "columns": ["Название", "Статус", "Прогресс"],
  "rows": [
    { "Название": "Проект А", "Статус": "В работе", "Прогресс": "75%" },
    { "Название": "Проект Б", "Статус": "Завершен", "Прогресс": "100%" }
  ]
}
```

### 3. Mixed (Текст + Данные)

```json
{
  "type": "mixed",
  "summary": "## Анализ\n\nРезультаты анализа...",
  "data": {
    "type": "table",
    "columns": ["Col1", "Col2"],
    "rows": [...]
  }
}
```

### 4. Chart (Графики) - будущее

```json
{
  "type": "chart",
  "chartType": "line",
  "data": [...]
}
```

## 🔌 API интеграция

### Real API Requirements

AI агент должен принимать POST запрос:

```bash
POST https://ai-bot.eneca.work/analytics
Content-Type: application/json

{
  "query": "Покажи топ 5 проектов по бюджету"
}
```

И возвращать JSON в одном из поддерживаемых форматов (см. выше).

### Универсальный парсер

Модуль автоматически парсит различные форматы:

- Структурированный JSON с `type` полем
- Простой текст/markdown
- `summary + data` формат
- Fallback в JSON строку

## 🎯 Типы TypeScript

```typescript
import type {
  AIResponse,
  AITextResponse,
  AITableResponse,
  AIMixedResponse,
  AnalyticsResult,
  AIAnalyticsState
} from '@/modules/ai-dashboard'
```

## 🧪 Тестирование

### 1. Mock режим

```bash
# .env.local
NEXT_PUBLIC_AI_MOCK=true

# Запуск
npm run dev

# Перейти на http://localhost:3000/ai-dashboard
```

### 2. Тестовые запросы

- **"проект"** → таблица проектов
- **"бюджет"** → mixed response (summary + table)
- **"задач"** → текстовая статистика
- **Любой другой** → default response

### 3. Real API

```bash
# .env.local
NEXT_PUBLIC_AI_MOCK=false
NEXT_PUBLIC_AI_AGENT_URL=https://ai-bot.eneca.work/analytics

# Запуск
npm run dev
```

## 🎨 Стилизация

Модуль следует дизайн-системе проекта:

- **Цвета:** `slate` для фонов, `amber-500` для акцентов
- **Темная тема:** Полная поддержка через `dark:` классы
- **Карточки:** `rounded-lg shadow-md hover:shadow-lg transition-all`
- **Иконки:** `lucide-react` (Sparkles для AI)

## 📚 Зависимости

Все зависимости уже установлены:

- ✅ `lucide-react` - иконки
- ✅ `react-markdown` - рендеринг markdown
- ✅ Shadcn/ui компоненты (Button и др.)
- ✅ Tailwind CSS

## 🚀 Будущие улучшения

- [ ] История запросов (localStorage/БД)
- [ ] Chart.js интеграция для графиков
- [ ] Экспорт результатов (CSV, PDF)
- [ ] Streaming ответы (как ChatGPT)
- [ ] Кеширование через TanStack Query
- [ ] Голосовой ввод
- [ ] Шаринг результатов

## 📝 Примеры использования

### Базовое использование

```tsx
'use client'

import { AIAnalyticsPage } from '@/modules/ai-dashboard'

export default function AnalyticsPage() {
  return <AIAnalyticsPage />
}
```

### Кастомная интеграция

```tsx
'use client'

import { useAIAnalytics, InputSection, ResultRenderer } from '@/modules/ai-dashboard'

export function CustomAnalytics() {
  const { isLoading, error, result, runAnalysis } = useAIAnalytics()

  return (
    <div>
      <InputSection onSubmit={runAnalysis} isLoading={isLoading} />
      <ResultRenderer result={result} error={error} />
    </div>
  )
}
```

## ⚠️ Важные замечания

**Модуль изолирован** - не требует изменений в:
- ❌ Database schema
- ❌ Cache module
- ❌ Permission system
- ❌ Других модулях

**Изменения были сделаны только в:**
- ✅ `components/sidebar.tsx` - добавлен пункт меню
- ✅ `modules/ai-dashboard/` - новый модуль
- ✅ `app/(dashboard)/ai-dashboard/` - новый route

## 📄 Лицензия

Частная разработка для ENECA Work.
