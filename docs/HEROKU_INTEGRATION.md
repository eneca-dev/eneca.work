# Интеграция с Heroku для WS-to-Work

## Обзор

Приложение интеграции ws-to-work успешно развернуто на Heroku и настроено для работы с основным приложением eneca.work.

## URLs

- **Heroku App**: https://ws-to-work-integration-eneca-7cab192e5438.herokuapp.com/
- **Веб-интерфейс**: https://ws-to-work-integration-eneca-7cab192e5438.herokuapp.com/
- **API Health**: https://ws-to-work-integration-eneca-7cab192e5438.herokuapp.com/api/health
- **Полная синхронизация**: https://ws-to-work-integration-eneca-7cab192e5438.herokuapp.com/api/sync/full

## Переменные окружения

### В основном приложении eneca.work

**Файл .env.local (для разработки):**
```env
NEXT_PUBLIC_WS_INTEGRATION_URL='http://localhost:3001'
```

**Файл .env.production (для продакшена):**
```env
NEXT_PUBLIC_WS_INTEGRATION_URL='https://ws-to-work-integration-eneca-7cab192e5438.herokuapp.com'
```

### На Heroku

Все необходимые переменные настроены:
- `WORKSECTION_DOMAIN`, `WORKSECTION_HASH`
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `ALLOWED_ORIGINS`, настройки rate limiting и timeouts

## Функциональность

### Веб-интерфейс на Heroku включает:
- 📊 Проверка статуса сервера
- 🏢 Синхронизация проектов
- 🎯 Синхронизация стадий
- 📦 Синхронизация объектов
- 📑 Синхронизация разделов
- 🚀 Полная синхронизация

### В основном приложении:
- Кнопка "Синхронизировать с Worksection" теперь обращается к Heroku
- Автоматическое переключение между локальной разработкой и продакшеном
- Обновленные сообщения об ошибках

## Мониторинг

```bash
# Статус приложения
heroku ps --app ws-to-work-integration-eneca

# Логи в реальном времени
heroku logs --tail --app ws-to-work-integration-eneca

# Проверка health endpoint
curl https://ws-to-work-integration-eneca-7cab192e5438.herokuapp.com/api/health
```

## Обновления

Для деплоя изменений:
```bash
cd ../ws-to-work-integration
git add .
git commit -m "Your commit message"
git push heroku main
```

## Переключение между локальной разработкой и продакшеном

- **Локальная разработка**: Используется `.env.local` с `localhost:3001`
- **Продакшен**: Используется `.env.production` с Heroku URL
- **Автоматическое переключение**: Next.js автоматически выбирает нужную переменную 