'use client'
import { useState, useRef } from 'react'
import { X, Download, Loader2, Music, Zap } from 'lucide-react'
import type { Clip } from '@/types'
import { cutVideoClip } from '@/lib/ffmpeg'
import { formatDuration, cn } from '@/lib/utils'

export type VideoLayout = 'fill' | 'letterbox' | 'split'
export type Transition = 'none' | 'fade' | 'dissolve'

const LAYOUTS: { id: VideoLayout; label: string; desc: string }[] = [
  { id: 'fill', label: '9:16 Preenchido', desc: 'Tela toda, bordas cortadas' },
  { id: 'letterbox', label: '16:9 Barras', desc: 'Vídeo original com barras' },
  { id: 'split', label: 'Split Screen', desc: 'Vídeo em cima e embaixo' },
]

const TRANSITIONS: { id: Transition; label: string; desc: string }[] = [
  { id: 'none', label: 'Sem transição', desc: 'Corte direto' },
  { id: 'fade', label: 'Fade', desc: 'Escurece e aparece suavemente' },
  { id: 'dissolve', label: 'Dissolve', desc: 'Fusão suave entre cenas' },
]

// Royalty-free tracks by mood (Pixabay public CDN)
const MUSIC_TRACKS: Record<string, { label: string; url: string }[]> = {
  epic: [
    { label: 'Epic Rise', url: 'https://cdn.pixabay.com/audio/2022/03/10/audio_270f30cb3e.mp3' },
  ],
  lofi: [
    { label: 'Lo-fi Chill', url: 'https://cdn.pixabay.com/audio/2022/05/16/audio_b2840e0a56.mp3' },
  ],
  tense: [
    { label: 'Dark Tension', url: 'https://cdn.pixabay.com/audio/2022/10/16/audio_19c64de9ba.mp3' },
  ],
  upbeat: [
    { label: 'Happy Upbeat', url: 'https://cdn.pixabay.com/audio/2022/01/18/audio_f8f26ff6ef.mp3' },
  ],
  cinematic: [
    { label: 'Cinematic', url: 'https://cdn.pixabay.com/audio/2022/03/15/audio_8cb749bcc4.mp3' },
  ],
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
  const [layout, setLayout] = useState<VideoLayout>('fill')
  const [transition, setTransition] = useState<Transition>('fade')
  const [musicGenre, setMusicGenre] = useState<string>(suggestedMusic !== 'none' ? suggestedMusic : 'none')
  const [captions, setCaptions] = useState(true)
  const [cutting, setCutting] = useState(false)
  const [progress, setProgress] = useState(0)
  const abortRef = useRef<AbortController | null>(null)

  async function handleExport() {
    const ctrl = new AbortController()
    abortRef.current = ctrl
    setCutting(true)
    setProgress(0)
    try {
      // Resolve music URL
      let musicUrl: string | undefined
      if (musicGenre !== 'none' && MUSIC_TRACKS[musicGenre]) {
        musicUrl = MUSIC_TRACKS[musicGenre][0].url
      }

      const blob = await cutVideoClip(
        videoFile,
        clip.startTime,
        clip.endTime,
        layout,
        transition,
        musicUrl,
        setProgress,
        ctrl.signal
      )

      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${clip.title.replace(/[^a-zA-Z0-9]/g, '_')}_${layout}.mp4`
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
        {/* Header */}
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

          {/* Layout */}
          <div>
            <p className="text-sm font-medium text-[#111] mb-3">Formato de saída</p>
            <div className="grid grid-cols-3 gap-2">
              {LAYOUTS.map((l) => (
                <button key={l.id} onClick={() => setLayout(l.id)}
                  className={cn('rounded-xl border-2 p-3 text-left transition-all', layout === l.id ? 'border-[#111] bg-[#111]' : 'border-[#e5e5e5] hover:border-[#ccc]')}>
                  <div className={cn('w-full mb-2 rounded-lg flex items-center justify-center', layout === l.id ? 'bg-white/10' : 'bg-[#f0f0f0]')} style={{ height: 48 }}>
                    {l.id === 'fill' && <div className={cn('w-6 h-10 rounded', layout === l.id ? 'bg-white/40' : 'bg-[#333]')} />}
                    {l.id === 'letterbox' && <div className={cn('w-11 h-6 rounded', layout === l.id ? 'bg-white/40' : 'bg-[#333]')} />}
                    {l.id === 'split' && (
                      <div className="flex flex-col gap-0.5 w-6">
                        <div className={cn('h-4 rounded-sm', layout === l.id ? 'bg-white/40' : 'bg-[#333]')} />
                        <div className={cn('h-4 rounded-sm', layout === l.id ? 'bg-white/20' : 'bg-[#555]')} />
                      </div>
                    )}
                  </div>
                  <p className={cn('text-xs font-medium', layout === l.id ? 'text-white' : 'text-[#111]')}>{l.label}</p>
                  <p className={cn('text-[10px] mt-0.5', layout === l.id ? 'text-white/60' : 'text-[#999]')}>{l.desc}</p>
                </button>
              ))}
            </div>
          </div>

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
                  <p className={cn('text-[10px] mt-0.5', transition === t.id ? 'text-white/60' : 'text-[#999]')}>{t.desc}</p>
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
            <p className="text-xs text-[#999] mb-2">Música royalty-free misturada automaticamente</p>
            <div className="grid grid-cols-2 gap-2">
              {MUSIC_GENRES.map((g) => (
                <button key={g.id} onClick={() => setMusicGenre(g.id)}
                  className={cn('rounded-xl border-2 px-3 py-2 text-left text-xs transition-all', musicGenre === g.id ? 'border-[#111] bg-[#111] text-white' : 'border-[#e5e5e5] hover:border-[#ccc] text-[#555]')}>
                  {g.label}
                </button>
              ))}
            </div>
          </div>

          {/* Captions toggle */}
          <div className="flex items-center justify-between py-3 border-t border-[#f0f0f0]">
            <div>
              <p className="text-sm font-medium text-[#111]">Baixar legendas (.SRT)</p>
              <p className="text-xs text-[#999]">Para adicionar no YouTube</p>
            </div>
            <button onClick={() => setCaptions(!captions)}
              className={cn('w-10 h-6 rounded-full transition-colors relative', captions ? 'bg-[#111]' : 'bg-[#ddd]')}>
              <div className={cn('absolute top-1 w-4 h-4 rounded-full bg-white transition-all', captions ? 'left-5' : 'left-1')} />
            </button>
          </div>

          {/* Progress */}
          {cutting && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-[#555] flex items-center gap-2"><Loader2 size={14} className="animate-spin" />Exportando…</span>
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
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '00')},${String(ms).padStart(3, '0')}`
}
