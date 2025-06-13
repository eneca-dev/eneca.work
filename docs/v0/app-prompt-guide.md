# Руководство по приложению для нейросети

## Технологии приложения

- **Frontend Framework**: Next.js 15.2.4 с React 19
- **Стилизация**: Tailwind CSS с утилитами clsx и tailwind-merge
- **UI компоненты**: Радикс UI (Radix UI) - полный набор компонентов с доступностью
- **Темизация**: next-themes для поддержки темной/светлой темы
- **Управление состоянием**: Zustand 5.0.3 с middleware devtools и persist
- **Формы**: react-hook-form с валидацией zod
- **База данных**: Supabase с аутентификацией и SSR интеграцией (@supabase/ssr)
- **Иконки**: Lucide React
- **Уведомления**: Sonner для тостов

## Полная структура приложения

```
/
├── app/                      # Директория Next.js App Router
│   ├── api/                  # API маршруты
│   ├── auth/                 # Аутентификация
│   │   ├── login/            # Страница входа
│   │   ├── register/         # Страница регистрации
│   │   ├── forgot-password/  # Восстановление пароля
│   │   └── reset-password/   # Сброс пароля
│   ├── dashboard/            # Защищенные страницы
│   │   ├── projects/         # Страницы проектов
│   │   ├── clients/          # Страницы клиентов
│   │   ├── users/            # Управление пользователями
│   │   ├── settings/         # Настройки приложения
│   │   └── ...               # Другие страницы дашборда
│   ├── globals.css           # Глобальные стили
│   ├── layout.tsx            # Корневой макет
│   └── page.tsx              # Главная страница
│
├── components/               # Переиспользуемые компоненты
│   ├── auth/                 # Компоненты для аутентификации
│   ├── dashboard/            # Компоненты для дашборда
│   │   ├── header.tsx        # Шапка дашборда
│   │   ├── sidebar.tsx       # Боковая панель
│   │   └── ...
│   ├── forms/                # Компоненты форм
│   ├── modals/               # Модальные окна
│   ├── tables/               # Компоненты таблиц
│   ├── ui/                   # Базовые UI компоненты
│   │   ├── button.tsx        # Кнопка
│   │   ├── form.tsx          # Компоненты форм
│   │   ├── input.tsx         # Поле ввода
│   │   ├── select.tsx        # Выпадающий список
│   │   ├── dialog.tsx        # Диалоговое окно
│   │   ├── toast.tsx         # Уведомления
│   │   ├── card.tsx          # Карточка
│   │   └── ...               # Другие UI компоненты
│   ├── layout/               # Компоненты макетов
│   ├── theme-provider.tsx    # Провайдер темы
│   └── theme-toggle.tsx      # Переключатель темы
│
├── hooks/                    # React-хуки
│   ├── use-media-query.ts    # Хук для медиа-запросов
│   ├── use-debounce.ts       # Хук для debounce
│   └── ...                   # Другие хуки
│
├── lib/                      # Библиотеки и утилиты
│   ├── utils.ts              # Общие утилиты
│   ├── validation.ts         # Схемы валидации
│   └── constants.ts          # Константы
│
├── modules/                  # Функциональные модули
│   ├── users/                # Модуль пользователей
│   │   ├── components/       # Компоненты модуля
│   │   ├── hooks/            # Специфичные хуки
│   │   ├── store.ts          # Store модуля (если нужен)
│   │   ├── UserPage.tsx      # Главная страница модуля
│   │   └── UserMenu.tsx      # Меню модуля для бокового меню
│   ├── projects/             # Модуль проектов
│   │   ├── components/       # Компоненты модуля
│   │   ├── hooks/            # Специфичные хуки
│   │   ├── types.ts          # Типы данных модуля
│   │   ├── store.ts          # Store модуля
│   │   ├── utils.ts          # Утилиты модуля
│   │   ├── ProjectPage.tsx   # Главная страница модуля
│   │   └── ProjectMenu.tsx   # Меню модуля для бокового меню
│   └── ...                   # Другие модули
│
├── public/                   # Статические файлы
│   ├── images/               # Изображения
│   ├── fonts/                # Шрифты
│   └── ...                   # Другие статические файлы
│
├── stores/                   # Хранилища Zustand
│   ├── index.ts              # Экспорт хранилищ
│   ├── useUserStore.ts       # Хранилище пользователя
│   ├── useSettingsStore.ts   # Хранилище настроек
│   ├── useUiStore.ts         # Хранилище UI-состояния
│   └── ...                   # Другие глобальные хранилища
│
├── styles/                   # Стили
│   └── globals.css           # Глобальные стили и темы
│
├── types/                    # TypeScript типы
│   ├── supabase.ts           # Типы для Supabase
│   ├── api.ts                # Типы API
│   └── ...                   # Другие типы
│
├── utils/                    # Утилиты
│   ├── api/                  # Утилиты для API
│   ├── form/                 # Утилиты для форм
│   ├── date/                 # Утилиты для работы с датами
│   └── supabase/             # Клиенты Supabase
│       ├── client.ts         # Клиент для браузера
│       ├── server.ts         # Клиент для сервера
│       └── middleware.ts     # Middleware для сессий
│
├── middleware.ts             # Next.js middleware
├── package.json              # Зависимости проекта
├── tsconfig.json             # Настройки TypeScript
├── next.config.mjs           # Настройки Next.js
└── tailwind.config.ts        # Настройки Tailwind CSS
```

