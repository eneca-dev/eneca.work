# Этап 1: Непрерывное отображение загрузок через выходные

**Этот план перенесён в:** [docs/features/step1-planning-redesign.md](../../docs/features/step1-planning-redesign.md)

## Проблема

**Исходная задача:** Сделать непрерывные бары загрузки (без разрывов на выходных), но с визуальным различием для нерабочих дней (overlay + пунктир).

**Предыстория:** Коммиты 3af83b1 и d2018c3 (уже откачены) пытались это реализовать, но **сломали стек загрузок** — бары стали "раскиданными вкривь и вкось, друг на друга налазили".

### Анализ причин поломки в откаченных коммитах

**Текущее состояние кода (работает корректно):**
- Бары разбиваются на сегменты через `splitPeriodByWorkingDays()` (строка 375 в `loading-bars-utils.ts`)
- Для каждого сегмента создаётся отдельный `BarRender` (строки 378-398)
- На выходных/праздниках — разрывы между сегментами

**Что изменилось в коммите 3af83b1 (откачен):**
- Убрали цикл по сегментам → создаётся **один непрерывный бар** от `actualStartIdx` до `actualEndIdx`
- Вместо: `for (const segment of segments) { ... }`
- Стало: один `renders.push({ startIdx: actualStartIdx, endIdx: actualEndIdx, ... })`

**Почему сломалась система слоёв:**

1. **`calculateLayers()` работала корректно** — назначает слои на основе пересечений периодов по датам (сравнивает `period.startDate` и `period.endDate`)

2. **Но в `department-row.tsx` логика расчёта `top` дублирована вручную** (строки 702, 878) вместо использования `calculateBarTop()`

3. **Ключевая проблема:** После перехода на непрерывные бары:
   - `barRenders` содержат ДРУГИЕ данные: `startIdx/endIdx` теперь охватывают весь период включая выходные
   - Дублированная логика в `department-row.tsx` **проверяет пересечения через `startDate/endDate`** (строки 695-699, 871-875)
   - Но эта логика **НЕ УЧИТЫВАЛА**, что теперь один период может занимать БОЛЬШЕ индексов
   - Результат: алгоритм неправильно определял пересечения → назначал одинаковые слои разным барам → они налезали

4. **Дополнительная проблема:** В текущем коде УЖЕ есть техдолг — дублирование логики в трёх местах:
   - `actualRowHeight` (строки 685-723)
   - Рендер баров (строки 867-892)
   - `section-loading-bars.tsx` (строка 69) — ✅ единственное место, где используется `calculateBarTop()`

**Вывод:** Переход на непрерывные бары выявил скрытую проблему — дублированная логика не была протестирована на случай, когда `startIdx/endIdx` не совпадают с границами сегментов.

---

## Решение

**Стратегия в два этапа:**

1. **Сначала унифицировать логику** — убрать дублирование кода, использовать `calculateBarTop()` везде
2. **Затем перейти на непрерывные бары** — изменить `calculateBarRenders()` + добавить overlay для выходных

**Почему именно в таком порядке:**
- Унификация логики на текущем рабочем коде → легко протестировать
- Переход на непрерывные бары с уже унифицированной логикой → меньше риск сломать стек
- Каждый этап можно закоммитить отдельно → откат будет проще если что-то пойдёт не так

---

## Этапы реализации

### Этап 1: Унификация расчёта `top` (подготовка к непрерывным барам)

**Файл:** [modules/planning/components/timeline/department-row.tsx](modules/planning/components/timeline/department-row.tsx)

**Изменения (строки 867-892):**

