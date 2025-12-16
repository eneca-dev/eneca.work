# Улучшения дизайна модуля планирования (UI/UX)

## Цель

Улучшить визуальное отображение и удобство использования полосок загрузки в модуле планирования путем:
- Унификации высоты загрузок для консистентности интерфейса
- Улучшения информативности (показ проекта + объекта вместо этапа)
- Вынесения комментария в отдельную строку для лучшей читаемости
- Добавления индикатора ставки в виде чипа
- Улучшения видимости индикатора "сегодня" при наведении
- Улучшения контрастности тултипов в светлой теме

---

## Этапы реализации

### Этап 1: Фиксированная высота загрузки 56px

**Описание:**
Установить фиксированную высоту полоски загрузки в 56 пикселей, независимо от значения ставки. Это обеспечит визуальную консистентность и предсказуемость интерфейса.

**Затрагиваемые файлы:**
- `modules/planning/components/timeline/loading-bars-utils.ts:10` - константа `BASE_BAR_HEIGHT`
- `modules/planning/components/timeline/loading-bars-utils.ts:213` - функция `calculateBarTop()` (фикс наложения баров)
- `modules/planning/components/timeline/department-row.tsx:690-691` - расчет `actualRowHeight`
- `modules/planning/components/timeline/department-row.tsx:846` - рендер полоски
- `modules/planning/components/timeline/department-row.tsx:890-893` - логика `maxLines` (убрать зависимость от rate)
- `modules/planning/components/timeline/department-row.tsx:895-1120` - адаптивная логика отображения (упростить, убрать комментарии)
- `modules/planning/components/timeline/section-loading-bars.tsx:64` - рендер полоски в секции
- `modules/planning/components/timeline/section-loading-bars.tsx:231` - расчет высоты секции

**Текущая реализация:**
```typescript
export const BASE_BAR_HEIGHT = 140 // Базовая высота полоски для ставки 1.0
const barHeight = BASE_BAR_HEIGHT * (bar.period.rate || 1) // Высота зависит от ставки
```

**Детальные шаги реализации:**

#### Шаг 1.1: Изменить константу BASE_BAR_HEIGHT
**Файл:** `modules/planning/components/timeline/loading-bars-utils.ts:10`

**Было:**
```typescript
export const BASE_BAR_HEIGHT = 140 // Базовая высота полоски для ставки 1.0
```

**Станет:**
```typescript
export const BASE_BAR_HEIGHT = 56 // Фиксированная высота полоски загрузки
```

---

#### Шаг 1.2: Убрать умножение на rate в расчете actualRowHeight
**Файл:** `modules/planning/components/timeline/department-row.tsx:690-691`

**Было:**
```typescript
barRenders.forEach(bar => {
  const barHeight = BASE_BAR_HEIGHT * (bar.period.rate || 1)
  const top = calculateBarTop(bar, barRenders, BASE_BAR_HEIGHT, BAR_GAP, 8)
  maxBottom = Math.max(maxBottom, top + barHeight)
})
```

**Станет:**
```typescript
barRenders.forEach(bar => {
  const barHeight = BASE_BAR_HEIGHT // Фиксированная высота
  const top = calculateBarTop(bar, barRenders, BASE_BAR_HEIGHT, BAR_GAP, 8)
  maxBottom = Math.max(maxBottom, top + barHeight)
})
```

---

#### Шаг 1.3: Убрать умножение на rate в рендере полоски
**Файл:** `modules/planning/components/timeline/department-row.tsx:846`

**Было:**
```typescript
return barRenders.map((bar, idx) => {
  const barHeight = BASE_BAR_HEIGHT * (bar.period.rate || 1)
  // ...
})
```

**Станет:**
```typescript
return barRenders.map((bar, idx) => {
  const barHeight = BASE_BAR_HEIGHT // Фиксированная высота
  // ...
})
```

---

#### Шаг 1.4: Убрать умножение на rate в section-loading-bars (рендер)
**Файл:** `modules/planning/components/timeline/section-loading-bars.tsx:64`

**Было:**
```typescript
const barHeight = BASE_BAR_HEIGHT * (bar.period.rate || 1)
```

**Станет:**
```typescript
const barHeight = BASE_BAR_HEIGHT // Фиксированная высота
```

---

