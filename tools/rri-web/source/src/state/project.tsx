// Project workspace: a directory handle to the RRI project folder plus
// read/write helpers used by every tool page.
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'

export interface ProjectApi {
  root: FileSystemDirectoryHandle | null
  rootName: string
  files: string[] // relative paths, '/' separated
  supported: boolean
  openProject: () => Promise<void>
  refresh: () => Promise<void>
  readText: (path: string) => Promise<string>
  readBinary: (path: string) => Promise<ArrayBuffer>
  writeText: (path: string, content: string) => Promise<void>
  writeBlob: (path: string, blob: Blob) => Promise<void>
  exists: (path: string) => boolean
}

const Ctx = createContext<ProjectApi | null>(null)

export function normalizePath(p: string): string {
  let s = p.replace(/\\/g, '/').trim()
  while (s.startsWith('./')) s = s.slice(2)
  while (s.startsWith('/')) s = s.slice(1)
  return s
}

async function listRecursive(dir: FileSystemDirectoryHandle, prefix: string, depth: number, out: string[]): Promise<void> {
  if (depth > 4 || out.length > 8000) return
  const entries: [string, FileSystemHandle][] = []
  // @ts-expect-error async iterator on directory handle
  for await (const [name, handle] of dir.entries()) entries.push([name, handle])
  entries.sort((a, b) => a[0].localeCompare(b[0]))
  for (const [name, handle] of entries) {
    if (name.startsWith('.')) continue
    if (handle.kind === 'file') out.push(prefix + name)
    else if (handle.kind === 'directory') {
      await listRecursive(handle as FileSystemDirectoryHandle, prefix + name + '/', depth + 1, out)
    }
  }
}

async function getDirHandle(root: FileSystemDirectoryHandle, dirPath: string, create: boolean): Promise<FileSystemDirectoryHandle> {
  let dir = root
  if (dirPath === '') return dir
  for (const part of dirPath.split('/')) {
    if (part === '') continue
    dir = await dir.getDirectoryHandle(part, { create })
  }
  return dir
}

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [root, setRoot] = useState<FileSystemDirectoryHandle | null>(null)
  const [files, setFiles] = useState<string[]>([])
  const supported = typeof window !== 'undefined' && 'showDirectoryPicker' in window

  const scan = useCallback(async (dir: FileSystemDirectoryHandle) => {
    const out: string[] = []
    await listRecursive(dir, '', 0, out)
    setFiles(out)
  }, [])

  const openProject = useCallback(async () => {
    // @ts-expect-error showDirectoryPicker not in TS lib yet
    const dir: FileSystemDirectoryHandle = await window.showDirectoryPicker({ mode: 'readwrite' })
    setRoot(dir)
    await scan(dir)
  }, [scan])

  const refresh = useCallback(async () => {
    if (root) await scan(root)
  }, [root, scan])

  const resolveFile = useCallback(async (path: string, create: boolean): Promise<FileSystemFileHandle> => {
    if (!root) throw new Error('No project folder open')
    const norm = normalizePath(path)
    const parts = norm.split('/')
    const fileName = parts.pop()!
    const dir = await getDirHandle(root, parts.join('/'), create)
    return dir.getFileHandle(fileName, { create })
  }, [root])

  const readText = useCallback(async (path: string) => {
    const fh = await resolveFile(path, false)
    const f = await fh.getFile()
    return f.text()
  }, [resolveFile])

  const readBinary = useCallback(async (path: string) => {
    const fh = await resolveFile(path, false)
    const f = await fh.getFile()
    return f.arrayBuffer()
  }, [resolveFile])

  const writeText = useCallback(async (path: string, content: string) => {
    const fh = await resolveFile(path, true)
    const w = await fh.createWritable()
    await w.write(content)
    await w.close()
  }, [resolveFile])

  const writeBlob = useCallback(async (path: string, blob: Blob) => {
    const fh = await resolveFile(path, true)
    const w = await fh.createWritable()
    await w.write(blob)
    await w.close()
  }, [resolveFile])

  const value = useMemo<ProjectApi>(() => ({
    root,
    rootName: root?.name ?? '',
    files,
    supported,
    openProject,
    refresh,
    readText,
    readBinary,
    writeText,
    writeBlob,
    exists: (path: string) => files.includes(normalizePath(path)),
  }), [root, files, supported, openProject, refresh, readText, readBinary, writeText, writeBlob])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useProject(): ProjectApi {
  const v = useContext(Ctx)
  if (!v) throw new Error('ProjectProvider missing')
  return v
}

/** trigger a browser download */
export function downloadBlob(name: string, blob: Blob): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}

export function downloadText(name: string, text: string): void {
  downloadBlob(name, new Blob([text], { type: 'text/plain' }))
}
