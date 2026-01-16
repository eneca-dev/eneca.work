import { createClient } from "@supabase/supabase-js"
import ExcelJS from "exceljs"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export const downloadXLSXTemplate = async () => {
  // Создаем новую книгу и лист
  const workbook = new ExcelJS.Workbook()
  const worksheet = workbook.addWorksheet("Шаблон декомпозиции")

  // Добавляем заголовки
  worksheet.columns = [
    { header: "Группа работ", key: "work_type", width: 30 },
    { header: "Наименование задачи", key: "work_content", width: 40 },
    { header: "Уровень сложности", key: "complexity_level", width: 20 },
    { header: "Часов", key: "labor_costs", width: 15 },
  ]

  // Стиль для заголовков
  worksheet.getRow(1).font = { bold: true }
  worksheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE0E0E0" },
  }

  // Создаем буфер
  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })

  const link = document.createElement("a")
  const url = URL.createObjectURL(blob)

  link.setAttribute("href", url)
  link.setAttribute("download", "decomposition_template.xlsx")
  link.style.visibility = "hidden"

  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

export interface DecompositionItem {
  work_type: string
  work_content: string
  labor_costs: number
  duration_days: number
  execution_period: number
  complexity_level?: string | number
}

export const parseXLSX = async (
  file: File,
  sheetName?: string,
): Promise<{ sheetNames: string[]; newItems: DecompositionItem[] }> => {
  // TODO: Добавить unit тесты для проверки fallback логики:
  // 1. Тест с файлом без заголовка "Часов" но с дополнительными столбцами в конце
  // 2. Тест с файлом где "Часов" находится не в последнем столбце
  // 3. Тест с файлом где есть пустые столбцы после "Часов"
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer)
        const workbook = new ExcelJS.Workbook()
        await workbook.xlsx.load(data.buffer)

        const sheetNames = workbook.worksheets.map((worksheet) => worksheet.name)

        // Берем указанный лист или первый, если не указан
        const worksheet = sheetName ? workbook.getWorksheet(sheetName) : workbook.getWorksheet(1)
        if (!worksheet) {
          reject(new Error(`Лист "${sheetName || 1}" не найден в файле`))
          return
        }

        console.log("Анализируем лист:", worksheet.name, "с", worksheet.columnCount, "столбцами")

        // Получаем заголовки и их индексы
        const headerMap = new Map<string, number>()
        const headerRow = worksheet.getRow(1)

        // Логируем все ячейки первой строки для отладки
        console.log("Все ячейки первой строки:")
        headerRow.eachCell((cell, colNumber) => {
          const value = cell.value?.toString().trim() || ""
          console.log(`Ячейка ${colNumber}: "${value}"`)

          // Нормализуем заголовок (убираем пробелы, приводим к нижнему регистру)
          const normalizedHeader = value.toLowerCase().trim()
          headerMap.set(normalizedHeader, colNumber - 1)
        })

        console.log("Карта заголовков:", Object.fromEntries(headerMap))

        // Ищем индексы нужных столбцов с учетом различных вариантов написания
        let workTypeIndex = -1
        let workContentIndex = -1
        let complexityLevelIndex = -1
        let laborCostsIndex = -1

        // Проверяем различные варианты написания заголовков
        for (const [header, index] of headerMap.entries()) {
          if (header.includes("групп") || header.includes("работ") || header === "work_type") {
            workTypeIndex = index
          }
          if (header.includes("наименование") || header.includes("задач") || header === "work_content") {
            workContentIndex = index
          }
          if (header.includes("сложност") || header.includes("уровень") || header === "complexity_level") {
            complexityLevelIndex = index
          }
          if (header.includes("час") || header === "labor_costs" || header === "трудозатрат") {
            laborCostsIndex = index
          }
        }

        console.log("Найденные индексы:", {
          workTypeIndex,
          workContentIndex,
          complexityLevelIndex,
          laborCostsIndex,
        })

        // Если не нашли индекс для "Часов", используем реальный последний столбец
        if (laborCostsIndex === -1) {
          // Получаем реальное количество столбцов в листе
          const realColumnCount = worksheet.columnCount
          if (realColumnCount > 0) {
            laborCostsIndex = realColumnCount - 1 // Индекс последнего столбца (0-based)
            console.log("Используем реальный последний столбец для часов:", laborCostsIndex, "из", realColumnCount, "столбцов")
          }
        }

        // Проверяем, что необходимые поля присутствуют
        const missingHeaders = []
        if (workTypeIndex === -1) missingHeaders.push("Группа работ")
        if (workContentIndex === -1) missingHeaders.push("Наименование задачи")

        // Не проверяем наличие "Часов", так как мы используем последний столбец, если он не найден

        if (missingHeaders.length > 0) {
          reject(new Error(`В файле отсутствуют необходимые заголовки: ${missingHeaders.join(", ")}`))
          return
        }

        const result: DecompositionItem[] = []

        // Начинаем со второй строки (после заголовков)
        let rowCount = 0
        worksheet.eachRow((row, rowNumber) => {
          if (rowNumber === 1) return // Пропускаем заголовки

          rowCount++
          const item: DecompositionItem = {
            work_type: "",
            work_content: "",
            labor_costs: 0,
            duration_days: 0,
            execution_period: 0,
            complexity_level: "",
          }

          // Получаем значения из ячеек
          if (workTypeIndex >= 0) {
            const cell = row.getCell(workTypeIndex + 1)
            item.work_type = cell.value?.toString() || ""
          }

          if (workContentIndex >= 0) {
            const cell = row.getCell(workContentIndex + 1)
            item.work_content = cell.value?.toString() || ""
          }

          if (complexityLevelIndex >= 0) {
            const cell = row.getCell(complexityLevelIndex + 1)
            item.complexity_level = cell.value?.toString() || ""
          }

          if (laborCostsIndex >= 0) {
            const cell = row.getCell(laborCostsIndex + 1)
            const value = cell.value

            // Пытаемся преобразовать значение в число
            if (typeof value === "number") {
              item.labor_costs = value
            } else if (typeof value === "string") {
              const parsed = Number.parseFloat(value)
              item.labor_costs = isNaN(parsed) ? 0 : parsed
            } else {
              item.labor_costs = 0
            }
          }

          // Добавляем элемент только если есть хотя бы группа работ или наименование задачи
          if (item.work_type || item.work_content) {
            result.push(item)
          }
        })


        resolve({ sheetNames, newItems: result })
      } catch (error) {
        console.error("Error parsing XLSX:", error)
        reject(error)
      }
    }

    reader.onerror = (error) => reject(error)
    reader.readAsArrayBuffer(file)
  })
}

// Функция для экспорта данных в XLSX
export const exportToXLSX = async (items: DecompositionItem[]): Promise<Blob> => {
  if (items.length === 0) {
    throw new Error("Нет данных для экспорта")
  }

  // Создаем новую книгу и лист
  const workbook = new ExcelJS.Workbook()
  const worksheet = workbook.addWorksheet("Декомпозиция")

  // Добавляем заголовки
  worksheet.columns = [
    { header: "Группа работ", key: "work_type", width: 30 },
    { header: "Наименование задачи", key: "work_content", width: 40 },
    { header: "Уровень сложности", key: "complexity_level", width: 20 },
    { header: "Часов", key: "labor_costs", width: 15 },
  ]

  // Стиль для заголовков
  worksheet.getRow(1).font = { bold: true }
  worksheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE0E0E0" },
  }

  // Добавляем данные
  items.forEach((item) => {
    worksheet.addRow({
      work_type: item.work_type || "",
      work_content: item.work_content || "",
      complexity_level: item.complexity_level || "",
      labor_costs: item.labor_costs || 0,
    })
  })

  // Создаем буфер
  const buffer = await workbook.xlsx.writeBuffer()
  return new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })
}
