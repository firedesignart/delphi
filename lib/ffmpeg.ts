'use client'

import { FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile, toBlobURL } from '@ffmpeg/util'
import type { VideoLayout, Transition } from '@/components/layout-picker'
import { buildDynamicCropXExpr, type FaceTrackPoint } from './face-tracking'

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
  const MAX_SIZE = 1.5 * 1024 * 1024 * 1024 // 1.5GB
  if (videoFile.size > MAX_SIZE) {
    throw new Error(
      `Vídeo muito grande (${(videoFile.size / 1024 / 1024 / 1024).toFixed(1)}GB). ` +
      `O processamento no navegador funciona melhor com vídeos até 1.5GB.`
    )
  }

  try {
    const ff = await loadFFmpeg()
    const inputName = 'extract_input.mp4'
    const outputName = 'extract_output.mp3'

    onProgress?.(5)
    await ff.writeFile(inputName, await fetchFile(videoFile))
    onProgress?.(15)

    ff.on('progress', ({ progress }) => onProgress?.(15 + Math.round(progress * 75)))

    await ff.exec(['-i', inputName, '-vn', '-ac', '1', '-ar', '16000', '-b:a', '64k', outputName])

    const data = await ff.readFile(outputName)
    await ff.deleteFile(inputName)
    await ff.deleteFile(outputName)
    onProgress?.(100)

    const buffer = data instanceof Uint8Array ? data.buffer.slice(0) : data
    return new Blob([buffer as ArrayBuffer], { type: 'audio/mp3' })
  } catch (err) {
    loaded = false
    ffmpeg = null
    throw err
  }
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

export type CaptionStyleId = 'classic' | 'highlight' | 'box'
export type CaptionPosition = 'bottom' | 'center' | 'top'

function buildCaptionFilter(
  transcript: string,
  clipDuration: number,
  outH: number,
  styleId: CaptionStyleId = 'classic',
  position: CaptionPosition = 'bottom'
): string {
  const words = transcript.split(' ').filter(Boolean)
  if (words.length === 0) return ''
  // Grupos curtos (2-3 palavras) trocando rápido — estilo legenda animada de Shorts/TikTok
  const chunkSize = Math.max(2, Math.min(3, Math.ceil(words.length / Math.max(1, Math.floor(clipDuration / 1.1)))))
  const baseFontSize = Math.round(outH * 0.05)
  const popDur = 0.12 // duração do "pop" de entrada de cada grupo

  const yExpr = position === 'top' ? `h*0.10` : position === 'center' ? `(h-text_h)/2` : `h-h*0.18`

  const styleProps: Record<CaptionStyleId, string> = {
    classic: `fontcolor=white:borderw=${Math.round(baseFontSize * 0.13)}:bordercolor=black`,
    highlight: `fontcolor=#FFE600:borderw=${Math.round(baseFontSize * 0.15)}:bordercolor=black`,
    box: `fontcolor=white:box=1:boxcolor=black@0.7:boxborderw=${Math.round(baseFontSize * 0.25)}`,
  }

  const parts: string[] = []
  for (let i = 0; i < words.length; i += chunkSize) {
    const chunk = escapeDrawtext(words.slice(i, i + chunkSize).join(' ').toUpperCase())
    const start = (i / words.length) * clipDuration
    const end = Math.min(((i + chunkSize) / words.length) * clipDuration, clipDuration)
    // Efeito "pop": cresce de 75% até 100% do tamanho nos primeiros instantes do grupo aparecer
    const fontSizeExpr = `'if(lt(t-${start.toFixed(2)},${popDur}),${Math.round(baseFontSize * 0.75)}+${Math.round(baseFontSize * 0.25)}*(t-${start.toFixed(2)})/${popDur},${baseFontSize})'`
    parts.push(
      `drawtext=fontfile=caption.ttf:text='${chunk}':fontsize=${fontSizeExpr}:${styleProps[styleId]}:` +
      `x=(w-text_w)/2:y=${yExpr}:` +
      `enable='between(t,${start.toFixed(2)},${end.toFixed(2)})'`
    )
  }
  return parts.join(',')
}