#### Шаг 1.5: Убрать умножение на rate в section-loading-bars (расчет высоты)
**Файл:** `modules/planning/components/timeline/section-loading-bars.tsx:231`

**Было:**
```typescript
barRenders.forEach(bar => {
  const barHeight = BASE_BAR_HEIGHT * (bar.period.rate || 1)
  const top = calculateBarTop(bar, barRenders, BASE_BAR_HEIGHT, BAR_GAP, 4)
  maxBottom = Math.max(maxBottom, top + barHeight)
})
```

**Станет:**
```typescript
barRenders.forEach(bar => {
  const barHeight = BASE_BAR_HEIGHT // Фиксированная высота
  const top = calculateBarTop(bar, barRenders, BASE_BAR_HEIGHT, BAR_GAP, 4)
  maxBottom = Math.max(maxBottom, top + barHeight)
})
```

---

#### Шаг 1.6: Убрать умножение на rate в функции calculateBarTop
**Файл:** `modules/planning/components/timeline/loading-bars-utils.ts:213`

**Проблема:** При стаке загрузок (когда они пересекаются по времени) бары накладываются друг на друга, потому что функция `calculateBarTop()` использует переменную высоту для расчёта позиции, а реальная высота баров уже фиксированная.

**Было:**
```typescript
overlappingBars.forEach(other => {
  const otherHeight = baseBarHeight * (other.period.rate || 1)
  layersMap.set(other.layer, Math.max(layersMap.get(other.layer) || 0, otherHeight))
})
```

**Станет:**
```typescript
overlappingBars.forEach(other => {
  const otherHeight = baseBarHeight // Фиксированная высота
  layersMap.set(other.layer, Math.max(layersMap.get(other.layer) || 0, otherHeight))
})
```

---

#### Шаг 1.7: Убрать зависимость maxLines от rate
**Файл:** `modules/planning/components/timeline/department-row.tsx:893-899`

**Проблема:** Логика `maxLines` всё ещё зависит от `rate` (ставки), но теперь высота фиксированная. Это приводит к тому, что на загрузках с маленькой ставкой (< 0.5) отображается только одна строка, хотя физически места больше.

**Было:**
```typescript
// Определяем максимальное количество строк в зависимости от rate (высоты)
let maxLines = 3
if (rate < 0.5) {
  maxLines = 1 // Очень низкие бары - только одна строка
} else if (rate < 1) {
  maxLines = 2 // Средние бары - максимум 2 строки
}
```

**Станет:**
```typescript
// При фиксированной высоте 42px помещается 2 строки текста
const maxLines = 2
```

**Обоснование:**
- Высота бара фиксированная (42px)
- Размер шрифта: 10px для основного текста, 9px для второстепенного
- LineHeight: 1.2-1.3
- Отступы: 4px сверху и снизу
- **Итого:** В 42px помещается 2 строки текста + комментарий

---

#### Шаг 1.8: Обновить адаптивную логику отображения
**Файл:** `modules/planning/components/timeline/department-row.tsx:919-1120`

**Проблема:** Блоки `if (maxLines === 1)` больше не нужны, так как `maxLines` всегда = 2.

**Изменения:**
1. Удалить все блоки `if (maxLines === 1)` из режимов 'minimal', 'compact', 'full'
2. Оставить только многострочную логику с `lineCount`
3. Упростить условия отображения

**Было (пример для 'minimal' mode):**
```typescript
if (labelParts.displayMode === 'minimal') {
  const displayText = labelParts.project || labelParts.stage

  if (maxLines === 1) {
    // Одна строка для маленьких баров
    return (...)
  }

  let lineCount = 0
  return (
    <div className="flex flex-col justify-center items-start overflow-hidden w-full h-full">
      {labelParts.project && lineCount < maxLines && ...}
      {labelParts.stage && lineCount < maxLines && ...}
    </div>
  )
}
```

