"use client"

import React from 'react'

export interface DropdownItem {
  id: string
  label: string
  subtitle?: string
}

export interface PortalDropdownProps {
  position: { left: number; top: number; width: number; openUp: boolean }
  title: string
  items: DropdownItem[]
  onSelect: (id: string | null) => void
  onClose: () => void
}

export const PortalDropdown: React.FC<PortalDropdownProps> = ({
  position,
  title,
  items,
  onSelect,
  onClose,
}) => {
  return (
    <div
      style={{
        position: 'fixed',
        left: position.left,
        top: position.top,
        width: position.width,
        transform: position.openUp ? 'translateY(-8px) translateY(-100%)' : 'translateY(8px)',
      }}
      className="z-50"
      onMouseDown={(e) => e.preventDefault()}
    >
      <div className="bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-lg shadow-xl ring-1 ring-black/5 overflow-hidden">
        <div className="sticky top-0 bg-white/90 dark:bg-slate-700/90 backdrop-blur px-3 py-2 border-b border-gray-100 dark:border-slate-600 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
          {title}
        </div>
        <div className="max-h-64 overflow-y-auto overscroll-contain">
          <div
            onClick={() => { onSelect(null); onClose() }}
            className="px-3 py-2 hover:bg-gray-50 dark:hover:bg-slate-600/70 cursor-pointer border-b border-gray-100 dark:border-slate-600"
          >
            <div className="font-medium text-gray-500 dark:text-slate-400">Не назначен</div>
          </div>
          {items.map((item) => (
            <div
              key={item.id}
              onClick={() => { onSelect(item.id); onClose() }}
              className="px-3 py-2 hover:bg-gray-50 dark:hover:bg-slate-600/70 cursor-pointer"
            >
              <div className="font-medium dark:text-white">{item.label}</div>
              {item.subtitle && (
                <div className="text-sm text-gray-500 dark:text-slate-400">{item.subtitle}</div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}


