import { create } from 'zustand'
import { devtools } from 'zustand/middleware'

// Интерфейс для состояния UI - содержит все флаги и данные интерфейса
interface UiState {
  // Существующие поля для общего состояния приложения
  loading: boolean // Флаг загрузки для показа спиннеров
  notification: string | null // Текст уведомления или null если нет уведомления
  
  // Новые поля для управления видами календаря
  isPersonalView: boolean // Переключатель между личным и общим видом календаря
  showBirthdays: boolean // Показывать ли дни рождения в календаре
  showPersonalEvents: boolean // Показывать ли личные события
  showGlobalEvents: boolean // Показывать ли глобальные события
}

// Интерфейс для действий - содержит все методы для изменения состояния
interface UiActions {
  // Существующие методы для управления загрузкой и уведомлениями
  setLoading: (loading: boolean) => void
  setNotification: (notification: string | null) => void
  clearNotification: () => void
  
  // Новые методы для управления видами календаря
  setPersonalView: (value: boolean) => void // Установить тип вида календаря
  toggleBirthdays: () => void // Переключить показ дней рождения
  togglePersonalEvents: () => void // Переключить показ личных событий
  toggleGlobalEvents: () => void // Переключить показ глобальных событий
}

// Объединенный тип для всего стора
type UiStore = UiState & UiActions

export const useUiStore = create<UiStore>()(
  devtools(
    (set, get) => ({
      // Начальное состояние - существующие поля
      loading: false,
      notification: null,
      
      // Начальное состояние - новые поля для календаря
      isPersonalView: true, // По умолчанию показываем личный вид
      showBirthdays: true, // По умолчанию показываем дни рождения
      showPersonalEvents: true, // По умолчанию показываем личные события
      showGlobalEvents: true, // По умолчанию показываем глобальные события
      
      // Существующие методы для управления общим состоянием
      setLoading: (loading: boolean) => set({ loading }),
      setNotification: (notification: string | null) => {
        set({ notification })
        // Автоматически скрываем уведомление через 5 секунд
        if (notification) {
          setTimeout(() => {
            set({ notification: null })
          }, 5000)
        }
      },
      clearNotification: () => set({ notification: null }),
      
      // Новые методы для управления календарем
      setPersonalView: (value: boolean) => {
        set({ isPersonalView: value })
      },

      toggleBirthdays: () => {
        const state = get() // Получаем текущее состояние
        set({ showBirthdays: !state.showBirthdays }) // Инвертируем значение
      },

      togglePersonalEvents: () => {
        const state = get() // Получаем текущее состояние
        set({ showPersonalEvents: !state.showPersonalEvents }) // Инвертируем значение
      },

      toggleGlobalEvents: () => {
        const state = get() // Получаем текущее состояние
        set({ showGlobalEvents: !state.showGlobalEvents }) // Инвертируем значение
      },
    })
  )
) 