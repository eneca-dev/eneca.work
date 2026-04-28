# DEPRECATED: расчётный бюджет через `decomposition_items.planned_hours`

**Депрекейт:** 2026-04-28
**Замена:** [docs/production/budgets-calc-from-loadings.md](../production/budgets-calc-from-loadings.md)
**Срок удаления:** ≈ 2026-06-15 (после 2 спринтов наблюдения за новой логикой)

---

## Что было

Расчётный бюджет в колонке «Расчётн.» на странице бюджетов считался формулой:

```
plannedHours      = Σ decomposition_items.planned_hours (ручной ввод в декомпозиции)
adjustedHours     = plannedHours × HOURS_ADJUSTMENT_FACTOR (1.2)
calcBudget        = adjustedHours × MOCK_HOURLY_RATE (15 BYN/ч, захардкожено)
```

**Источник данных:**
- `decomposition_items.decomposition_item_planned_hours` — ручной ввод пользователем при декомпозиции работ.
- `MOCK_HOURLY_RATE = 15` — глобальная константа в `modules/budgets-page/config/constants.ts`.
- `HOURS_ADJUSTMENT_FACTOR = 1.2` — коэффициент приведения «факт ≈ план × 1.2».

**Ключевые файлы:**
- `modules/budgets-page/components/BudgetRow.tsx` (строки ~144-156, ныне закомментированы)
- `modules/budgets-page/config/constants.ts` (`MOCK_HOURLY_RATE`, `HOURS_ADJUSTMENT_FACTOR` — `@deprecated`)
- `modules/budgets-page/types/index.ts` (`HierarchyNode.plannedHours` — `@deprecated`)
- `modules/budgets-page/hooks/use-budgets-hierarchy.ts` (агрегация `plannedHours` снизу вверх — оставлена)

---

## Почему заменили

1. **Захардкоженная ставка.** 15 BYN/ч — фиксированное значение в коде, не зависело от отдела/проекта. У реальных команд ставки 12-30+ BYN/ч.
2. **Ручной ввод часов почти не использовался.** На 2026-04-28 — только **502 раздела из 3945** имели заполненную декомпозицию. Часто символически (1-15 часов).
3. **Расхождение с реальностью.** Раздел мог иметь 30 назначенных загрузок (≈3000 человеко-часов в плане), но в декомпозиции стояло 0 — расчётный бюджет показывал 0 BYN.
4. **Нет обновления.** Декомпозицию никто не пересчитывал при изменении назначений. Загрузки же планируются и редактируются регулярно.

## Что заменило

Новая формула из `loadings`:

```
loading.money    = loading_rate × dept.work_hours_per_day × work_days × dept.hourly_rate
section.calc     = Σ loading.money по всем loadings раздела
object.calc      = Σ section.calc по children
project.calc     = Σ object.calc по children
```

**Источники:**
- `loadings` — назначения сотрудников на разделы (создаются/правятся в planning).
- `department_budget_settings` — ставка BYN/ч и часов/день, настраивается в админке отделов.
- `dim_work_calendar` — справочник рабочих дней с учётом праздников РБ и переносов.

Подробнее: [docs/production/budgets-calc-from-loadings.md](../production/budgets-calc-from-loadings.md).

---

## Что физически сохранено в коде

| Объект | Где | Статус |
|--------|-----|--------|
| `MOCK_HOURLY_RATE` константа | `modules/budgets-page/config/constants.ts` | `@deprecated`, используется только как fallback в `SectionRateEdit` для отображения |
| `HOURS_ADJUSTMENT_FACTOR` константа | `modules/budgets-page/config/constants.ts` | `@deprecated`, не используется в расчёте |
| `HierarchyNode.plannedHours` | `modules/budgets-page/types/index.ts` | `@deprecated`, заполняется и агрегируется как раньше — для отображения в колонке «План, ч» декомпозиции |
| `decomposition_items.planned_hours` | БД | Сохранена. Worksection-sync продолжает писать сюда. |
| `BudgetRowHours` компонент | `modules/budgets-page/components/BudgetRowHours.tsx` | Используется для inline-редактирования часов на уровне item декомпозиции |
| Закомментированный блок DEPRECATED в `BudgetRow.tsx` | строки 144-160 | Закомментирован, но переменные `plannedHours`/`adjustedHours`/`effectiveRate` оставлены — нужны для отображения «План, ч» и `SectionRateEdit` fallback |

**Что было физически удалено:** ничего. Только перестали использовать `plannedHours × фактор × ставка` для расчётного бюджета.

---

## Как откатить (если новая формула неприемлема)

1. В `modules/budgets-page/components/BudgetRow.tsx`:
   - Раскомментировать старый блок DEPRECATED (строки ~144-156).
   - Заменить присваивание `calcBudget = node.calcBudgetFromLoadings ?? null` на старое: `calcBudget = adjustedHours > 0 ? adjustedHours * effectiveRate : null`.
2. В `modules/budgets-page/hooks/use-budgets-hierarchy.ts` — убрать запрос `useSectionCalcBudgets` и подмешивание `loadingHours`/`calcBudgetFromLoadings`.
3. Снять `@deprecated` метки с констант и типов.
4. БД-объекты (`dim_work_calendar`, `department_budget_settings`, два view) можно не удалять — они независимы и дополнительные.

После отката `plannedHours × HOURS_ADJUSTMENT_FACTOR × MOCK_HOURLY_RATE` снова станет источником истины для колонки «Расчётный».

---

## Через 2 спринта (≈ 2026-06-15)

Если новая формула стабильна и принята — этот документ можно дополнить решением на удаление:

- [ ] Решение принято — оставить новый расчёт навсегда
- [ ] Удалить закомментированные блоки в `BudgetRow.tsx`
- [ ] Удалить `MOCK_HOURLY_RATE` и `HOURS_ADJUSTMENT_FACTOR` (если ничего не зависит)
- [ ] Удалить `HierarchyNode.plannedHours` если колонка «План, ч» тоже выводится из loadings
- [ ] Обсудить с продактом: убирать ли поле `decomposition_items.planned_hours` из БД (worksection-sync пишет туда — возможно потребуется миграция самой синхронизации)
