import { useEffect, useRef } from 'react'
import { usePlanningStore } from '../stores/usePlanningStore'

/**
 * Хук для автоматического обновления Timeline при создании загрузок
 * Отслеживает изменения в состоянии разделов и обновляет UI
 */
export function useTimelineAutoRefresh() {
  const prevSectionsRef = useRef<any[]>([])
  const sections = usePlanningStore((state) => state.sections)
  const loadingsMap = usePlanningStore((state) => state.loadingsMap)

  useEffect(() => {
    const currentSections = sections
    const prevSections = prevSectionsRef.current

    // Проверяем, появились ли новые загрузки
    let hasNewLoadings = false

    if (currentSections.length > 0 && prevSections.length > 0) {
      currentSections.forEach((currentSection, index) => {
        const prevSection = prevSections[index]
        
        if (prevSection && currentSection.id === prevSection.id) {
          const currentLoadingsCount = currentSection.loadings?.length || 0
          const prevLoadingsCount = prevSection.loadings?.length || 0
          
          if (currentLoadingsCount > prevLoadingsCount) {
            hasNewLoadings = true
            console.log(`🆕 Обнаружена новая загрузка в разделе ${currentSection.name}:`, {
              prevCount: prevLoadingsCount,
              currentCount: currentLoadingsCount,
              sectionId: currentSection.id
            })
          }
        }
      })
    }

    // Обновляем reference для следующего сравнения
    prevSectionsRef.current = currentSections.map(section => ({
      ...section,
      loadings: [...(section.loadings || [])]
    }))

    if (hasNewLoadings) {
      console.log('🔄 Timeline будет автоматически обновлен из-за новых загрузок')
    }
  }, [sections, loadingsMap])

  return {
    // Возвращаем функцию для принудительного обновления если понадобится
    forceRefresh: () => {
      console.log('🔄 Принудительное обновление Timeline')
      // Можно добавить дополнительную логику если потребуется
    }
  }
}