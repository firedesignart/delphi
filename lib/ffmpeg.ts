'use client'

import { FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile, toBlobURL } from '@ffmpeg/util'
import type { VideoLayout, Transition } from '@/components/layout-picker'

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

function buildVideoFilter(layout: VideoLayout, duration: number, transition: Transition): string {
  const fadeDur = 0.4
  let base = ''

  switch (layout) {
    case 'fill':
      base = 'crop=ih*9/16:ih,scale=1080:1920:flags=lanczos'
      break
    case 'letterbox':
      base = 'scale=1080:-2:flags=lanczos,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black'
      break
    case 'split':
      // handled separately via filter_complex
      return ''
  }

  if (transition === 'none') return base

  const fadeIn = `fade=t=in:st=0:d=${fadeDur}`
  const fadeOut = `fade=t=out:st=${Math.max(0, duration - fadeDur)}:d=${fadeDur}`
  return `${base},${fadeIn},${fadeOut}`
}

export async function cutVideoClip(
  videoFile: File,
  startTime: number,
  endTime: number,
  layout: VideoLayout = 'fill',
  transition: Transition = 'none',
  musicUrl?: string,
  onProgress?: (p: number) => void,
  signal?: AbortSignal
): Promise<Blob> {
  const ff = await loadFFmpeg()
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')

  const duration = endTime - startTime
  const inputName = 'input.mp4'
  const musicName = 'music.mp3'
  const outputName = 'output.mp4'
  const fadeDur = 0.4

  onProgress?.(5)
  await ff.writeFile(inputName, await fetchFile(videoFile))
  onProgress?.(15)

  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')

  // Optionally fetch music
  let hasMusicFile = false
  if (musicUrl) {
    try {
      const musicRes = await fetch(musicUrl)
      if (musicRes.ok) {
        const musicBlob = await musicRes.blob()
        await ff.writeFile(musicName, await fetchFile(musicBlob))
        hasMusicFile = true
      }
    } catch { /* skip music on error */ }
  }

  onProgress?.(25)

  ff.on('progress', ({ progress }) => {
    onProgress?.(25 + Math.round(progress * 70))
  })

  let args: string[]

  if (layout === 'split') {
    const topFilter = `[0:v]trim=start=${startTime}:end=${endTime},setpts=PTS-STARTPTS,crop=iw:iw*9/16,scale=1080:960:flags=lanczos`
    const botFilter = `[0:v]trim=start=${startTime}:end=${endTime},setpts=PTS-STARTPTS,crop=iw:iw*9/16,scale=1080:960:flags=lanczos`
    const fadeFilters = transition !== 'none'
      ? `,fade=t=in:st=0:d=${fadeDur},fade=t=out:st=${Math.max(0, duration - fadeDur)}:d=${fadeDur}`
      : ''

    let filterComplex = `${topFilter}${fadeFilters}[top];${botFilter}${fadeFilters}[bot];[top][bot]vstack,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black[vout]`

    if (hasMusicFile) {
      args = [
        '-i', inputName, '-i', musicName,
        '-filter_complex', filterComplex,
        '-map', '[vout]',
        '-filter_complex', `[0:a]atrim=start=${startTime}:end=${endTime},asetpts=PTS-STARTPTS[oa];[1:a]aloop=loop=-1:size=44100[ml];[oa][ml]amix=inputs=2:weights=1 0.15[aout]`,
        '-map', '[aout]',
        '-c:v', 'libx264', '-preset', 'fast', '-crf', '20',
        '-c:a', 'aac', '-b:a', '128k',
        '-t', String(duration),
        '-movflags', '+faststart', outputName,
      ]
    } else {
      args = [
        '-i', inputName,
        '-filter_complex', filterComplex,
        '-map', '[vout]',
        '-ss', String(startTime), '-t', String(duration),
        '-map', '0:a',
        '-c:v', 'libx264', '-preset', 'fast', '-crf', '20',
        '-c:a', 'aac', '-b:a', '128k',
        '-movflags', '+faststart', outputName,
      ]
    }
  } else {
    const vf = buildVideoFilter(layout, duration, transition)
    const needsEncode = layout === 'fill' || transition !== 'none' || hasMusicFile

    if (hasMusicFile) {
      args = [
        '-ss', String(startTime), '-t', String(duration), '-i', inputName,
        '-i', musicName,
        '-filter_complex',
        `[0:v]${vf}[vout];[0:a][1:a]amix=inputs=2:weights=1 0.15[aout]`,
        '-map', '[vout]', '-map', '[aout]',
        '-c:v', 'libx264', '-preset', 'fast', '-crf', '20',
        '-c:a', 'aac', '-b:a', '128k',
        '-movflags', '+faststart', outputName,
      ]
    } else if (needsEncode) {
      args = [
        '-ss', String(startTime), '-t', String(duration), '-i', inputName,
        '-vf', vf,
        '-c:v', 'libx264', '-preset', 'fast', '-crf', '20',
        '-c:a', 'aac', '-b:a', '128k',
        '-movflags', '+faststart', outputName,
      ]
    } else {
      // fast copy (letterbox, no transition, no music)
      args = [
        '-ss', String(startTime), '-t', String(duration), '-i', inputName,
        '-c', 'copy', '-movflags', '+faststart', outputName,
      ]
    }
  }

  await ff.exec(args)
  onProgress?.(95)

  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')

  const data = await ff.readFile(outputName)
  await ff.deleteFile(inputName)
  if (hasMusicFile) await ff.deleteFile(musicName)
  await ff.deleteFile(outputName)
  onProgress?.(100)

  const buffer = data instanceof Uint8Array ? data.buffer.slice(0) : data
  return new Blob([buffer as ArrayBuffer], { type: 'video/mp4' })
}