function buildFillFilter(w: number, h: number, faceTrack?: { points: FaceTrackPoint[]; videoWidth: number; videoHeight: number }): string {
  if (!faceTrack) return `scale=${w}:${h}:force_original_aspect_ratio=increase:flags=lanczos,crop=${w}:${h}`
  const scaledWidth = Math.round((faceTrack.videoWidth / faceTrack.videoHeight) * h)
  const cropXExpr = buildDynamicCropXExpr(faceTrack.points, scaledWidth, w)
  return `scale=${scaledWidth}:${h}:flags=lanczos,crop=${w}:${h}:x='${cropXExpr}':y=0`
}

/**
 * Layout "React": fundo desfocado preenchendo o quadro + um recorte nítido
 * (rastreado por rosto, se disponível) centralizado por cima — estilo reaction/podcast clip.
 */
function buildReactFilterComplex(
  w: number,
  h: number,
  faceTrack: { points: FaceTrackPoint[]; videoWidth: number; videoHeight: number } | undefined,
  trimPrefix: string
): string {
  const insetW = Math.round(w * 0.86)
  const insetH = Math.round(h * 0.62)
  const insetY = Math.round(h * 0.19)

  const bg = `${trimPrefix}scale=${w}:${h}:force_original_aspect_ratio=increase:flags=lanczos,crop=${w}:${h},boxblur=24:2,eq=brightness=-0.06[bg]`

  let fgCrop: string
  if (faceTrack) {
    const scaledWidth = Math.round((faceTrack.videoWidth / faceTrack.videoHeight) * insetH)
    const cropXExpr = buildDynamicCropXExpr(faceTrack.points, scaledWidth, insetW)
    fgCrop = `scale=${scaledWidth}:${insetH}:flags=lanczos,crop=${insetW}:${insetH}:x='${cropXExpr}':y=0`
  } else {
    fgCrop = `scale=${insetW}:${insetH}:force_original_aspect_ratio=increase:flags=lanczos,crop=${insetW}:${insetH}`
  }
  const fg = `${trimPrefix}${fgCrop}[fg]`

  return `${bg};${fg};[bg][fg]overlay=(${w}-${insetW})/2:${insetY}:format=auto[vout]`
}

