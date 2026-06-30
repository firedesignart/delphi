'use client'

import { FaceDetector, FilesetResolver } from '@mediapipe/tasks-vision'

let detector: FaceDetector | null = null

async function loadDetector(): Promise<FaceDetector> {
  if (detector) return detector
  const fileset = await FilesetResolver.forVisionTasks(
    'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
  )
  detector = await FaceDetector.createFromOptions(fileset, {
    baseOptions: {
      modelAssetPath:
        'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite',
      delegate: 'GPU',
    },
    runningMode: 'VIDEO',
    minDetectionConfidence: 0.5,
  })
  return detector
}

export interface FaceTrackPoint {
  t: number // tempo relativo ao início do clip, em segundos
  x: number // centro do rosto normalizado (0-1), eixo horizontal
  faceCount: number
}

/**
 * Amostra o vídeo a cada `intervalSec` segundos dentro do intervalo [startTime, endTime],
 * roda detecção de rosto em cada frame, e retorna a posição horizontal central do rosto
 * principal ao longo do tempo. Usado para gerar um crop dinâmico que "segue" quem fala.
 */
export async function trackFaces(
  videoFile: File,
  startTime: number,
  endTime: number,
  onProgress?: (p: number) => void,
  intervalSec = 1
): Promise<FaceTrackPoint[]> {
  const det = await loadDetector()

  const video = document.createElement('video')
  video.muted = true
  video.playsInline = true
  video.src = URL.createObjectURL(videoFile)

  await new Promise<void>((resolve, reject) => {
    video.onloadedmetadata = () => resolve()
    video.onerror = () => reject(new Error('Falha ao carregar vídeo para rastreamento'))
  })

  const points: FaceTrackPoint[] = []
  const duration = endTime - startTime
  const steps = Math.max(2, Math.ceil(duration / intervalSec))

  for (let i = 0; i <= steps; i++) {
    const t = Math.min(startTime + i * intervalSec, endTime)
    await seekTo(video, t)

    try {
      const result = det.detectForVideo(video, performance.now())
      if (result.detections.length > 0) {
        // Pega o maior rosto detectado (provavelmente quem está em foco/falando)
        const best = result.detections.reduce((a, b) => {
          const areaA = (a.boundingBox?.width ?? 0) * (a.boundingBox?.height ?? 0)
          const areaB = (b.boundingBox?.width ?? 0) * (b.boundingBox?.height ?? 0)
          return areaB > areaA ? b : a
        })
        const box = best.boundingBox
        if (box) {
          const centerX = (box.originX + box.width / 2) / video.videoWidth
          points.push({ t: t - startTime, x: clamp01(centerX), faceCount: result.detections.length })
        } else {
          points.push({ t: t - startTime, x: 0.5, faceCount: 0 })
        }
      } else {
        points.push({ t: t - startTime, x: 0.5, faceCount: 0 })
      }
    } catch {
      points.push({ t: t - startTime, x: 0.5, faceCount: 0 })
    }

    onProgress?.(Math.round((i / steps) * 100))
  }

  URL.revokeObjectURL(video.src)
  return smoothTrack(points)
}

function seekTo(video: HTMLVideoElement, t: number): Promise<void> {
  return new Promise((resolve) => {
    function onSeeked() {
      video.removeEventListener('seeked', onSeeked)
      resolve()
    }
    video.addEventListener('seeked', onSeeked)
    video.currentTime = t
  })
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v))
}

// Média móvel simples para evitar tremedeira no crop
function smoothTrack(points: FaceTrackPoint[], window = 3): FaceTrackPoint[] {
  if (points.length <= 2) return points
  return points.map((p, i) => {
    const start = Math.max(0, i - Math.floor(window / 2))
    const end = Math.min(points.length, i + Math.ceil(window / 2))
    const slice = points.slice(start, end)
    const avgX = slice.reduce((sum, q) => sum + q.x, 0) / slice.length
    return { ...p, x: avgX }
  })
}

/**
 * Detecta se o trecho tem majoritariamente 2 rostos simultâneos (conversa a dois),
 * útil para decidir se vale a pena usar split screen automático.
 */
export function hasTwoSpeakers(track: FaceTrackPoint[]): boolean {
  if (track.length === 0) return false
  const twoFaceCount = track.filter((p) => p.faceCount >= 2).length
  return twoFaceCount / track.length > 0.4
}

/**
 * Gera uma expressão FFmpeg (sintaxe eval) que interpola linearmente a posição X do crop
 * ao longo do tempo, com base nos pontos rastreados.
 */
export function buildDynamicCropXExpr(
  track: FaceTrackPoint[],
  videoWidth: number,
  cropWidth: number
): string {
  if (track.length === 0) return `${Math.round((videoWidth - cropWidth) / 2)}`

  const offsets = track.map((p) => {
    const centerPx = p.x * videoWidth
    const x = clampOffset(centerPx - cropWidth / 2, videoWidth, cropWidth)
    return { t: p.t, x: Math.round(x) }
  })

  if (offsets.length === 1) return String(offsets[0].x)

  // Constrói expressão aninhada: if(lt(t,t1), lerp(t0,t1), if(lt(t,t2), lerp(t1,t2), ...))
  let expr = String(offsets[offsets.length - 1].x)
  for (let i = offsets.length - 2; i >= 0; i--) {
    const a = offsets[i]
    const b = offsets[i + 1]
    const span = Math.max(0.001, b.t - a.t)
    const lerp = `${a.x}+(${b.x}-${a.x})*(t-${a.t.toFixed(2)})/${span.toFixed(2)}`
    expr = `if(lt(t,${b.t.toFixed(2)}),${lerp},${expr})`
  }
  return expr
}

function clampOffset(x: number, videoWidth: number, cropWidth: number): number {
  return Math.max(0, Math.min(videoWidth - cropWidth, x))
}
