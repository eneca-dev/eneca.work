# Руководство по разработке с Zustand для нейросетей

## Общие принципы

1. **Один стор - одна функциональность**
   - Создавайте отдельные сторы для разных доменных областей
   - Избегайте создания единого глобального стора с всем состоянием приложения

2. **Четкая структура файлов**
   - Размещайте сторы в директории `store` или `stores`
   - Используйте названия файлов в формате `use[DomainName]Store.ts` (например, `useUserStore.ts`, `useCartStore.ts`)

3. **Всегда используйте TypeScript**
   - Определяйте интерфейс для состояния стора
   - Типизируйте все параметры и возвращаемые значения функций

4. **Избегайте циклических зависимостей**
   - Не импортируйте сторы друг в друга напрямую
   - При необходимости взаимодействия используйте реактивные хуки

## Шаблон создания стора

```typescript
// store/use[Name]Store.ts
import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'

// Интерфейс состояния
interface [Name]State {
  // Данные состояния
  data: SomeType | null;
  isLoading: boolean;
  error: string | null;
  
  // Синхронные действия
  setData: (data: SomeType) => void;
  clearData: () => void;
  setError: (error: string | null) => void;
  
  // Асинхронные действия
  fetchData: (id: string) => Promise<void>;
  updateData: (payload: UpdatePayload) => Promise<void>;
}

// Создание стора
export const use[Name]Store = create<[Name]State>()(
  devtools(
    persist(
      (set, get) => ({
        // Начальное состояние
        data: null,
        isLoading: false,
        error: null,
        
        // Синхронные действия
        setData: (data) => set({ data }),
        clearData: () => set({ data: null }),
        setError: (error) => set({ error }),
        
        // Асинхронные действия
        fetchData: async (id) => {
          try {
            set({ isLoading: true, error: null });
            const response = await fetch(`/api/endpoint/${id}`);
            if (!response.ok) throw new Error('Ошибка получения данных');
            const data = await response.json();
            set({ data, isLoading: false });
          } catch (error) {
            set({ error: error.message, isLoading: false });
          }
        },
        updateData: async (payload) => {
          // Реализация обновления данных
        }
      }),
      {
        name: '[name]-storage', // название для localStorage
        partialize: (state) => ({ data: state.data }), // сохраняем только data
      }
    )
  )
);
```

## Правила работы с состоянием

1. **Обновление состояния**
   - Используйте функцию `set` для обновления состояния
   - Обновляйте только необходимые поля, а не все состояние целиком
   - Возвращайте новые объекты, а не мутируйте существующие

```typescript
// Правильно
set({ count: get().count + 1 });

// Неправильно
get().count += 1;
```

2. **Получение состояния**
   - Используйте функцию `get()` для доступа к текущему состоянию внутри действий
   - Не храните состояние в переменных вне стора

3. **Обработка асинхронных операций**
   - Всегда обрабатывайте состояния загрузки (`isLoading`)
   - Всегда обрабатывайте состояния ошибок (`error`)
   - Управляйте этими состояниями в начале и конце асинхронных операций

```typescript
const fetchData = async () => {
  set({ isLoading: true, error: null });
  try {
    const response = await api.get('/data');
    set({ data: response.data, isLoading: false });
  } catch (error) {
    set({ error: error.message, isLoading: false });
  }
};
```

## Использование в компонентах

1. **Выборочный доступ к состоянию**
   - Используйте селекторы для получения только необходимых частей состояния
   - Это предотвращает ненужные ререндеринги компонентов

```typescript
// Правильно: компонент перерендерится только при изменении user
const { user } = useUserStore(state => ({ user: state.user }));

// Неправильно: компонент перерендерится при любом изменении стора
const { user } = useUserStore();
```

2. **Доступ к действиям**
   - Выбирайте только необходимые действия для компонента
   - Можно сгруппировать состояние и действия в одном селекторе

```typescript
const { count, increment } = useCounterStore(state => ({
  count: state.count,
  increment: state.increment
}));
```

## Паттерны композиции сторов

