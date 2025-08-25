"use client"

import React from "react"
import clsx from "clsx"

interface FilterBarProps {
  title?: string
  children: React.ReactNode
  right?: React.ReactNode
  className?: string
  innerClassName?: string
  bottom?: React.ReactNode
  titleClassName?: string
}

export default function FilterBar({ title, children, right, className, innerClassName, bottom, titleClassName }: FilterBarProps) {
  return (
    <div className={clsx("sticky top-0 z-10 bg-white/90 dark:bg-slate-900/90 backdrop-blur border-b border-slate-200 dark:border-slate-700 px-3 md:px-6 min-h-[69px] flex flex-col justify-center", className)}>
      <div className={clsx("flex items-center justify-center gap-2 overflow-x-auto no-scrollbar", innerClassName)}>
        {title && (
          <h1 className={clsx("text-[13px] md:text-lg font-semibold whitespace-nowrap mr-1 md:mr-3", titleClassName)}>{title}</h1>
        )}
        <div className="flex items-center gap-1">
          {children}
        </div>
        {right}
      </div>
      {bottom && (
        <div className="pt-1 flex items-center justify-center">
          {bottom}
        </div>
      )}
    </div>
  )
}

