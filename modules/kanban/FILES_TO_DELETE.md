# Файлы для удаления после миграции на централизованные модалки

Эти файлы больше не используются, так как были заменены на централизованные модалки из `modules/modals`:

1. `c:\eneca.work\modules\kanban\components\AddReportModal.tsx`
   - Заменён на `WorkLogCreateModal` из `@/modules/modals`

2. `c:\eneca.work\modules\kanban\components\StageDetailModal.tsx`
   - Заменён на `StageModal` из `@/modules/modals`

## Команда для удаления:

```bash
rm modules/kanban/components/AddReportModal.tsx
rm modules/kanban/components/StageDetailModal.tsx
```