**БЫЛО:**
```typescript
return barRenders.map((bar, idx) => {
  const barHeight = BASE_BAR_HEIGHT * (bar.period.rate || 1)

  // Находим все полосы, которые пересекаются с текущей по времени И имеют меньший layer
  const overlappingBars = barRenders.filter(other =>
    other.period.startDate <= bar.period.endDate &&
    other.period.endDate >= bar.period.startDate &&
    other.layer < bar.layer
  )

  // Рассчитываем top на основе ТОЛЬКО пересекающихся полос
  let top = 8 // Начальный отступ ← ПРОБЛЕМА: должно быть 4
  if (overlappingBars.length > 0) {
    const layersMap = new Map<number, number>()
    overlappingBars.forEach(other => {
      const otherHeight = BASE_BAR_HEIGHT * (other.period.rate || 1)
      layersMap.set(other.layer, Math.max(layersMap.get(other.layer) || 0, otherHeight))
    })

    // Суммируем высоты только тех слоёв, которые реально пересекаются
    for (let i = 0; i < bar.layer; i++) {
      if (layersMap.has(i)) {
        top += layersMap.get(i)! + BAR_GAP
      }
    }
  }

  // ... рендер
})
```

**СТАНЕТ:**
```typescript
return barRenders.map((bar, idx) => {
  const barHeight = BASE_BAR_HEIGHT * (bar.period.rate || 1)

  // Используем централизованную функцию для расчёта top
  const top = calculateBarTop(bar, barRenders, BASE_BAR_HEIGHT, BAR_GAP, 8)

  // ... рендер (без изменений)
})
```

**Важно:** Импортировать `calculateBarTop` из `loading-bars-utils.ts`:
```typescript
import { calculateBarTop } from "./loading-bars-utils"
```

**Аргументация использования `initialOffset = 8`:**
- В `actualRowHeight` используется `top = 8` (строка 702)
- Для согласованности с расчётом высоты строки нужно использовать тот же `initialOffset = 8`

---

### Этап 2: Унификация расчёта `top` в `actualRowHeight`

**Файл:** [modules/planning/components/timeline/department-row.tsx](modules/planning/components/timeline/department-row.tsx)

**Изменения (строки 685-723):**

**БЫЛО:**
```typescript
const actualRowHeight = useMemo(() => {
  if (barRenders.length === 0) return reducedRowHeight

  // Рассчитываем необходимую высоту для вертикального размещения всех полосок
  let maxBottom = 0

  barRenders.forEach(bar => {
    const barHeight = BASE_BAR_HEIGHT * (bar.period.rate || 1)

    // Находим все полосы, которые пересекаются с текущей по времени И имеют меньший layer
    const overlappingBars = barRenders.filter(other =>
      other.period.startDate <= bar.period.endDate &&
      other.period.endDate >= bar.period.startDate &&
      other.layer < bar.layer
    )

    // Рассчитываем top на основе ТОЛЬКО пересекающихся полос
    let top = 8 // начальный отступ
    if (overlappingBars.length > 0) {
      const layersMap = new Map<number, number>()
      overlappingBars.forEach(other => {
        const otherHeight = BASE_BAR_HEIGHT * (other.period.rate || 1)
        layersMap.set(other.layer, Math.max(layersMap.get(other.layer) || 0, otherHeight))
      })

      // Суммируем высоты только тех слоёв, которые реально пересекаются
      for (let i = 0; i < bar.layer; i++) {
        if (layersMap.has(i)) {
          top += layersMap.get(i)! + BAR_GAP
        }
      }
    }

    maxBottom = Math.max(maxBottom, top + barHeight)
  })

  // Возвращаем максимум из минимальной высоты и требуемой высоты + отступ снизу
  return Math.max(reducedRowHeight, maxBottom + 8)
}, [barRenders, reducedRowHeight])
```

**СТАНЕТ:**
```typescript
const actualRowHeight = useMemo(() => {
  if (barRenders.length === 0) return reducedRowHeight

  // Рассчитываем необходимую высоту для вертикального размещения всех полосок
  let maxBottom = 0

  barRenders.forEach(bar => {
    const barHeight = BASE_BAR_HEIGHT * (bar.period.rate || 1)

    // Используем централизованную функцию для расчёта top
    const top = calculateBarTop(bar, barRenders, BASE_BAR_HEIGHT, BAR_GAP, 8)

    maxBottom = Math.max(maxBottom, top + barHeight)
  })

  // Возвращаем максимум из минимальной высоты и требуемой высоты + отступ снизу
  return Math.max(reducedRowHeight, maxBottom + 8)
}, [barRenders, reducedRowHeight])
```

