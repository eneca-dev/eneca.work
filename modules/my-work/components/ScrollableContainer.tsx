"use client"

import React from 'react'

interface ScrollableContainerProps {
  children: React.ReactNode
  className?: string
  maxHeight?: string
  onScroll?: (e: React.UIEvent<HTMLDivElement>) => void
}

/**
 * Переиспользуемый контейнер со скрытым скроллбаром
 */
export const ScrollableContainer: React.FC<ScrollableContainerProps> = ({
  children,
  className = '',
  maxHeight = '32rem',
  onScroll
}) => {
  return (
    <>
      <style jsx>{`
        div::-webkit-scrollbar {
          display: none;
        }
      `}</style>
      <div 
        className={`overflow-y-auto overflow-x-hidden pr-2 ${className}`}
        style={{
          maxHeight,
          scrollbarWidth: 'none',
          msOverflowStyle: 'none'
        }}
        onScroll={onScroll}
      >
        {children}
      </div>
    </>
  )
}
