'use client'

import { FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile, toBlobURL } from '@ffmpeg/util'

let ffmpeg: FFmpeg | null = null
let loaded = false

export async function loadFFmpeg(onProgress?: (p: number) => void): Promise<FFmpeg> {
  if (loaded && ffmpeg) return ffmpeg

  ffmpeg = new FFmpeg()

  if (onProgress) {
    ffmpeg.on('progress', ({ progress }) => onProgress(Math.round(progress * 100)))
  }

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
  onProgress?: (p: number) => void
): Promise<Blob> {
  const ff = await loadFFmpeg(onProgress)

  const inputName = 'input.mp4'
  const outputName = 'output.mp4'

  await ff.writeFile(inputName, await fetchFile(videoFile))

  await ff.exec([
    '-i', inputName,
    '-ss', String(startTime),
    '-to', String(endTime),
    '-c:v', 'libx264',
    '-c:a', 'aac',
    '-preset', 'fast',
    '-crf', '23',
    '-vf', 'scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2',
    '-movflags', '+faststart',
    outputName,
  ])

  const data = await ff.readFile(outputName)
  await ff.deleteFile(inputName)
  await ff.deleteFile(outputName)

  const buffer = data instanceof Uint8Array ? data.buffer.slice(0) : data
  return new Blob([buffer as ArrayBuffer], { type: 'video/mp4' })
}

export async function extractThumbnail(
  videoFile: File,
  timeSeconds: number
): Promise<string> {
  const ff = await loadFFmpeg()

  const inputName = 'input.mp4'
  const thumbName = 'thumb.jpg'

  await ff.writeFile(inputName, await fetchFile(videoFile))

  await ff.exec([
    '-i', inputName,
    '-ss', String(timeSeconds),
    '-vframes', '1',
    '-vf', 'scale=540:960:force_original_aspect_ratio=decrease,pad=540:960:(ow-iw)/2:(oh-ih)/2',
    '-q:v', '2',
    thumbName,
  ])

  const data = await ff.readFile(thumbName)
  await ff.deleteFile(inputName)
  await ff.deleteFile(thumbName)

  const buffer = data instanceof Uint8Array ? data.buffer.slice(0) : data
  const blob = new Blob([buffer as ArrayBuffer], { type: 'image/jpeg' })
  return URL.createObjectURL(blob)
}
