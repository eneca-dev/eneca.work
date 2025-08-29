"use client"

import React from 'react'
import { Search } from 'lucide-react'
import { FileTree } from './FileTree'
import { MarkdownViewer } from './MarkdownViewer'
import { useDocumentationFiles } from '../hooks/useDocumentationFiles'
import { Input } from '@/components/ui/input'

export function DocumentationLayout() {
  const {
    files,
    selectedFile,
    expandedFolders,
    toggleFolder,
    selectFile,
    getFileContent,
    searchQuery,
    setSearchQuery,
    searchResults,
    isIndexing
  } = useDocumentationFiles()

  return (
    <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] lg:grid-cols-[300px_1fr] h-full bg-background">
      {/* Sidebar с деревом файлов */}
      <div className="flex flex-col overflow-hidden bg-background dark:bg-[rgb(31,41,55)] border-r border-gray-200 dark:border-gray-700">
        <div className="px-4 py-3 border-b border-border bg-background dark:bg-[rgb(31,41,55)]">
          <h2 className="text-lg font-semibold text-foreground mb-3">Документация</h2>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder={isIndexing ? "Создание индекса..." : "Поиск по документации..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 py-2 text-sm"
              disabled={isIndexing}
            />
            {isIndexing && (
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
              </div>
            )}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-3 bg-background dark:bg-[rgb(31,41,55)]">
          <FileTree
            files={files}
            selectedFile={selectedFile}
            expandedFolders={expandedFolders}
            onFileSelect={selectFile}
            onFolderToggle={toggleFolder}
          />
        </div>
      </div>

      {/* Основная область просмотра */}
      <div className="flex flex-col h-full overflow-hidden bg-background dark:bg-[rgb(31,41,55)]">
        <MarkdownViewer
          filePath={selectedFile}
          getFileContent={getFileContent}
          searchQuery={searchQuery}
        />
      </div>
    </div>
  )
}