1. **Комбинирование сторов**
   - Используйте функциональный подход для создания производных данных

```typescript
// В компоненте
const user = useUserStore(state => state.user);
const orders = useOrderStore(state => state.orders);

// Фильтрация данных
const userOrders = orders.filter(order => order.userId === user.id);
```

2. **Взаимодействие между сторами**
   - Импортируйте другие сторы внутри действий, не в корне стора

```typescript
const useCartStore = create<CartState>()((set, get) => ({
  // ...состояние и другие действия
  
  checkout: async () => {
    const { items } = get();
    const { user } = useUserStore.getState();
    
    try {
      set({ isProcessing: true });
      await api.post('/checkout', { items, userId: user.id });
      set({ items: [], isProcessing: false });
      
      // Обновить заказы в другом сторе
      useOrderStore.getState().fetchOrders(user.id);
    } catch (error) {
      set({ error: error.message, isProcessing: false });
    }
  }
}));
```

## Middleware и расширения

1. **Devtools** 
   - Всегда используйте `devtools` middleware для отладки в development

```typescript
import { devtools } from 'zustand/middleware'

const useStore = create()(
  devtools(
    (set) => ({
      // состояние и действия
    })
  )
);
```

2. **Persist**
   - Используйте `persist` для сохранения состояния между сессиями
   - Контролируйте, какие части состояния сохраняются

```typescript
import { persist } from 'zustand/middleware'

const useStore = create()(
  persist(
    (set) => ({
      // состояние и действия
    }),
    {
      name: 'store-name',  // уникальное имя
      partialize: (state) => ({ 
        // сохраняем только нужные поля
        user: state.user,
        theme: state.theme,
        // исключаем временные состояния
        // isLoading, errors и т.д.
      }),
    }
  )
);
```

## Рекомендации для генерации кода нейросетями

1. **Создание базового стора**
```
Создай стор Zustand для [описание функциональности].
Включи следующие состояния: [список состояний].
Реализуй следующие действия: [список действий].
Используй TypeScript и следуй структуре из шаблона.
```

2. **Добавление асинхронных действий**
```
Добавь в стор [название] асинхронное действие для [описание операции].
Обработай состояния загрузки и ошибок.
Интегрируй с API [описание API].
```

3. **Связь между сторами**
```
Реализуй взаимодействие между стором [стор А] и [стор Б].
Действие [название] должно обновлять данные в [стор Б] после [условие].
```

4. **Использование в компоненте**
```
Создай компонент React, который использует данные из стора [название].
Компонент должен отображать [описание UI].
Реализуй обработку [действие] при [событие пользователя].
```

## Антипаттерны, которых следует избегать

1. **Прямая мутация состояния**
   ```typescript
   // Не делайте так:
   get().items.push(newItem);
   ```

2. **Хранение всего состояния приложения в одном сторе**
   - Разделяйте состояние на логические домены

3. **Избыточное использование persist middleware**
   - Не сохраняйте временные состояния и большие объемы данных

4. **Чрезмерная детализация сторов**
   - Не создавайте отдельный стор для каждого небольшого кусочка состояния

5. **Использование сторов вместо локального состояния**
   - Для компонент-специфичного состояния используйте `useState` или `useReducer`

## Тестирование сторов

1. **Базовое тестирование стора**
   ```typescript
   describe('userStore', () => {
     it('should update user when setUser is called', () => {
       const user = { id: '1', name: 'John' };
       useUserStore.getState().setUser(user);
       expect(useUserStore.getState().user).toEqual(user);
     });
   });
   ```

2. **Тестирование асинхронных действий**
   - Используйте моки для API-запросов
   - Проверяйте промежуточные состояния (loading, error)

## Миграция с Redux на Zustand

При миграции с Redux на Zustand следуйте этим рекомендациям:

1. Сначала мигрируйте простые, самодостаточные слайсы
2. Преобразуйте Redux-actions в функции стора
3. Замените селекторы прямым доступом к состоянию или создайте функции-селекторы
4. При наличии сложных middleware рассмотрите их перенос в отдельные утилиты