## Рекомендации по размещению файлов для новых модулей

При разработке нового модуля (например, "client-management"), следуйте этим рекомендациям:

### 1. Основная структура модуля

Создайте директорию для модуля в папке `modules/`:

```
modules/
└── client-management/           # Название модуля
    ├── components/              # Компоненты, специфичные для модуля
    │   ├── ClientForm.tsx       # Форма клиента
    │   ├── ClientList.tsx       # Список клиентов
    │   └── ...
    ├── hooks/                   # Хуки модуля
    │   ├── useClients.ts        # Хук для работы с клиентами
    │   └── ...
    ├── types.ts                 # Типы данных модуля
    ├── store.ts                 # Store Zustand для модуля (локальный)
    ├── utils.ts                 # Утилиты модуля
    ├── ClientPage.tsx           # Основная страница модуля
    └── ClientMenu.tsx           # Компонент для бокового меню
```

### 2. Связь модуля с основным приложением

#### Страницы в App Router

Создайте соответствующие страницы в `app/dashboard/`:

```tsx
// app/dashboard/clients/page.tsx
import ClientPage from '@/modules/client-management/ClientPage';

export default function Page() {
  return <ClientPage />;
}
```

#### Интеграция в меню

Добавьте компонент меню в боковую панель:

```tsx
// components/dashboard/sidebar.tsx
import { ClientMenu } from '@/modules/client-management/ClientMenu';

export function Sidebar() {
  return (
    <nav>
      {/* Другие пункты меню */}
      <ClientMenu />
    </nav>
  );
}
```

### 3. Управление состоянием

#### Локальное состояние модуля

Если состояние используется только внутри модуля:

```tsx
// modules/client-management/store.ts
import { create } from 'zustand';

type ClientState = {
  // определение состояния
};

export const useClientStore = create<ClientState>((set) => ({
  // реализация состояния
}));
```

#### Глобальное состояние

Если состояние нужно сделать глобальным:

1. Создайте файл `stores/useClientStore.ts`:

```tsx
// stores/useClientStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type ClientState = {
  // определение состояния
};

export const useClientStore = create<ClientState>()(
  persist(
    (set) => ({
      // реализация состояния
    }),
    {
      name: 'client-storage',
    }
  )
);
```

2. Добавьте экспорт в `stores/index.ts`:

