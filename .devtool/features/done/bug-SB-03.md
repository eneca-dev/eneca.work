---
id: "bug-SB-03"
status: "done"
priority: "medium"
assignee: "Саша Бирило"
epic: "bug"
dueDate: null
created: "2026-06-18T12:00:00.000Z"
modified: "2026-08-18T11:27:15.973Z"
completedAt: "2026-08-18T11:27:15.973Z"
labels: ["v1.5.0"]
order: "a148"
---
# bug-SB-03 Бюджеты: скоуп `getBudgets` (\~35k→5k) + ленивые бюджеты этапов/задач + realtime-свежесть

> Продолжение `bug-SB-01`. Та задача убрала тяжёлую `v_resource_graph` (лёгкая `v_budget_hierarchy` + ленивая структура). Здесь — добиваем оставшийся ограничитель и закрываем дыру в realtime.

## Проблема

После SB-01 главным ограничителем старта стал `getBudgets`:

- грузил **ВСЕ \~35 285 бюджетов** (8 страниц по 5000, \~2-3с), хотя на старте видны только Проект→Объект→Раздел (\~5 069 бюджетов);
- \~30k бюджетов этапов/задач ехали зря — они нужны только при раскрытии раздела.

И всплыла **дыра в realtime** (появилась в SB-01): дерево Бюджетов переехало на ключи `budgets.hierarchy` / `budgets.sectionItems`, но realtime-конфиг их не инвалидировал. Следствие: «Расчётный» (зависит от loadings/ставок) и структура **не обновлялись вживую** — только по перезагрузке. Правка самого бюджета обновлялась (`budgets.all`), а изменения загрузок/ставок/структуры — нет.

## Решение / Что сделано

**7a — скоуп + ленивые бюджеты:**

- `getBudgets`: добавлен фильтр `entity_types?: BudgetEntityType[]` (`.in('entity_type', …)`) — аддитивно, старый одиночный `entity_type` не тронут. Прочие потребители не задеты.
- `useBudgetsHierarchy`: на старте `useBudgets({ …, entity_types: ['project','object','section'] })` → \~5k вместо 35k.
- `getSectionBudgetItems`: теперь отдаёт этапы/задачи **вместе с их бюджетами** (lean `v_budgets_for_page` по `entity_id` раздела) — одним лёгким запросом при раскрытии.
- `SectionLazyChildren`: строит узлы из lazy-бюджетов (`toBudgetInfo`), а не из общего `budgetsMap`.
- Удалён React-контекст `BudgetsDataProvider`/`budgetsMap` — больше не нужен (упрощены `useBudgetsHierarchy` и `BudgetsViewInternal`).

**Правка этапа/задачи (выделенный):** бюджеты этапов/задач живут в `budgets.sectionItems` (вне `budgets.lists`, который патчит optimistic-мутация), поэтому обновляются через **realtime-подписку** на `budgets` — после правки значение \~300мс показывает старое, затем подтягивается (лёгкое мерцание). Мгновенный optimistic для этих уровней **сознательно НЕ делали**: он требовал правки общей фабрики мутаций (`createCacheMutation`), что сочли неоправданным ради бюджетов. project/object/section остаются мгновенными (они в `budgets.lists`).

**Realtime-свежесть дерева Бюджетов** (`modules/cache/realtime/config.ts`): добавлены `budgets.hierarchy` / `budgets.sectionItems` в подписки:

ИзменениеДобавлен ключ`loadings`, `department_budget_settingsbudgets.hierarchy` (Расчётный)`projects`, `objects`, `sectionsbudgets.hierarchy` (структура)`decomposition_stagesbudgets.hierarchy` + `budgets.sectionItemsdecomposition_itemsbudgets.sectionItems`

**Фикс ключа кэша:** в `queryKeys.budgets.list` добавлены `entityTypes` + `projectIds` (раньше `project_ids` не входил в ключ → латентная коллизия scoped/полного запроса).

## Результат

- Старт Бюджетов: **\~3-4с → \~1-1.5с** (ожидаемо; на старте 2 страницы вместо 8).
- Правка project/object/section — мгновенно (optimistic); этап/задача — через realtime (\~300мс, лёгкое мерцание).
- Расчётный/структура обновляются вживую при изменении загрузок/ставок/декомпозиции.

## Затронутые файлы

- `modules/budgets/types.ts` (`entity_types`), `modules/budgets/actions/budget-actions.ts` (фильтр + убраны шумные `console.error`).
- `modules/budgets/hooks/index.ts` (ключ list: entityTypes/projectIds).
- `modules/cache/keys/query-keys.ts` (ключ list: entityTypes/projectIds).
- `modules/cache/realtime/config.ts` (свежесть дерева).
- `modules/budgets-page/hooks/use-budgets-hierarchy.ts` (scope, убран budgetsMap).
- `modules/budgets-page/actions/budget-hierarchy.ts` (`getSectionBudgetItems` отдаёт бюджеты).
- `modules/budgets-page/components/BudgetRow.tsx` (SectionLazyChildren из lazy), `BudgetsViewInternal.tsx` (убран провайдер).
- Осиротел: `modules/budgets-page/context/budgets-data-context.tsx` — **удалить**.

## На что смотреть ревьюеру

1. **Числа совпадают** до/после на всех уровнях — особенно «Распределено» **свёрнутых** разделов (берётся из `v_budget_hierarchy.section_distributed`, не из детей).
   - **Раздел БЕЗ этапов** (`section_has_stages=false`): «Распределено» = собственный «Выделенный» раздела (лист), а не 0 — выровнено под старый код (`use-budgets-hierarchy.ts`: `distributedBudget = section_has_stages ? section_distributed : undefined`). Иначе у безэтапных разделов было бы «—».
2. **Realtime:** на вкладке Бюджеты изменить загрузку в разделе → «Расчётный» обновляется без перезагрузки.
3. **Правка этапа/задачи** → значение обновляется через realtime (на \~300мс может мелькнуть старое — это **ожидаемо**: optimistic для этих уровней сознательно не делали, общую фабрику мутаций не трогали).
4. `getBudgets` с `entity_types` — отдельный кэш-ключ от полного (не коллизирует).
5. Удалить осиротевший `budgets-data-context.tsx`.