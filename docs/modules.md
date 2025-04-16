# Модули eneca.work

## Что такое модуль

Модуль — это независимый функциональный блок (например, календарь, задачи, аналитика), который разрабатывается и тестируется отдельно, а затем интегрируется в материнский проект.

## Структура папки модуля

```
modules/
└── example/
    ├── ExamplePage.tsx
    ├── ExampleMenu.tsx
    └── (опционально) store.ts
```

## Как добавить новый модуль

1. Создай папку в modules/ (например, modules/calendar).
2. Реализуй страницу (CalendarPage.tsx) и меню (CalendarMenu.tsx).
3. Импортируй CalendarMenu в Sidebar и CalendarPage в роутинг.
4. (Опционально) Если нужен redux-слайс — добавь его в store.
5. Проверь, что модуль не нарушает архитектурные правила (см. rules.md).

## Интеграция модуля

- Меню модуля добавляется вручную в Sidebar.
- Страница модуля добавляется вручную в роутинг (app/dashboard или app/).
- Если модулю нужно глобальное состояние — слайс добавляется в store/index.ts.

## Пример кода для модуля

```tsx
// modules/calendar/CalendarMenu.tsx
export function CalendarMenu() {
  return <MenuItem to="/dashboard/calendar">Календарь</MenuItem>
}

// modules/calendar/CalendarPage.tsx
export default function CalendarPage() {
  return <div>Здесь будет календарь компании</div>
}
```

## Рекомендации

- Соблюдай структуру и стандарты именования.
- Документируй особенности модуля, если они есть.
- Не дублируй код — выноси общие части в core. 