---

### Этап 3: Коммит унификации + тестирование

**Действие:**
- Запустить сборку: `npm run build`
- Проверить визуально: бары должны отображаться как раньше (с разрывами на выходных)
- Сделать коммит: `feat(planning): унификация логики расчёта позиций баров загрузки`

**Критерии успеха:**
- ✅ Сборка проходит
- ✅ Визуально ничего не изменилось
- ✅ Нет дублирования кода

---

### Этап 4: Переход на непрерывные бары

**Файл:** [modules/planning/components/timeline/loading-bars-utils.ts](modules/planning/components/timeline/loading-bars-utils.ts)

**Изменения в `calculateBarRenders()` (строки 374-398):**

**БЫЛО:**
```typescript
// Разбиваем на сегменты по рабочим дням
const segments = splitPeriodByWorkingDays(actualStartIdx, actualEndIdx, timeUnits)

// Создаем отдельный рендер для каждого сегмента
for (const segment of segments) {
  const left = (timeUnits[segment.startIdx]?.left ?? segment.startIdx * cellWidth) + HORIZONTAL_GAP / 2

  let width = 0
  for (let idx = segment.startIdx; idx <= segment.endIdx; idx++) {
    width += timeUnits[idx]?.width ?? cellWidth
  }
  width -= HORIZONTAL_GAP

  renders.push({
    period,
    startIdx: segment.startIdx,
    endIdx: segment.endIdx,
    left,
    width,
    layer,
    color,
  })
}
```

**СТАНЕТ:**
```typescript
// Создаем один непрерывный бар от начала до конца (включая нерабочие дни)
const left = (timeUnits[actualStartIdx]?.left ?? actualStartIdx * cellWidth) + HORIZONTAL_GAP / 2

// Вычисляем ширину всего периода суммированием ширин всех ячеек
let width = 0
for (let idx = actualStartIdx; idx <= actualEndIdx; idx++) {
  width += timeUnits[idx]?.width ?? cellWidth
}
width -= HORIZONTAL_GAP

renders.push({
  period,
  startIdx: actualStartIdx,
  endIdx: actualEndIdx,
  left,
  width,
  layer,
  color,
})
```

**Важно:** Функция `splitPeriodByWorkingDays()` (строки 289-321) пока **НЕ удаляется** — оставим её для потенциального отката.

---

### Этап 5: Добавление overlay для нерабочих дней

**Файл:** [modules/planning/components/timeline/department-row.tsx](modules/planning/components/timeline/department-row.tsx)

**Место: внутри рендера бара (после строки 893, перед закрывающим `</div>`)**

**Добавить код:**

