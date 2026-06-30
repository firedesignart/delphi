'use client'

const HELPER_URL = 'http://127.0.0.1:7878'

export interface LocalFile {
  name: string
  size: number
  modified: number
}

export interface LocalVideoRef {
  source: 'local'
  filename: string
  size: number
}

export async function pingLocalHelper(): Promise<{ ok: boolean; ffmpeg: boolean } | null> {
  try {
    const res = await fetch(`${HELPER_URL}/health`, { signal: AbortSignal.timeout(1500) })
    if (!res.ok) return null
    const data = await res.json()
    return { ok: true, ffmpeg: data.ffmpeg }
  } catch {
    return null
  }
}

export async function listLocalFiles(): Promise<LocalFile[]> {
  const res = await fetch(`${HELPER_URL}/files`)
  if (!res.ok) throw new Error('Falha ao listar arquivos locais')
  const data = await res.json()
  return data.files
}

export function localStreamUrl(filename: string): string {
  return `${HELPER_URL}/stream/${encodeURIComponent(filename)}`
}

export async function extractAudioLocal(filename: string): Promise<Blob> {
  const res = await fetch(`${HELPER_URL}/extract-audio`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filename }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error ?? 'Falha ao extrair áudio no agente local')
  }
  return res.blob()
}

export async function cutClipLocal(params: {
  filename: string
  startTime: number
  endTime: number
  layout: 'fill' | 'letterbox'
  width: number
  height: number
  outputName: string
}): Promise<{ outputPath: string; outputDir: string }> {
  const res = await fetch(`${HELPER_URL}/cut-clip`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error ?? 'Falha ao cortar clip no agente local')
  }
  return res.json()
}
