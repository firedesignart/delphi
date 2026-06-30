'use client'

import { FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile, toBlobURL } from '@ffmpeg/util'
import type { VideoLayout, Transition } from '@/components/layout-picker'

let ffmpeg: FFmpeg | null = null
let loaded = false
let fontLoaded = false

const FONT_URL = 'https://cdn.jsdelivr.net/gh/google/fonts@main/apache/roboto/Roboto%5Bwdth%2Cwght%5D.ttf'
const FALLBACK_FONT_URL = 'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/inter/Inter%5Bopsz%2Cwght%5D.ttf'

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

/**
 * Extrai apenas o áudio do vídeo, comprimido e mono.
 * Necessário porque a Vercel limita o corpo de requisições de API routes a ~4.5MB —
 * enviar o vídeo inteiro para /api/analyze falha silenciosamente para arquivos grandes.
 * Áudio mono em baixa taxa de bits reduz drasticamente o tamanho mantendo qualidade
 * suficiente para transcrição.
 */
export async function extractAudio(
  videoFile: File,
  onProgress?: (p: number) => void
): Promise<Blob> {
  const ff = await loadFFmpeg()
  const inputName = 'extract_input.mp4'
  const outputName = 'extract_output.mp3'

  onProgress?.(5)
  await ff.writeFile(inputName, await fetchFile(videoFile))
  onProgress?.(15)

  ff.on('progress', ({ progress }) => onProgress?.(15 + Math.round(progress * 75)))

  await ff.exec([
    '-i', inputName,
    '-vn',
    '-ac', '1',
    '-ar', '16000',
    '-b:a', '64k',
    outputName,
  ])

  const data = await ff.readFile(outputName)
  await ff.deleteFile(inputName)
  await ff.deleteFile(outputName)
  onProgress?.(100)

  const buffer = data instanceof Uint8Array ? data.buffer.slice(0) : data
  return new Blob([buffer as ArrayBuffer], { type: 'audio/mp3' })
}

async function ensureFont(ff: FFmpeg): Promise<boolean> {
  if (fontLoaded) return true
  for (const url of [FONT_URL, FALLBACK_FONT_URL]) {
    try {
      const res = await fetch(url)
      if (!res.ok) continue
      const blob = await res.blob()
      await ff.writeFile('caption.ttf', await fetchFile(blob))
      fontLoaded = true
      return true
    } catch { /* try next */ }
  }
  return false
}

function escapeDrawtext(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/:/g, '\\:').replace(/%/g, '\\%')
}

function buildCaptionFilter(transcript: string, clipDuration: number, outH: number): string {
  const words = transcript.split(' ').filter(Boolean)
  if (words.length === 0) return ''
  const chunkSize = Math.max(3, Math.ceil(words.length / Math.max(1, Math.floor(clipDuration / 2.2))))
  const fontSize = Math.round(outH * 0.045)
  const parts: string[] = []
  for (let i = 0; i < words.length; i += chunkSize) {
    const chunk = escapeDrawtext(words.slice(i, i + chunkSize).join(' ').toUpperCase())
    const start = (i / words.length) * clipDuration
    const end = Math.min(((i + chunkSize) / words.length) * clipDuration, clipDuration)
    parts.push(
      `drawtext=fontfile=caption.ttf:text='${chunk}':fontsize=${fontSize}:fontcolor=white:` +
      `borderw=${Math.round(fontSize * 0.12)}:bordercolor=black:x=(w-text_w)/2:y=h-h*0.18:` +
      `enable='between(t,${start.toFixed(2)},${end.toFixed(2)})'`
    )
  }
  return parts.join(',')
}