**Станет:**
```typescript
if (labelParts.displayMode === 'minimal') {
  let lineCount = 0
  return (
    <div className="flex flex-col justify-center items-start overflow-hidden w-full h-full" style={{ gap: "2px" }}>
      {labelParts.project && lineCount < maxLines && (() => { lineCount++; return (
        <div className="flex items-center gap-1 w-full overflow-hidden">
          <FolderKanban size={9} className="text-white flex-shrink-0" />
          <span className="text-[10px] font-semibold text-white truncate">
            {labelParts.project}
          </span>
        </div>
      )})()}
      {labelParts.stage && lineCount < maxLines && (() => { lineCount++; return (
        <div className="flex items-center gap-1 w-full overflow-hidden">
          <Milestone size={8} className="text-white/90 flex-shrink-0" />
          <span className="text-[9px] font-medium text-white/90 truncate">
            {labelParts.stage}
          </span>
        </div>
      )})()}
    </div>
  )
}
```

Аналогично для режимов 'compact' и 'full'.

---

#### Шаг 1.9: Убрать комментарий из отображения на загрузке
**Файл:** `modules/planning/components/timeline/department-row.tsx:890-1120`

**Проблема:** Комментарии сейчас отображаются внутри полоски загрузки, занимая место для основной информации (проект, этап). Согласно Этапу 3, комментарий должен выводиться отдельной строкой **под** загрузкой.

**Изменения:**
1. Удалить переменную `const hasComment = !!bar.period.comment`
2. Удалить все блоки с `MessageSquare` иконкой и текстом комментария из всех режимов отображения ('icon-only', 'minimal', 'compact', 'full')
3. Удалить блок комментария (строки 1090-1117) из режима 'full'

**Было (примеры):**

**Icon-only mode:**
```typescript
{hasComment && (
  <MessageSquare
    className="w-3 h-3 text-white/70 flex-shrink-0"
    style={{ filter: "drop-shadow(0 1px 1px rgba(0,0,0,0.5))" }}
  />
)}
```

**Full mode:**
```typescript
{/* Блок комментария */}
{hasComment && (
  rate >= 0.5 ? (
    <div className="flex items-start gap-1 mt-0.5" title={bar.period.comment}>
      <MessageSquare className="w-3 h-3 flex-shrink-0 text-white/70" />
      <span className="text-[9px] font-medium text-white tracking-wide leading-tight">
        {bar.period.comment}
      </span>
    </div>
  ) : (
    <div title={bar.period.comment}>
      <MessageSquare className="w-3 h-3 text-white/70" />
    </div>
  )
)}
```

**Станет:**
- Все упоминания комментария удалены
- Комментарий будет реализован в Этапе 3 как отдельная строка под загрузкой

**Обоснование:**
- Освобождается место для основной информации (проект + объект/этап)
- Комментарий не теряется — будет отображаться под загрузкой в Этапе 3
- Упрощается логика рендеринга

---

**Зависимости:** Нет

---

### Этап 2: Название проекта + объект (вместо этапа)

**Описание:**
На загрузке отображать название проекта и название объекта вместо этапа декомпозиции. Это обеспечит более высокоуровневую информацию о загрузке.

**Затрагиваемые файлы:**
- `modules/planning/types.ts` - интерфейс `Loading` (проверить наличие полей `objectName`, `objectId`)
- `modules/planning/components/timeline/loading-bars-utils.ts:16-30` - интерфейс `BarPeriod`
- `modules/planning/components/timeline/loading-bars-utils.ts:273-291` - функция `loadingsToPeriods()`
- `modules/planning/components/timeline/loading-bars-utils.ts:469-504` - интерфейс `BarLabelParts` и функция `getBarLabelParts()`
- `modules/planning/components/timeline/department-row.tsx:1056-1119` - рендеринг текста в полоске

**Текущее отображение:**
```
Проект (FolderKanban icon)
Этап (Milestone icon)
```

**Планируемое отображение:**
```
Проект (FolderKanban icon)
Объект (Building2 icon или аналогичная)
```

**Планируемые изменения:**
1. Проверить наличие `objectName` в интерфейсе `Loading`
2. Добавить `objectName` и `objectId` в `BarPeriod` (если отсутствуют)
3. Обновить `loadingsToPeriods()` для передачи `objectName`
4. Изменить `BarLabelParts`:
   - Заменить `stage?: string` на `object?: string`
5. Обновить логику `getBarLabelParts()` для использования объекта вместо этапа
6. Обновить рендеринг в `department-row.tsx`:
   - Заменить `Milestone` icon на `Building2` (или другую подходящую иконку)
   - Изменить отображаемый текст с `labelParts.stage` на `labelParts.object`

