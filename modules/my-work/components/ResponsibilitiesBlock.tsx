"use client"

import React from 'react'
import { useRouter } from 'next/navigation'
import { useProjectsStore } from '@/modules/projects/store'
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
  const router = useRouter()
  const { focusSection, focusProject } = useProjectsStore()
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

    // Дедупликация проектов по entity_id, если пользователь имеет несколько ролей (ПМ и ГИ)
    const dedupeById = (items: ResponsibilityInfo[]) => {
      const seen = new Set<string>()
      return items.filter(item => {
        if (seen.has(item.entity_id)) return false
        seen.add(item.entity_id)
        return true
      })
    }

    groups[0].items = dedupeById(groups[0].items)

    return groups.filter(group => group.items.length > 0)
  }

  if (responsibilities.length === 0) {
    return null
  }

  const groups = groupResponsibilities()

  return (
    <div>
      <div className={`flex items-center gap-2 ${isCompact ? 'mb-3' : 'mb-4'}`}>
        <User className="h-4 w-4 text-primary" />
        <h3 className="text-sm text-primary">Вы ответственны за</h3>
      </div>
      
      <div className="bg-muted rounded-lg p-4">
        <ScrollableContainer maxHeight={isCompact ? "6rem" : "10rem"}>
          <div className={`grid grid-cols-2 ${isCompact ? 'gap-2' : 'gap-3'}`}>
            {groups.map((group, groupIndex) => (
              <div 
                key={groupIndex} 
                className={`
                  border-l-gray-400
                  ${isCompact ? 'border-l pl-2 py-1.5' : 'border-l pl-3 py-2'}
                `}
              >
                <div className={`text-xs font-medium text-foreground ${isCompact ? 'mb-0.5' : 'mb-1'}`}>{group.title}</div>
                <div className={`flex flex-wrap ${isCompact ? 'gap-1' : 'gap-2'}`}>
                  {group.items.map((item, index) => (
                    (item.type === 'section_responsible' || item.type === 'project_manager' || item.type === 'lead_engineer') ? (
                      <a
                        key={index}
                        data-keep-notifications-open
                        href="/dashboard/projects"
                        onClick={(e) => {
                          e.preventDefault()
                          if (item.type === 'section_responsible') {
                            focusSection(item.entity_id)
                          } else {
                            focusProject(item.entity_id)
                          }
                          router.push('/dashboard/projects')
                        }}
                        className={`${isCompact ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs'} inline-flex items-center rounded-md border bg-accent/70 border-border text-primary hover:text-primary/80 hover:underline truncate max-w-full cursor-pointer`}
                        title={item.entity_name}
                      >
                        {item.entity_name}
                      </a>
                    ) : (
                      <div key={index} className={`${isCompact ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs'} inline-flex items-center rounded-md border bg-accent/70 border-border text-muted-foreground truncate max-w-full` } title={item.entity_name}>
                        {item.entity_name}
                      </div>
                    )
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