function buildVideoFilter(layout: VideoLayout, w: number, h: number, duration: number, transition: Transition): string {
  const fadeDur = 0.4
  let base = ''
  switch (layout) {
    case 'fill':
      // "cover": amplia mantendo proporção até cobrir o quadro alvo, depois corta o excesso central
      base = `scale=${w}:${h}:force_original_aspect_ratio=increase:flags=lanczos,crop=${w}:${h}`
      break
    case 'letterbox':
      base = `scale=${w}:-2:flags=lanczos,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2:black`
      break
    case 'split':
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
  outputSize: { width: number; height: number } = { width: 1080, height: 1920 },
  burnTranscript?: string,
  onProgress?: (p: number) => void,
  signal?: AbortSignal
): Promise<Blob> {
  const ff = await loadFFmpeg()
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')

  const { width: W, height: H } = outputSize
  const duration = endTime - startTime
  const inputName = 'input.mp4'
  const musicName = 'music.mp3'
  const outputName = 'output.mp4'
  const fadeDur = 0.4

  onProgress?.(5)
  await ff.writeFile(inputName, await fetchFile(videoFile))
  onProgress?.(15)

  let hasFont = false
  if (burnTranscript) {
    hasFont = await ensureFont(ff)
  }

  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')

  let hasMusicFile = false
  if (musicUrl) {
    try {
      const musicRes = await fetch(musicUrl)
      if (musicRes.ok) {
        const musicBlob = await musicRes.blob()
        await ff.writeFile(musicName, await fetchFile(musicBlob))
        hasMusicFile = true
      }
    } catch { /* skip music */ }
  }

  onProgress?.(25)
  ff.on('progress', ({ progress }) => onProgress?.(25 + Math.round(progress * 70)))

  const captionFilter = hasFont && burnTranscript ? buildCaptionFilter(burnTranscript, duration, H) : ''

  let args: string[]

  if (layout === 'split') {
    const crop = `crop=iw:iw*${H / 2}/${W}`
    const halfH = Math.round(H / 2)
    const topFilter = `[0:v]trim=start=${startTime}:end=${endTime},setpts=PTS-STARTPTS,${crop},scale=${W}:${halfH}:flags=lanczos`
    const botFilter = `[0:v]trim=start=${startTime}:end=${endTime},setpts=PTS-STARTPTS,${crop},scale=${W}:${halfH}:flags=lanczos`
    const fadeFilters = transition !== 'none'
      ? `,fade=t=in:st=0:d=${fadeDur},fade=t=out:st=${Math.max(0, duration - fadeDur)}:d=${fadeDur}`
      : ''
    const captionPart = captionFilter ? `,${captionFilter}` : ''

    const filterComplex = `${topFilter}${fadeFilters}[top];${botFilter}${fadeFilters}[bot];[top][bot]vstack,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:black${captionPart}[vout]`

    args = hasMusicFile
      ? [
          '-i', inputName, '-i', musicName,
          '-filter_complex', `${filterComplex};[0:a]atrim=start=${startTime}:end=${endTime},asetpts=PTS-STARTPTS[oa];[1:a]aloop=loop=-1:size=44100[ml];[oa][ml]amix=inputs=2:weights=1 0.15[aout]`,
          '-map', '[vout]', '-map', '[aout]',
          '-c:v', 'libx264', '-preset', 'fast', '-crf', '20', '-c:a', 'aac', '-b:a', '128k',
          '-t', String(duration), '-movflags', '+faststart', outputName,
        ]
      : [
          '-i', inputName,
          '-filter_complex', filterComplex,
          '-map', '[vout]', '-ss', String(startTime), '-t', String(duration), '-map', '0:a',
          '-c:v', 'libx264', '-preset', 'fast', '-crf', '20', '-c:a', 'aac', '-b:a', '128k',
          '-movflags', '+faststart', outputName,
        ]
  } else {
    let vf = buildVideoFilter(layout, W, H, duration, transition)
    if (captionFilter) vf = vf ? `${vf},${captionFilter}` : captionFilter
    const needsEncode = layout === 'fill' || transition !== 'none' || hasMusicFile || !!captionFilter

    if (hasMusicFile) {
      args = [
        '-ss', String(startTime), '-t', String(duration), '-i', inputName, '-i', musicName,
        '-filter_complex', `[0:v]${vf}[vout];[0:a][1:a]amix=inputs=2:weights=1 0.15[aout]`,
        '-map', '[vout]', '-map', '[aout]',
        '-c:v', 'libx264', '-preset', 'fast', '-crf', '20', '-c:a', 'aac', '-b:a', '128k',
        '-movflags', '+faststart', outputName,
      ]
    } else if (needsEncode) {
      args = [
        '-ss', String(startTime), '-t', String(duration), '-i', inputName,
        '-vf', vf,
        '-c:v', 'libx264', '-preset', 'fast', '-crf', '20', '-c:a', 'aac', '-b:a', '128k',
        '-movflags', '+faststart', outputName,
      ]
    } else {
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
