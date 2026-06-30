'use client'

import { FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile, toBlobURL } from '@ffmpeg/util'
import type { VideoLayout } from '@/components/layout-picker'

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

function buildFilterChain(layout: VideoLayout): string[] {
  switch (layout) {
    case 'fill':
      // Crop to 9:16, fill entire frame
      return ['-vf', 'crop=ih*9/16:ih,scale=1080:1920:flags=lanczos']

    case 'letterbox':
      // Keep 16:9, add black bars top/bottom
      return ['-vf', 'scale=1080:-2:flags=lanczos,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black']

    case 'split':
      // Top: crop center, Bottom: crop center slightly offset — stacked
      return [
        '-filter_complex',
        '[0:v]crop=ih*16/9:ih,scale=1080:608:flags=lanczos[top];' +
        '[0:v]crop=ih*16/9:ih,scale=1080:608:flags=lanczos[bot];' +
        '[top][bot]vstack,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black[out]',
        '-map', '[out]',
      ]

    default:
      return ['-vf', 'crop=ih*9/16:ih,scale=1080:1920:flags=lanczos']
  }
}

export async function cutVideoClip(
  videoFile: File,
  startTime: number,
  endTime: number,
  layout: VideoLayout = 'fill',
  onProgress?: (p: number) => void,
  signal?: AbortSignal
): Promise<Blob> {
  const ff = await loadFFmpeg()
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')

  const inputName = 'input.mp4'
  const outputName = 'output.mp4'

  onProgress?.(5)
  await ff.writeFile(inputName, await fetchFile(videoFile))
  onProgress?.(15)

  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')

  const filterArgs = buildFilterChain(layout)
  const needsReencode = layout !== 'letterbox' // fill and split need re-encode for filters

  const args = [
    '-ss', String(startTime),
    '-i', inputName,
    '-to', String(endTime - startTime),
    ...(needsReencode
      ? [...filterArgs, '-c:v', 'libx264', '-preset', 'fast', '-crf', '20', '-c:a', 'aac', '-b:a', '128k']
      : ['-c', 'copy']
    ),
    '-movflags', '+faststart',
    outputName,
  ]

  ff.on('progress', ({ progress }) => {
    onProgress?.(15 + Math.round(progress * 80))
  })

  await ff.exec(args)
  onProgress?.(95)

  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')

  const data = await ff.readFile(outputName)
  await ff.deleteFile(inputName)
  await ff.deleteFile(outputName)
  onProgress?.(100)

  const buffer = data instanceof Uint8Array ? data.buffer.slice(0) : data
  return new Blob([buffer as ArrayBuffer], { type: 'video/mp4' })
}
