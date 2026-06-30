'use client'
import { useState, useRef } from 'react'
import { X, Download, Loader2, Music, Zap, Type, ScanFace } from 'lucide-react'
import type { Clip } from '@/types'
import { cutVideoClip } from '@/lib/ffmpeg'
import { trackFaces, type FaceTrackPoint } from '@/lib/face-tracking'
import { formatDuration, cn } from '@/lib/utils'

export type VideoLayout = 'fill' | 'letterbox' | 'split' | 'auto'
export type Transition = 'none' | 'fade' | 'dissolve'
export type AspectRatio = '9:16' | '1:1' | '4:5' | '16:9'

const ASPECT_RATIOS: { id: AspectRatio; label: string; w: number; h: number }[] = [
  { id: '9:16', label: 'Vertical (Shorts)', w: 1080, h: 1920 },
  { id: '1:1', label: 'Quadrado', w: 1080, h: 1080 },
  { id: '4:5', label: 'Retrato (Feed)', w: 1080, h: 1350 },
  { id: '16:9', label: 'Horizontal', w: 1920, h: 1080 },
]

const LAYOUTS: { id: VideoLayout; label: string; desc: string }[] = [
  { id: 'auto', label: 'Seguir Rosto (IA)', desc: 'Rastreia e centraliza quem fala' },
  { id: 'fill', label: 'Preenchido', desc: 'Tela toda, crop central fixo' },
  { id: 'letterbox', label: 'Com Barras', desc: 'Vídeo original, barras pretas' },
  { id: 'split', label: 'Split Screen', desc: 'Vídeo em cima e embaixo' },
]

const TRANSITIONS: { id: Transition; label: string; desc: string }[] = [
  { id: 'none', label: 'Sem transição', desc: 'Corte direto' },
  { id: 'fade', label: 'Fade', desc: 'Escurece suavemente' },
  { id: 'dissolve', label: 'Dissolve', desc: 'Fusão suave' },
]

const MUSIC_TRACKS: Record<string, { label: string; url: string }[]> = {
  epic: [{ label: 'Epic Rise', url: 'https://cdn.pixabay.com/audio/2022/03/10/audio_270f30cb3e.mp3' }],
  lofi: [{ label: 'Lo-fi Chill', url: 'https://cdn.pixabay.com/audio/2022/05/16/audio_b2840e0a56.mp3' }],
  tense: [{ label: 'Dark Tension', url: 'https://cdn.pixabay.com/audio/2022/10/16/audio_19c64de9ba.mp3' }],
  upbeat: [{ label: 'Happy Upbeat', url: 'https://cdn.pixabay.com/audio/2022/01/18/audio_f8f26ff6ef.mp3' }],
  cinematic: [{ label: 'Cinematic', url: 'https://cdn.pixabay.com/audio/2022/03/15/audio_8cb749bcc4.mp3' }],
}

const MUSIC_GENRES = [
  { id: 'none', label: 'Sem música' },
  { id: 'epic', label: 'Épica / Motivacional' },
  { id: 'lofi', label: 'Lo-fi / Relaxante' },
  { id: 'tense', label: 'Tensão / Terror' },
  { id: 'upbeat', label: 'Alegre / Animado' },
  { id: 'cinematic', label: 'Cinematográfica' },
]

interface LayoutPickerProps {
  clip: Clip
  videoFile: File
  suggestedMusic?: string
  onClose: () => void
}

