# Глобальное состояние через Redux Toolkit в eneca.work

## Зачем внедрён Redux

Redux Toolkit используется для централизованного управления состоянием пользователя, UI и настроек приложения. Это облегчает обмен данными между модулями, делает код более предсказуемым и масштабируемым.

---

## Структура store

```
store/
├── index.ts           // создание и экспорт store
├── userSlice.ts       // слайс пользователя (user)
├── uiSlice.ts         // слайс для UI-состояния (лоадер, уведомления)
└── settingsSlice.ts   // слайс для настроек приложения
```

---

## Основные слайсы

### userSlice
- Хранит id, email, name пользователя и флаг isAuthenticated.
- Экспортирует экшены setUser и clearUser.

### uiSlice
- Хранит состояние loading и notification (глобальный лоадер и уведомления).
- Экспортирует экшены setLoading, setNotification, clearNotification.

### settingsSlice
- Хранит глобальные настройки (например, theme).
- Экспортирует экшен setTheme.

---

## Подключение Redux к приложению

В файле `app/layout.tsx` приложение обёрнуто в `<Provider store={store}>`, чтобы глобальное состояние было доступно во всех компонентах.

```tsx
import { Provider } from 'react-redux'
import { store } from '@/store'
...
<Provider store={store}>
  <ThemeProvider ...>
    {children}
  </ThemeProvider>
</Provider>
```

---

## Типизированные хуки

Для удобной и безопасной работы с Redux созданы хуки:
- `useAppDispatch` — типизированный useDispatch
- `useAppSelector` — типизированный useSelector

Они лежат в папке hooks/ и используются вместо стандартных хуков из react-redux.

---

## Как использовать глобальное состояние в компонентах

1. Импортируй нужный хук:
   ```ts
   import { useAppSelector, useAppDispatch } from '@/hooks'
   ```
2. Получи данные из store:
   ```ts
   const user = useAppSelector(state => state.user)
   const loading = useAppSelector(state => state.ui.loading)
   ```
3. Диспатч экшены:
   ```ts
   const dispatch = useAppDispatch()
   dispatch(setUser({ id, email, name }))
   dispatch(setLoading(true))
   ```

---

## Как модули могут расширять store

- Каждый модуль может создать свой redux-слайс и вручную добавить его в store (в файле store/index.ts).
- Для доступа к состоянию использовать хуки useAppSelector и useAppDispatch.

---

## Рекомендации
- Не хранить большие объёмы данных в store — только то, что действительно нужно глобально.
- Общие хуки и утилиты выносить в lib/hooks и lib/utils.
- Документировать структуру store и правила добавления новых слайсов. 