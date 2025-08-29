import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { join } from 'path'

export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  try {
    const resolvedParams = await params
    const filePath = resolvedParams.path.join('/')
    const fullPath = join(process.cwd(), 'user-docs', filePath)
    
    // Проверяем что файл имеет расширение .md для безопасности
    if (!filePath.endsWith('.md')) {
      return new NextResponse('Not Found', { status: 404 })
    }
    
    const content = await readFile(fullPath, 'utf-8')
    
    return new NextResponse(content, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'public, max-age=3600' // Кэшируем на час
      }
    })
  } catch (error) {
    console.error('Error loading documentation file:', error)
    return new NextResponse('Not Found', { status: 404 })
  }
}