export function LayoutPicker({ clip, videoFile, suggestedMusic = 'none', onClose }: LayoutPickerProps) {
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('9:16')
  const [layout, setLayout] = useState<VideoLayout>('auto')
  const [transition, setTransition] = useState<Transition>('fade')
  const [musicGenre, setMusicGenre] = useState<string>(suggestedMusic !== 'none' ? suggestedMusic : 'none')
  const [captions, setCaptions] = useState(true)
  const [burnCaptions, setBurnCaptions] = useState(true)
  const [cutting, setCutting] = useState(false)
  const [progress, setProgress] = useState(0)
  const [stage, setStage] = useState<'tracking' | 'exporting'>('exporting')
  const abortRef = useRef<AbortController | null>(null)

  const isVertical = aspectRatio === '9:16' || aspectRatio === '4:5' || aspectRatio === '1:1'

  async function handleExport() {
    const ctrl = new AbortController()
    abortRef.current = ctrl
    setCutting(true)
    setProgress(0)
    try {
      let musicUrl: string | undefined
      if (musicGenre !== 'none' && MUSIC_TRACKS[musicGenre]) {
        musicUrl = MUSIC_TRACKS[musicGenre][0].url
      }

      const ratio = ASPECT_RATIOS.find((r) => r.id === aspectRatio)!

      let faceTrack: { points: FaceTrackPoint[]; videoWidth: number; videoHeight: number } | undefined
      if (layout === 'auto') {
        setStage('tracking')
        const video = document.createElement('video')
        video.src = URL.createObjectURL(videoFile)
        await new Promise<void>((resolve) => { video.onloadedmetadata = () => resolve() })
        const videoWidth = video.videoWidth
        const videoHeight = video.videoHeight
        URL.revokeObjectURL(video.src)

        const points = await trackFaces(videoFile, clip.startTime, clip.endTime, setProgress)
        faceTrack = { points, videoWidth, videoHeight }
        setStage('exporting')
        setProgress(0)
      }

      const blob = await cutVideoClip(
        videoFile,
        clip.startTime,
        clip.endTime,
        layout,
        transition,
        musicUrl,
        { width: ratio.w, height: ratio.h },
        burnCaptions ? clip.transcript : undefined,
        setProgress,
        ctrl.signal,
        faceTrack
      )

      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${clip.title.replace(/[^a-zA-Z0-9]/g, '_')}_${aspectRatio.replace(':', 'x')}.mp4`
      a.click()
      URL.revokeObjectURL(url)

      if (captions && clip.transcript) {
        const srt = generateSRT(clip)
        const srtBlob = new Blob([srt], { type: 'text/plain' })
        const srtUrl = URL.createObjectURL(srtBlob)
        const srtA = document.createElement('a')
        srtA.href = srtUrl
        srtA.download = `${clip.title.replace(/[^a-zA-Z0-9]/g, '_')}.srt`
        srtA.click()
        URL.revokeObjectURL(srtUrl)
      }

      onClose()
    } catch (err: any) {
      if (err?.name !== 'AbortError') alert('Erro ao exportar. Tente novamente.')
    } finally {
      setCutting(false)
      setProgress(0)
      abortRef.current = null
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl my-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#eee]">
          <div>
            <h3 className="font-semibold text-[#111]">Exportar clip</h3>
            <p className="text-xs text-[#888] mt-0.5 line-clamp-1">{clip.title}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-[#f5f5f5] flex items-center justify-center text-[#999]">
            <X size={16} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          <p className="text-xs text-[#888]">{formatDuration(clip.startTime)} → {formatDuration(clip.endTime)} · {formatDuration(clip.duration)}</p>

          {/* Aspect ratio */}
          <div>
            <p className="text-sm font-medium text-[#111] mb-3">Proporção</p>
            <div className="grid grid-cols-4 gap-2">
              {ASPECT_RATIOS.map((r) => (
                <button key={r.id} onClick={() => setAspectRatio(r.id)}
                  className={cn('rounded-xl border-2 p-2 flex flex-col items-center gap-1.5 transition-all', aspectRatio === r.id ? 'border-[#111] bg-[#111]' : 'border-[#e5e5e5] hover:border-[#ccc]')}>
                  <div className={cn('rounded', aspectRatio === r.id ? 'bg-white/40' : 'bg-[#333]')}
                    style={{ width: r.w >= r.h ? 28 : (28 * r.w) / r.h, height: r.h >= r.w ? 28 : (28 * r.h) / r.w }} />
                  <span className={cn('text-[10px] font-medium', aspectRatio === r.id ? 'text-white' : 'text-[#555]')}>{r.id}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Layout — only relevant for vertical/square ratios */}
          {isVertical && (
            <div>
              <p className="text-sm font-medium text-[#111] mb-3">Enquadramento</p>
              <div className="grid grid-cols-2 gap-2">
                {LAYOUTS.map((l) => (
                  <button key={l.id} onClick={() => setLayout(l.id)}
                    className={cn('rounded-xl border-2 px-3 py-2.5 text-left transition-all flex items-start gap-2', layout === l.id ? 'border-[#111] bg-[#111]' : 'border-[#e5e5e5] hover:border-[#ccc]')}>
                    {l.id === 'auto' && <ScanFace size={14} className={cn('mt-0.5 shrink-0', layout === l.id ? 'text-white' : 'text-[#888]')} />}
                    <div>
                      <p className={cn('text-xs font-medium', layout === l.id ? 'text-white' : 'text-[#111]')}>{l.label}</p>
                      <p className={cn('text-[10px] mt-0.5', layout === l.id ? 'text-white/60' : 'text-[#999]')}>{l.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Transition */}
          <div>
            <p className="text-sm font-medium text-[#111] mb-3 flex items-center gap-2">
              <Zap size={14} className="text-[#888]" /> Transição
            </p>
            <div className="flex gap-2">
              {TRANSITIONS.map((t) => (
                <button key={t.id} onClick={() => setTransition(t.id)}
                  className={cn('flex-1 rounded-xl border-2 px-3 py-2.5 text-left transition-all', transition === t.id ? 'border-[#111] bg-[#111]' : 'border-[#e5e5e5] hover:border-[#ccc]')}>
                  <p className={cn('text-xs font-medium', transition === t.id ? 'text-white' : 'text-[#111]')}>{t.label}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Music */}
          <div>
            <p className="text-sm font-medium text-[#111] mb-1 flex items-center gap-2">
              <Music size={14} className="text-[#888]" /> Trilha sonora
              {suggestedMusic !== 'none' && (
                <span className="text-[10px] bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full font-medium">Sugerida pela IA</span>
              )}
            </p>
            <div className="grid grid-cols-2 gap-2 mt-2">
              {MUSIC_GENRES.map((g) => (
                <button key={g.id} onClick={() => setMusicGenre(g.id)}
                  className={cn('rounded-xl border-2 px-3 py-2 text-left text-xs transition-all', musicGenre === g.id ? 'border-[#111] bg-[#111] text-white' : 'border-[#e5e5e5] hover:border-[#ccc] text-[#555]')}>
                  {g.label}
                </button>
              ))}
            </div>
          </div>

          {/* Burn captions toggle */}
          <div className="flex items-center justify-between py-3 border-t border-[#f0f0f0]">
            <div className="flex items-center gap-2">
              <Type size={14} className="text-[#888]" />
              <div>
                <p className="text-sm font-medium text-[#111]">Legenda no vídeo</p>
                <p className="text-xs text-[#999]">Queima o texto direto na imagem</p>
              </div>
            </div>
            <button onClick={() => setBurnCaptions(!burnCaptions)}
              className={cn('w-10 h-6 rounded-full transition-colors relative shrink-0', burnCaptions ? 'bg-[#111]' : 'bg-[#ddd]')}>
              <div className={cn('absolute top-1 w-4 h-4 rounded-full bg-white transition-all', burnCaptions ? 'left-5' : 'left-1')} />
            </button>
          </div>

          {/* SRT download toggle */}
          <div className="flex items-center justify-between py-1">
            <div>
              <p className="text-sm font-medium text-[#111]">Baixar arquivo .SRT</p>
              <p className="text-xs text-[#999]">Para adicionar manualmente no YouTube</p>
            </div>
            <button onClick={() => setCaptions(!captions)}
              className={cn('w-10 h-6 rounded-full transition-colors relative', captions ? 'bg-[#111]' : 'bg-[#ddd]')}>
              <div className={cn('absolute top-1 w-4 h-4 rounded-full bg-white transition-all', captions ? 'left-5' : 'left-1')} />
            </button>
          </div>

          {cutting && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-[#555] flex items-center gap-2">
                  <Loader2 size={14} className="animate-spin" />
                  {stage === 'tracking' ? 'Rastreando rosto…' : 'Exportando…'}
                </span>
                <span className="font-medium">{progress}%</span>
              </div>
              <div className="h-1.5 bg-[#eee] rounded-full overflow-hidden">
                <div className="h-full bg-[#111] rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
              </div>
              <button onClick={() => abortRef.current?.abort()} className="text-xs text-[#999] hover:text-red-500 transition-colors">Cancelar</button>
            </div>
          )}

          {!cutting && (
            <button onClick={handleExport}
              className="w-full bg-[#111] text-white rounded-xl py-3 font-medium flex items-center justify-center gap-2 hover:bg-[#222] transition-colors">
              <Download size={16} /> Exportar
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function generateSRT(clip: Clip): string {
  if (!clip.transcript) return ''
  const words = clip.transcript.split(' ')
  const duration = clip.endTime - clip.startTime
  const chunkSize = Math.max(4, Math.ceil(words.length / Math.max(1, Math.floor(duration / 3))))
  const lines: string[] = []
  let idx = 1
  for (let i = 0; i < words.length; i += chunkSize) {
    const chunk = words.slice(i, i + chunkSize).join(' ')
    const start = clip.startTime + (i / words.length) * duration
    const end = Math.min(clip.startTime + ((i + chunkSize) / words.length) * duration, clip.endTime)
    lines.push(`${idx}\n${toSRTTime(start)} --> ${toSRTTime(end)}\n${chunk}\n`)
    idx++
  }
  return lines.join('\n')
}

function toSRTTime(s: number): string {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = Math.floor(s % 60)
  const ms = Math.round((s % 1) * 1000)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')},${String(ms).padStart(3, '0')}`
}
