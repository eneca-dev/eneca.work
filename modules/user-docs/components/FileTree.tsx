"use client"

import React from 'react'
import { ChevronRight, ChevronDown, FileText, Folder, FolderOpen } from 'lucide-react'
import { cn } from '@/lib/utils'
import { DocumentationFile } from '../types'

interface FileTreeProps {
  files: DocumentationFile[]
  selectedFile: string | null
  expandedFolders: Set<string>
  onFileSelect: (path: string) => void
  onFolderToggle: (path: string) => void
  level?: number
}

export function FileTree({
  files,
  selectedFile,
  expandedFolders,
  onFileSelect,
  onFolderToggle,
  level = 0
}: FileTreeProps) {
  return (
    <div className="space-y-1">
      {files.map((file) => (
        <div key={file.path}>
          {file.type === 'folder' ? (
            <div>
              <button
                onClick={() => onFolderToggle(file.path)}
                className={cn(
                  "flex items-center w-full text-left px-2 py-1.5 text-sm rounded-md transition-colors",
                  "hover:bg-accent hover:text-accent-foreground",
                  "focus:bg-accent focus:text-accent-foreground focus:outline-none"
                )}
                style={{ paddingLeft: `${level * 12 + 8}px` }}
              >
                {expandedFolders.has(file.path) ? (
                  <>
                    <ChevronDown className="h-4 w-4 mr-1 text-muted-foreground" />
                    <FolderOpen className="h-4 w-4 mr-2 text-blue-500" />
                  </>
                ) : (
                  <>
                    <ChevronRight className="h-4 w-4 mr-1 text-muted-foreground" />
                    <Folder className="h-4 w-4 mr-2 text-blue-500" />
                  </>
                )}
                <span className="font-medium">{file.name}</span>
              </button>
              
              {expandedFolders.has(file.path) && file.children && (
                <FileTree
                  files={file.children}
                  selectedFile={selectedFile}
                  expandedFolders={expandedFolders}
                  onFileSelect={onFileSelect}
                  onFolderToggle={onFolderToggle}
                  level={level + 1}
                />
              )}
            </div>
          ) : (
            <button
              onClick={() => onFileSelect(file.path)}
              className={cn(
                "flex items-center w-full text-left px-2 py-1.5 text-sm rounded-md transition-colors",
                "hover:bg-accent hover:text-accent-foreground",
                "focus:bg-accent focus:text-accent-foreground focus:outline-none",
                selectedFile === file.path && "bg-accent text-accent-foreground"
              )}
              style={{ paddingLeft: `${level * 12 + 8}px` }}
            >
              <FileText className="h-4 w-4 mr-3 text-gray-500 dark:text-gray-400" />
              <span>{file.name}</span>
            </button>
          )}
        </div>
      ))}
    </div>
  )
}