```tsx
// stores/index.ts
export * from './useUserStore';
export * from './useSettingsStore';
export * from './useUiStore';
export * from './useClientStore'; // Добавить эту строку
```

### 4. Стили и темы

Все стили компонентов должны использовать Tailwind CSS и следовать принципам дизайн-системы. Если нужны дополнительные глобальные стили:

1. Для компонент-специфичных стилей используйте Tailwind в самих компонентах
2. Для глобальных стилей модифицируйте файл `styles/globals.css`:

```css
/* styles/globals.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer components {
  /* Добавьте здесь стили для модуля */
  .client-card {
    /* стили */
  }
}
```

### 5. Доступ к данным Supabase

Используйте соответствующие клиенты Supabase:

```tsx
// Для клиентских компонентов
import { createClient } from '@/utils/supabase/client';

export function ClientComponent() {
  const fetchClients = async () => {
    const supabase = createClient();
    const { data, error } = await supabase.from('clients').select('*');
    // обработка данных
  };
  
  // остальной код компонента
}

// Для серверных компонентов и Server Actions
import { createClient } from '@/utils/supabase/server';

export async function ServerComponent() {
  const supabase = createClient();
  const { data } = await supabase.from('clients').select('*');
  
  return (
    <div>
      {/* Отображение данных */}
    </div>
  );
}
```

### 6. Формы и валидация

Используйте установленные библиотеки для форм и компоненты UI:

```tsx
// modules/client-management/components/ClientForm.tsx
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';

// Схема валидации
const formSchema = z.object({
  name: z.string().min(1, 'Имя клиента обязательно'),
  email: z.string().email('Введите корректный email'),
});

type FormValues = z.infer<typeof formSchema>;

export function ClientForm() {
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      email: '',
    },
  });

  const onSubmit = (values: FormValues) => {
    // Обработка отправки формы
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Название</FormLabel>
              <FormControl>
                <Input placeholder="Введите название клиента" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {/* Другие поля формы */}
        <Button type="submit">Сохранить</Button>
      </form>
    </Form>
  );
}
```


### 8. Работа с модальными окнами

Используйте компоненты UI для модальных окон:

```tsx
// modules/client-management/components/ClientDialog.tsx
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { ClientForm } from './ClientForm';

export function ClientDialog() {
  const [open, setOpen] = useState(false);
  
  return (
    <>
      <Button onClick={() => setOpen(true)}>Добавить клиента</Button>
      
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Новый клиент</DialogTitle>
          </DialogHeader>
          <ClientForm />
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Отмена</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
```


## Работа с темой

Управление темой в приложении реализовано через комбинацию Zustand стора и next-themes с синхронизацией между ними.

### Архитектура управления темой

1. **Основной стор**: `stores/useSettingsStore.ts` - хранит настройки темы в состоянии приложения
2. **Синхронизация**: `hooks/useThemeSync.ts` - синхронизирует состояние между Zustand и next-themes
3. **UI компонент**: `components/theme-toggle.tsx` - кнопка переключения темы
4. **Расположение**: кнопка находится в боковом меню (`components/sidebar.tsx`)

### Использование темы в компонентах

```typescript
// Получение текущей темы из стора
import { useSettingsStore } from '@/stores/useSettingsStore'

const { theme } = useSettingsStore()
// theme может быть: 'light' | 'dark' | 'system'

// Для получения актуальной темы (учитывая system):
import { useThemeSync } from '@/hooks/useThemeSync'
const { resolvedTheme } = useThemeSync()
// resolvedTheme будет 'light' или 'dark'
```

### Стили темы

- CSS переменные для тем находятся в `globals.css`
- Все компоненты должны поддерживать темную и светлую тему
- Используйте Tailwind классы с префиксом `dark:` для темной темы
- Проверяйте отображение компонентов в обеих темах

### Интеграция в новые компоненты

При создании новых компонентов, которые требуют знания текущей темы:

```typescript
import { useSettingsStore } from '@/stores/useSettingsStore'
import { useTheme } from 'next-themes'

// Для простых случаев
const { theme } = useSettingsStore()

// Для получения resolved темы
const { resolvedTheme } = useTheme()
const settingsTheme = useSettingsStore(state => state.theme)

const effectiveTheme = settingsTheme === 'system' 
  ? (resolvedTheme === 'dark' ? 'dark' : 'light')
  : settingsTheme
```

## Работа с базой данных Supabase

При необходимости добавления новых таблиц в базу данных, следуйте структуре, описанной в [`docs/database-schema.md`](docs/database-schema.md). Определите новые таблицы, их связи и обновите документацию.

## Разработка и интеграция модулей

### Что такое модуль

Модуль — это независимый функциональный блок (например, календарь, задачи, аналитика), который разрабатывается и тестируется отдельно, а затем интегрируется в основной проект.

### Структура папки модуля

```
modules/
└── example/
    ├── components/          # Компоненты модуля
    ├── hooks/               # Хуки модуля
    ├── types.ts             # Типы данных
    ├── store.ts             # Локальное хранилище (опционально)
    ├── ExamplePage.tsx      # Главная страница модуля
    └── ExampleMenu.tsx      # Компонент для бокового меню
```

### Как добавить новый модуль

1. Создайте папку в `modules/` (например, `modules/calendar`).
2. Реализуйте необходимые компоненты, хуки и типы.
3. Создайте страницу модуля (например, `CalendarPage.tsx`).
4. Создайте компонент меню (`CalendarMenu.tsx`).
5. Интегрируйте страницу в App Router (создав файл в `app/dashboard/calendar/page.tsx`).
6. Добавьте компонент меню в Sidebar.
7. При необходимости создайте глобальное хранилище в папке `stores/`.

### Пример кода для модуля

```tsx
// modules/calendar/CalendarPage.tsx
import { createClient } from '@/utils/supabase/client';
import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';

export default function CalendarPage() {
  const [events, setEvents] = useState([]);
  
  useEffect(() => {
    const fetchEvents = async () => {
      const supabase = createClient();
      const { data } = await supabase.from('events').select('*');
      if (data) setEvents(data);
    };
    
    fetchEvents();
  }, []);
  
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Календарь событий</h1>
      <div className="grid gap-4">
        {events.map(event => (
          <Card key={event.id} className="p-4">
            <h2>{event.title}</h2>
            <p>{event.date}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}

// modules/calendar/CalendarMenu.tsx
import { CalendarIcon } from 'lucide-react';
import Link from 'next/link';

export function CalendarMenu() {
  return (
    <Link 
      href="/dashboard/calendar" 
      className="flex items-center p-2 hover:bg-accent rounded-md"
    >
      <CalendarIcon className="mr-2 h-4 w-4" />
      <span>Календарь</span>
    </Link>
  );
}
```

## Список ключевых файлов для разработки новых модулей

При разработке нового функционала рекомендуется предоставить нейросети следующие ключевые файлы:

### Конфигурация приложения
- `package.json` - зависимости и скрипты
- `tailwind.config.ts` - настройки Tailwind CSS
- `tsconfig.json` - конфигурация TypeScript
- `next.config.mjs` - конфигурация Next.js

### Хранилища состояния
- `stores/index.ts` - экспорты хранилищ
- `stores/useUserStore.ts` - хранилище данных пользователя
- `stores/useSettingsStore.ts` - хранилище настроек
- `stores/useUiStore.ts` - хранилище состояния UI

### Стили и темы
- `styles/globals.css` - глобальные стили и переменные темы
- `components/theme-provider.tsx` - провайдер темы
- `components/theme-toggle.tsx` - переключатель темы

### Разметка страниц
- `app/layout.tsx` - основной лейаут
- `app/dashboard/layout.tsx` - лейаут дашборда

### Утилиты
- `lib/utils.ts` - утилиты для работы с классами

