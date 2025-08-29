export interface DocumentationFile {
  name: string
  path: string
  type: 'file' | 'folder'
  children?: DocumentationFile[]
  content?: string
}

export interface DocumentationState {
  selectedFile: string | null
  expandedFolders: Set<string>
}
