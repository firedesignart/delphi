'use client'

import { FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile, toBlobURL } from '@ffmpeg/util'

let ffmpeg: FFmpeg | null = null
let loaded = false

export async function loadFFmpeg(): Promise<FFmpeg> {
  if (loaded && ffmpeg) return ffmpeg

  ffmpeg = new FFmpeg()

  const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd'
  await ffmpeg.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
  })

  loaded = true
  return ffmpeg
}

export async function cutVideoClip(
  videoFile: File,
  startTime: number,
  endTime: number,
  onProgress?: (p: number) => void,
  signal?: AbortSignal
): Promise<Blob> {
  const ff = await loadFFmpeg()

  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')

  const inputName = 'input.mp4'
  const outputName = 'output.mp4'

  onProgress?.(5)
  await ff.writeFile(inputName, await fetchFile(videoFile))
  onProgress?.(20)

  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')

  // -c copy = sem re-encoding, 10-20x mais rápido
  await ff.exec([
    '-ss', String(startTime),
    '-i', inputName,
    '-to', String(endTime - startTime),
    '-c', 'copy',
    '-avoid_negative_ts', 'make_zero',
    outputName,
  ])

  onProgress?.(85)

  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')

  const data = await ff.readFile(outputName)
  await ff.deleteFile(inputName)
  await ff.deleteFile(outputName)

  onProgress?.(100)

  const buffer = data instanceof Uint8Array ? data.buffer.slice(0) : data
  return new Blob([buffer as ArrayBuffer], { type: 'video/mp4' })
}