interface CutOptions {
  layout: VideoLayout
  transition: Transition
  musicUrl?: string
  outputSize: { width: number; height: number }
  burnTranscript?: string
  faceTrack?: { points: FaceTrackPoint[]; videoWidth: number; videoHeight: number }
  watermarkPng?: Blob
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
  signal?: AbortSignal,
  faceTrack?: { points: FaceTrackPoint[]; videoWidth: number; videoHeight: number },
  watermarkPng?: Blob,
  captionStyle: CaptionStyleId = 'classic',
  captionPosition: CaptionPosition = 'bottom',
  faceSide: 'left' | 'right' = 'left'
): Promise<Blob> {
  const ff = await loadFFmpeg()
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')

  const { width: W, height: H } = outputSize
  const duration = endTime - startTime
  const inputName = 'input.mp4'
  const musicName = 'music.mp3'
  const watermarkName = 'watermark.png'
  const outputName = 'output.mp4'
  const fadeDur = 0.4

  onProgress?.(5)
  await ff.writeFile(inputName, await fetchFile(videoFile))
  onProgress?.(12)

  let hasFont = false
  if (burnTranscript) hasFont = await ensureFont(ff)

  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')

  let hasMusicFile = false
  if (musicUrl) {
    try {
      const musicRes = await fetch(musicUrl)
      if (musicRes.ok) {
        await ff.writeFile(musicName, await fetchFile(await musicRes.blob()))
        hasMusicFile = true
      }
    } catch { /* skip music */ }
  }

  let hasWatermark = false
  if (watermarkPng) {
    try {
      await ff.writeFile(watermarkName, await fetchFile(watermarkPng))
      hasWatermark = true
    } catch { /* skip watermark */ }
  }

  onProgress?.(22)
  ff.on('progress', ({ progress }) => onProgress?.(22 + Math.round(progress * 70)))

  const captionFilter = hasFont && burnTranscript ? buildCaptionFilter(burnTranscript, duration, H, captionStyle, captionPosition) : ''
  const fadeFilters = transition !== 'none'
    ? `,fade=t=in:st=0:d=${fadeDur},fade=t=out:st=${Math.max(0, duration - fadeDur)}:d=${fadeDur}`
    : ''

  // Constrói o filtro de vídeo principal, sempre terminando no label [vraw]
  let videoChain: string
  let trimmedAudioInComplex = false

  if (layout === 'split') {
    // Corta as duas metades do quadro (esquerda/direita) e empilha — o lado com o rosto
    // (ex: streamer em live) sempre vai pra cima, o resto (ex: gameplay) pra baixo.
    const halfH = Math.round(H / 2)
    const cropExpr = `crop=ih*${W}/${halfH}:ih`
    const leftX = '0:0'
    const rightX = 'in_w-out_w:0'
    const [topX, botX] = faceSide === 'right' ? [rightX, leftX] : [leftX, rightX]
    const trimPrefix = `[0:v]trim=start=${startTime}:end=${endTime},setpts=PTS-STARTPTS,`
    const topFilter = `${trimPrefix}${cropExpr}:${topX},scale=${W}:${halfH}:flags=lanczos${fadeFilters}[top]`
    const botFilter = `${trimPrefix}${cropExpr}:${botX},scale=${W}:${halfH}:flags=lanczos${fadeFilters}[bot]`
    videoChain = `${topFilter};${botFilter};[top][bot]vstack,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:black[vraw]`
    trimmedAudioInComplex = true
  } else if (layout === 'react') {
    const trimPrefix = `[0:v]trim=start=${startTime}:end=${endTime},setpts=PTS-STARTPTS,`
    const reactComplex = buildReactFilterComplex(W, H, faceTrack, trimPrefix).replace('[vout]', `${fadeFilters}[vraw]`)
    videoChain = reactComplex
    trimmedAudioInComplex = true
  } else {
    let vf = layout === 'letterbox'
      ? `scale=${W}:-2:flags=lanczos,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:black`
      : buildFillFilter(W, H, faceTrack)
    if (transition !== 'none') vf += fadeFilters
    videoChain = `[0:v]${vf}[vraw]`
  }

  if (captionFilter) videoChain += `;[vraw]${captionFilter}[vcap]`
  let finalVideoLabel = captionFilter ? '[vcap]' : '[vraw]'

  if (hasWatermark) {
    const margin = Math.round(W * 0.04)
    const wmSize = Math.round(W * 0.12)
    videoChain += `;[${hasMusicFile ? '2' : '1'}:v]scale=${wmSize}:-1[wm];${finalVideoLabel}[wm]overlay=W-w-${margin}:H-h-${margin}:format=auto[vfinal]`
    finalVideoLabel = '[vfinal]'
  }

  const inputs = ['-i', inputName]
  if (hasMusicFile) inputs.push('-i', musicName)
  if (hasWatermark) inputs.push('-i', watermarkName)

  let audioFilter = ''
  let mapArgs: string[]

  if (trimmedAudioInComplex) {
    if (hasMusicFile) {
      audioFilter = `;[0:a]atrim=start=${startTime}:end=${endTime},asetpts=PTS-STARTPTS[oa];[1:a]aloop=loop=-1:size=44100[ml];[oa][ml]amix=inputs=2:weights=1 0.15[aout]`
      mapArgs = ['-map', finalVideoLabel, '-map', '[aout]', '-t', String(duration)]
    } else {
      mapArgs = ['-map', finalVideoLabel, '-ss', String(startTime), '-t', String(duration), '-map', '0:a']
    }
  } else if (hasMusicFile) {
    audioFilter = `;[0:a][1:a]amix=inputs=2:weights=1 0.15[aout]`
    mapArgs = ['-ss', String(startTime), '-t', String(duration), '-map', finalVideoLabel, '-map', '[aout]']
  } else {
    mapArgs = ['-ss', String(startTime), '-t', String(duration), '-map', finalVideoLabel, '-map', '0:a']
  }

  const args = [
    ...inputs,
    '-filter_complex', videoChain + audioFilter,
    ...mapArgs,
    '-c:v', 'libx264', '-preset', 'fast', '-crf', '20',
    '-c:a', 'aac', '-b:a', '128k',
    '-movflags', '+faststart',
    outputName,
  ]

  try {
    await ff.exec(args)
  } catch (err) {
    loaded = false
    ffmpeg = null
    throw err
  }
  onProgress?.(95)

  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')

  const data = await ff.readFile(outputName)
  await ff.deleteFile(inputName)
  if (hasMusicFile) await ff.deleteFile(musicName)
  if (hasWatermark) await ff.deleteFile(watermarkName)
  await ff.deleteFile(outputName)
  onProgress?.(100)

  const buffer = data instanceof Uint8Array ? data.buffer.slice(0) : data
  return new Blob([buffer as ArrayBuffer], { type: 'video/mp4' })
}