**Зависимости:** Этап 1

---

### Этап 3: Комментарий отдельной строкой

**Описание:**
Комментарий выводить дополнительной строкой **под** загрузкой. Высота загрузки остается 56px, а комментарий рендерится ниже, увеличивая общую высоту строки.

**Затрагиваемые файлы:**
- `modules/planning/components/timeline/department-row.tsx:845-1172` - рендеринг полоски и комментария
- `modules/planning/components/timeline/department-row.tsx:683-701` - расчет `actualRowHeight`

**Текущая реализация:**
Комментарий отображается **внутри** полоски:
```tsx
{hasComment && (
  rate >= 0.5 ? (
    <div className="flex items-start gap-1 mt-0.5">
      <MessageSquare />
      <span>{bar.period.comment}</span>
    </div>
  ) : (
    <MessageSquare />
  )
)}
```

**Планируемая реализация:**
Комментарий как отдельный элемент **под** полоской:
```tsx
{/* Основная полоска - высота 56px */}
<div style={{ height: '56px' }}>
  {/* Контент полоски */}
</div>

{/* Комментарий под полоской */}
{hasComment && (
  <div style={{ height: 'auto', minHeight: '20px' }}>
    <MessageSquare />
    <span>{bar.period.comment}</span>
  </div>
)}
```

**Планируемые изменения:**
1. Вынести рендеринг комментария из блока контента полоски
2. Создать отдельный `div` для комментария, позиционированный под полоской
3. Обновить расчет `actualRowHeight`:
   - Добавить высоту комментария к высоте полоски
   - Пример: `barHeight (56px) + commentHeight (20px если есть комментарий)`
4. Стилизовать комментарий:
   - Иконка `MessageSquare` + текст
   - Фон может быть полупрозрачным
   - Выравнивание по левому краю полоски

**Зависимости:** Этап 1, Этап 2

---

### Этап 4: Ставка чипом в начале загрузки

**Описание:**
Вывести числовое значение ставки (например, "0.5", "1.0") в виде чипа в начало полоски загрузки.

**Затрагиваемые файлы:**
- `modules/planning/components/timeline/department-row.tsx:884-1131` - рендеринг контента полоски

**Планируемое отображение:**
```
[0.5] Проект • Объект
```

Чип со ставкой должен быть:
- В начале полоски (слева)
- Контрастного цвета (например, белый фон с темным текстом, или обратное для темной темы)
- Компактным (не занимать много места)
- С округлением (например, `rounded-md`)

**Планируемые изменения:**
1. Добавить рендеринг чипа ставки в начало контента полоски:
```tsx
<div className="flex items-center gap-1">
  {/* Чип ставки */}
  <span className="px-1.5 py-0.5 bg-white/90 text-slate-800 text-[10px] font-bold rounded">
    {bar.period.rate || 1}
  </span>

  {/* Остальной контент */}
  ...
</div>
```
2. Адаптировать стили чипа для темной/светлой темы
3. Учесть адаптивное отображение (для узких полосок чип может быть единственным элементом)

**Зависимости:** Этап 1, Этап 2, Этап 3

---

### Этап 5: Зеленая полоска "сегодня" не исчезает при hover

**Описание:**
При наведении на строку сотрудника зеленая полоска текущего дня должна оставаться видимой. Сейчас она перекрывается hover-эффектом.

**Затрагиваемые файлы:**
- `modules/planning/components/timeline/department-row.tsx:1176-1214` - ячейки таймлайна

**Текущая проблема:**
```tsx
className={cn(
  isToday ? "bg-teal-600/30" : "",
  "group-hover/employee:bg-slate-700/50", // ← Этот класс перекрывает bg-teal
)}
```

**Решения (выбрать одно):**

**Вариант 1: Условный hover (предпочтительный)**
```tsx
className={cn(
  isToday ? "bg-teal-600/30" : "",
  !isToday && "group-hover/employee:bg-slate-700/50", // Hover только для НЕ сегодняшних дней
)}
```

**Вариант 2: Более насыщенный цвет для "сегодня"**
```tsx
className={cn(
  isToday ? "bg-teal-500/60" : "", // Более яркий, чтобы пробивался через hover
  "group-hover/employee:bg-slate-700/30",
)}
```