```typescript
{/* Вычисляем позиции нерабочих дней внутри бара */}
{(() => {
  const HORIZONTAL_GAP = 6
  const nonWorkingDayRanges: Array<{ left: number; width: number }> = []
  let currentRangeStart: number | null = null
  let currentRangeWidth = 0

  for (let cellIdx = bar.startIdx; cellIdx <= bar.endIdx; cellIdx++) {
    const unit = timeUnits[cellIdx]
    const isNonWorking = unit?.isWorkingDay === false

    if (isNonWorking) {
      if (currentRangeStart === null) {
        // Начинаем новый диапазон нерабочих дней
        currentRangeStart = (unit.left ?? 0) - (timeUnits[bar.startIdx]?.left ?? 0) - HORIZONTAL_GAP / 2
      }
      currentRangeWidth += unit.width ?? 0
    } else {
      if (currentRangeStart !== null) {
        // Завершаем текущий диапазон
        nonWorkingDayRanges.push({
          left: currentRangeStart,
          width: currentRangeWidth - 2,
        })
        currentRangeStart = null
        currentRangeWidth = 0
      }
    }
  }

  // Завершаем последний диапазон если был
  if (currentRangeStart !== null) {
    nonWorkingDayRanges.push({
      left: currentRangeStart,
      width: currentRangeWidth - 4,
    })
  }

  // Рендерим overlay для каждого диапазона
  return nonWorkingDayRanges.map((range, rangeIdx) => (
    <div
      key={`non-working-${rangeIdx}`}
      className="absolute pointer-events-none"
      style={{
        left: `${range.left}px`,
        width: `${range.width}px`,
        top: '-1px',
        bottom: '-1px',
        backgroundColor: theme === 'dark' ? 'rgba(0, 0, 0, 0.2)' : 'rgba(255, 255, 255, 0.2)',
        borderTop: `3px dashed ${bar.color}`,
        borderBottom: `3px dashed ${bar.color}`,
      }}
    />
  ))
})()}
```

**Важно:** Добавить `position: relative` к контейнеру бара (строка ~897):

```typescript
className={cn(
  "absolute rounded transition-all duration-200 pointer-events-auto",
  "flex items-center",
  "relative", // ← Добавить для корректной работы overlay
  bar.period.type === "loading" && "cursor-pointer hover:brightness-110"
)}
```

---

### Этап 6: Проверка согласованности в `section-loading-bars.tsx`

**Файл:** [modules/planning/components/timeline/section-loading-bars.tsx](modules/planning/components/timeline/section-loading-bars.tsx)

**Действие:** ✅ Оставить без изменений — там уже используется `calculateBarTop()` и непрерывные бары (строка 769).

---

### Этап 7: Финальное тестирование

**Действие:**
- Запустить сборку: `npm run build`
- Проверить визуально на разных сценариях (см. секцию "Тестирование" ниже)
- Если всё ОК → коммит: `feat(planning): непрерывные бары загрузки с визуальным различием для выходных`

**Если что-то сломалось:**
- Откатить этап 4-5
- Вернуться к коду из этапа 3
- Проанализировать проблему

---

## Критерии готовности

**Этап 1-3 (Унификация):**
- [ ] Логика расчёта `top` унифицирована — используется только `calculateBarTop()`
- [ ] В `department-row.tsx` удалена дублированная логика расчёта `top` (два места: строки 703-714, 878-891)
- [ ] В `actualRowHeight` используется `calculateBarTop()` с `initialOffset = 8`
- [ ] В рендере баров используется `calculateBarTop()` с `initialOffset = 8`
- [ ] Импорт `calculateBarTop` добавлен в `department-row.tsx`
- [ ] Сборка проходит успешно (`npm run build`)
- [ ] Визуально ничего не изменилось (бары с разрывами на выходных)
- [ ] Коммит сделан

**Этап 4-7 (Непрерывные бары + overlay):**
- [ ] В `calculateBarRenders()` убран цикл по сегментам
- [ ] Создаётся один `BarRender` на период (непрерывный бар)
- [ ] В `department-row.tsx` добавлен расчёт `nonWorkingDayRanges`
- [ ] Добавлен рендер overlay с затемнением/высветлением + пунктиром
- [ ] К контейнеру бара добавлен `position: relative`
- [ ] Сборка проходит успешно (`npm run build`)
- [ ] Визуальная проверка: бары непрерывные, на выходных overlay, стек корректный
- [ ] Коммит сделан

---

## Тестирование

### Позитивные сценарии

- [ ] **Одна загрузка:** один бар отображается на правильной высоте (top = 8)
- [ ] **Две пересекающиеся загрузки:** два бара расположены один под другим, второй не налезает на первый
- [ ] **Три пересекающиеся загрузки с разными ставками:** бары корректно стакаются с учётом высоты (rate * BASE_BAR_HEIGHT)
- [ ] **Непересекающиеся загрузки:** бары находятся на одном уровне (layer = 0 для обоих)
- [ ] **Загрузка через выходные:** один непрерывный бар с overlay для нерабочих дней (белая полоса + пунктир)

