"use client"

import React from 'react'
import { User } from 'lucide-react'
import type { ResponsibilityInfo } from '../types'
import { ScrollableContainer } from './ScrollableContainer'

interface ResponsibilitiesBlockProps {
  responsibilities: ResponsibilityInfo[]
  isCompact?: boolean
}

// Простые группы без визуальных излишеств
type ResponsibilityGroup = {
  title: string
  items: ResponsibilityInfo[]
}

export const ResponsibilitiesBlock: React.FC<ResponsibilitiesBlockProps> = ({
  responsibilities,
  isCompact = false
}) => {
  // Группируем ответственности по типам
  const groupResponsibilities = (): ResponsibilityGroup[] => {
    const groups: ResponsibilityGroup[] = [
      {
        title: 'Проекты',
        items: []
      },
      {
        title: 'Разделы',
        items: []
      },
      {
        title: 'Объекты',
        items: []
      }
    ]

    responsibilities.forEach(responsibility => {
      switch (responsibility.type) {
        case 'project_manager':
        case 'lead_engineer':
          groups[0].items.push(responsibility)
          break
        case 'section_responsible':
          groups[1].items.push(responsibility)
          break
        case 'object_responsible':
          groups[2].items.push(responsibility)
          break
        // Остальные типы пока не обрабатываем
        default:
          break
      }
    })

    return groups.filter(group => group.items.length > 0)
  }

  if (responsibilities.length === 0) {
    return null
  }

  const groups = groupResponsibilities()

  return (
    <div>
      <div className={`flex items-center gap-2 ${isCompact ? 'mb-3' : 'mb-4'}`}>
        <User className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
        <h3 className="text-sm text-emerald-600 dark:text-emerald-400">Вы ответственны за</h3>
      </div>
      
      <div className="bg-gray-50 dark:bg-slate-600/20 rounded-lg border border-gray-100 dark:border-slate-500/20 p-4">
        <ScrollableContainer maxHeight="6rem">
          <div className={`grid grid-cols-2 ${isCompact ? 'gap-2' : 'gap-3'}`}>
            {groups.map((group, groupIndex) => (
              <div 
                key={groupIndex} 
                className={`
                  border-l-gray-400
                  ${isCompact ? 'border-l pl-2 py-1.5' : 'border-l pl-3 py-2'}
                `}
              >
                <div className={`text-xs font-medium text-gray-900 dark:text-white ${isCompact ? 'mb-0.5' : 'mb-1'}`}>{group.title}</div>
                <div className={`${isCompact ? 'space-y-0.5' : 'space-y-1'}`}>
                  {group.items.map((item, index) => (
                    <div key={index} className="text-xs text-gray-600 dark:text-gray-400 truncate max-w-full" title={item.entity_name}>
                      {item.entity_name}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </ScrollableContainer>
      </div>
    </div>
  )
}
