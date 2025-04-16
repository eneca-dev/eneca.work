# Аутентификация и хранение состояния пользователя в eneca.work

## Как происходит аутентификация

1. **Вход пользователя**
   - Пользователь вводит email и пароль на странице входа.
   - На клиенте вызывается:
     ```ts
     const { error } = await supabase.auth.signInWithPassword({ email, password })
     ```
   - Если вход успешен, Supabase возвращает токены (access, refresh), которые сохраняются в cookie с именем `sb-...`.

2. **Проверка сессии**
   - На защищённых страницах (например, `/dashboard`) сервер или клиент вызывает:
     ```ts
     const { data: { user } } = await supabase.auth.getUser()
     ```
   - Supabase SDK автоматически берёт токен из cookie, отправляет его на сервер Supabase, и если токен валиден — возвращает объект пользователя.

3. **Middleware**
   - В middleware (`utils/supabase/middleware.ts`) происходит синхронизация сессии между клиентом и сервером через cookie.

4. **В базе данных Supabase**
   - Вся информация о пользователях хранится в таблице `auth.users`.
   - Пример данных:
     - id: уникальный идентификатор пользователя (UUID)
     - email: email пользователя
     - created_at: дата создания
     - last_sign_in_at: дата последнего входа
     - confirmed_at: подтверждён ли email
     - is_sso_user: признак SSO (single sign-on)

## Где хранится состояние аутентификации

- **В браузере:**
  - Основное состояние аутентификации (access token, refresh token, информация о сессии) хранится в cookie Supabase (`sb-...`).22
  - Эта cookie автоматически отправляется при каждом запросе к серверу и Supabase.

- **На сервере:**
  - Сервер и middleware читают cookie Supabase из запроса, чтобы определить, авторизован ли пользователь.
  - Supabase SDK использует токен из cookie для проверки пользователя.

- **В Supabase:**
  - Вся информация о пользователях и их сессиях хранится в базе данных Supabase (PostgreSQL, схема `auth`).

## Итог

- Состояние аутентификации пользователя хранится в cookie браузера (`sb-...`).
- Сервер и клиент используют эту cookie для проверки, авторизован ли пользователь.
- Вся логика управления сессией реализована через Supabase SDK и его cookie-механику.
- Данные о пользователях хранятся в таблице `auth.users` в базе данных Supabase.

git config --global user.name "Dmitry Khutsishvili"
git config --global user.email "khutsishvili.gamedev@gmail.com"
dfdf