**Вариант 3: Z-index подход**
Создать отдельный overlay для индикатора "сегодня" поверх ячеек с более высоким z-index.

**Планируемые изменения:**
1. Использовать **Вариант 1** (условный hover)
2. Проверить визуально в обеих темах (dark/light)
3. Убедиться, что индикатор "сегодня" четко виден при hover

**Зависимости:** Нет

---

### Этап 6: Светлый тултип в светлой теме

**Описание:**
Изменить цвет тултипа на светлый в светлой теме. Сейчас тултипы темные в обеих темах, что создает низкий контраст в светлой теме.

**Затрагиваемые файлы:**
- Нужно найти где определяется стиль атрибута `title` или компонент `Tooltip`
- Возможные файлы:
  - `components/ui/tooltip.tsx` (если есть кастомный компонент)
  - `app/globals.css` (глобальные стили для нативных тултипов)
  - Радикс UI Tooltip стили

**Текущее состояние:**
В коде используется атрибут `title` для тултипов:
```tsx
title={formatBarTooltip(bar.period)}
```

Нативные браузерные тултипы (`title`) не стилизуются через CSS. Нужно:

**Планируемые изменения:**

**Вариант 1: Использовать Radix Tooltip (предпочтительный)**
1. Заменить атрибут `title` на компонент `Tooltip` из Radix UI
2. Настроить стили тултипа в зависимости от темы:
```tsx
<Tooltip>
  <TooltipTrigger>{bar}</TooltipTrigger>
  <TooltipContent className={cn(
    theme === 'dark'
      ? 'bg-slate-800 text-white'
      : 'bg-white text-slate-800 border border-slate-200'
  )}>
    {formatBarTooltip(bar.period)}
  </TooltipContent>
</Tooltip>
```

**Вариант 2: CSS-based решение**
Создать кастомный тултип через CSS `::before`/`::after` (более сложно)

**Решение:** Использовать **Вариант 1** с Radix Tooltip

**Зависимости:** Нет

---

### Этап 7: Изменить отображение выходных на загрузке

**Описание:**
*Отложено на уточнение.*

Возможные варианты:
- Изменить стиль overlay (цвет, паттерн)
- Изменить тип границы (solid вместо dashed)
- Убрать overlay полностью
- Другое

**Затрагиваемые файлы:**
- `modules/planning/components/timeline/department-row.tsx:1134-1168` - overlay для нерабочих дней

**Зависимости:** TBD

---

## Критерии готовности

- [ ] Высота всех загрузок = 56px (независимо от ставки)
- [ ] На загрузке отображается: название проекта + название объекта (вместо этапа)
- [ ] Комментарий выводится отдельной строкой **под** загрузкой (высота загрузки 56px + высота комментария)
- [ ] Числовое значение ставки отображается чипом в начале загрузки
- [ ] Зеленая полоска "сегодня" не исчезает при наведении на строку
- [ ] Тултип в светлой теме имеет светлый фон
- [ ] ~~Выходные дни (отложено)~~
- [ ] Нет ошибок в консоли
- [ ] `npm run build` проходит успешно
- [ ] Ручное тестирование пройдено

---

## Технические детали

### Связанные файлы
- `modules/planning/components/timeline/department-row.tsx` - основной компонент отображения строки сотрудника
- `modules/planning/components/timeline/loading-bars-utils.ts` - утилиты для работы с полосками загрузки
- `modules/planning/types.ts` - типы модуля планирования

### Архитектурные решения
1. **Фиксированная высота:** упрощает расчеты позиционирования, улучшает визуальную консистентность
2. **Комментарий под полоской:** улучшает читаемость, не загромождает основную информацию
3. **Чип ставки:** быстрая визуальная идентификация загрузки сотрудника
4. **Условный hover:** сохраняет важную информацию о текущем дне

### Риски и edge-cases
- **Фиксированная высота:** при большом количестве пересекающихся загрузок строка может стать очень высокой
- **Комментарий под полоской:** длинные комментарии могут сильно увеличить высоту строки
- **Проект + объект:** убедиться, что данные всегда доступны в `Loading` объекте

---

## История изменений

### v1 (текущая версия)
- Создан план улучшений дизайна модуля планирования
- Определены 7 этапов реализации
- Зафиксированы критерии готовности