### Негативные сценарии / Edge cases

- [ ] **Нет загрузок:** высота строки = `reducedRowHeight`, ошибок нет
- [ ] **Загрузка с rate = 0.25:** высота бара = 14px (56 * 0.25), текст читаемый
- [ ] **Загрузка с rate = 2:** высота бара = 112px, не вылезает за границы строки
- [ ] **Много пересекающихся загрузок (5+):** все умещаются в строку, высота строки динамически подстраивается

### Визуальная проверка

- [ ] **Тёмная тема:** overlay для выходных чёрный (rgba(0, 0, 0, 0.2))
- [ ] **Светлая тема:** overlay для выходных белый (rgba(255, 255, 255, 0.2))
- [ ] **Пунктирные границы:** толщина 3px, цвет соответствует цвету бара
- [ ] **Выравнивание:** overlay точно выровнен с вертикальной сеткой таймлайна

---

## Затрагиваемые файлы

**Этап 1-3 (Унификация):**
- **[modules/planning/components/timeline/department-row.tsx](modules/planning/components/timeline/department-row.tsx)** — импорт `calculateBarTop`, замена дублированной логики в двух местах

**Этап 4-7 (Непрерывные бары + overlay):**
- **[modules/planning/components/timeline/loading-bars-utils.ts](modules/planning/components/timeline/loading-bars-utils.ts)** — изменение `calculateBarRenders()` на непрерывные бары
- **[modules/planning/components/timeline/department-row.tsx](modules/planning/components/timeline/department-row.tsx)** — добавление overlay для нерабочих дней

**Не изменяется:**
- **[modules/planning/components/timeline/section-loading-bars.tsx](modules/planning/components/timeline/section-loading-bars.tsx)** — уже использует правильную логику

---

## Зависимости

Нет внешних зависимостей. Изменения касаются только модуля планирования.

---

## Потенциальные проблемы и решения

### 1. Изменение `initialOffset` с 8 на 4

**Риск:** Если изменить `initialOffset` на 4 для согласованности с `section-loading-bars.tsx`, бары в строках сотрудников могут прилипнуть к верхней границе строки.

**Решение:** Оставить `initialOffset = 8` в `department-row.tsx` — это корректное значение для строк сотрудников (больший отступ сверху).

### 2. Импорт `calculateBarTop`

**Риск:** Циклическая зависимость при импорте.

**Решение:** `calculateBarTop` уже экспортирована из `loading-bars-utils.ts` (строка 186). Импорт безопасен:
```typescript
import { calculateBarTop } from "./loading-bars-utils"
```

### 3. Производительность

**Риск:** Вызов `calculateBarTop()` в каждом рендере может быть медленнее чем инлайн расчёт.

**Решение:**
- `actualRowHeight` уже в `useMemo` — пересчёт только при изменении `barRenders`
- Рендер баров происходит в `.map()` — количество вызовов не увеличивается
- Производительность не пострадает

---

## Примечания

- **Поэтапный подход критичен** — сначала унификация на рабочем коде, потом непрерывные бары
- **Два коммита вместо одного** — это позволит легко откатиться если что-то пойдёт не так
- **Не трогать `section-loading-bars.tsx`** — там логика корректна
- **Не удалять `splitPeriodByWorkingDays()` сразу** — оставить для потенциального отката
- **Проверить z-index** — бары должны быть выше фоновых ячеек (текущее `zIndex: 4` корректно)

**Почему предыдущая попытка сломалась:**
- Изменили `calculateBarRenders()` без унификации логики в `department-row.tsx`
- Дублированная логика не учитывала новую структуру `barRenders`
- Результат: неправильный расчёт пересечений → одинаковые слои → налезание баров
