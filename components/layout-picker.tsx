'use client'
import { useState } from 'react'
import { X, Download, Loader2 } from 'lucide-react'
import type { Clip } from '@/types'
import { cutVideoClip } from '@/lib/ffmpeg'
import { formatDuration } from '@/lib/utils'

export type VideoLayout = 'fill' | 'letterbox' | 'split'

interface LayoutPickerProps {
  clip: Clip
  videoFile: File
  onClose: () => void
}

const LAYOUTS: { id: VideoLayout; label: string; desc: string; preview: string }[] = [
  {
    id: 'fill',
    label: '9:16 Preenchido',
    desc: 'Vídeo ocupa a tela toda, bordas cortadas',
    preview: '▮',
  },
  {
    id: 'letterbox',
    label: '16:9 com Barras',
    desc: 'Vídeo original com barras pretas',
    preview: '▬',
  },
  {
    id: 'split',
    label: 'Split Screen',
    desc: 'Vídeo duplicado em cima e embaixo',
    preview: '⬒',
  },
]

export function LayoutPicker({ clip, videoFile, onClose }: LayoutPickerProps) {
  const [layout, setLayout] = useState<VideoLayout>('fill')
  const [captions, setCaptions] = useState(true)
  const [cutting, setCutting] = useState(false)
  const [progress, setProgress] = useState(0)
  const [abortCtrl, setAbortCtrl] = useState<AbortController | null>(null)

  async function handleExport() {
    const ctrl = new AbortController()
    setAbortCtrl(ctrl)
    setCutting(true)
    setProgress(0)

    try {
      const blob = await cutVideoClip(videoFile, clip.startTime, clip.endTime, layout, setProgress, ctrl.signal)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${clip.title.replace(/[^a-zA-Z0-9]/g, '_')}_${layout}.mp4`
      a.click()
      URL.revokeObjectURL(url)

      // Download SRT if captions enabled
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
      setAbortCtrl(null)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
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
          {/* Duration info */}
          <div className="text-xs text-[#888]">
            {formatDuration(clip.startTime)} → {formatDuration(clip.endTime)} · {formatDuration(clip.duration)}
          </div>

          {/* Layout options */}
          <div>
            <p className="text-sm font-medium text-[#111] mb-3">Formato de saída</p>
            <div className="grid grid-cols-3 gap-2">
              {LAYOUTS.map((l) => (
                <button
                  key={l.id}
                  onClick={() => setLayout(l.id)}
                  className={`rounded-xl border-2 p-3 text-left transition-all ${
                    layout === l.id
                      ? 'border-[#111] bg-[#111]'
                      : 'border-[#e5e5e5] hover:border-[#ccc]'
                  }`}
                >
                  {/* Visual preview */}
                  <div className={`w-full mb-2 rounded-lg overflow-hidden flex items-center justify-center bg-[#f0f0f0] ${layout === l.id ? 'bg-white/10' : ''}`} style={{ height: 56 }}>
                    {l.id === 'fill' && (
                      <div className="w-7 h-12 rounded bg-[#333]" style={layout === l.id ? { background: 'rgba(255,255,255,0.3)' } : {}} />
                    )}
                    {l.id === 'letterbox' && (
                      <div className="w-12 h-7 rounded bg-[#333]" style={layout === l.id ? { background: 'rgba(255,255,255,0.3)' } : {}} />
                    )}
                    {l.id === 'split' && (
                      <div className="flex flex-col gap-0.5 w-7">
                        <div className="h-5 rounded-sm bg-[#333]" style={layout === l.id ? { background: 'rgba(255,255,255,0.3)' } : {}} />
                        <div className="h-5 rounded-sm bg-[#555]" style={layout === l.id ? { background: 'rgba(255,255,255,0.2)' } : {}} />
                      </div>
                    )}
                  </div>
                  <p className={`text-xs font-medium leading-tight ${layout === l.id ? 'text-white' : 'text-[#111]'}`}>{l.label}</p>
                  <p className={`text-[10px] mt-0.5 leading-tight ${layout === l.id ? 'text-white/60' : 'text-[#999]'}`}>{l.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Captions toggle */}
          <div className="flex items-center justify-between py-3 border-t border-[#f0f0f0]">
            <div>
              <p className="text-sm font-medium text-[#111]">Baixar legendas (.SRT)</p>
              <p className="text-xs text-[#999]">Arquivo de legenda para adicionar no YouTube</p>
            </div>
            <button
              onClick={() => setCaptions(!captions)}
              className={`w-10 h-6 rounded-full transition-colors relative ${captions ? 'bg-[#111]' : 'bg-[#ddd]'}`}
            >
              <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${captions ? 'left-5' : 'left-1'}`} />
            </button>
          </div>

          {/* Progress */}
          {cutting && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-[#555] flex items-center gap-2">
                  <Loader2 size={14} className="animate-spin" />
                  Exportando…
                </span>
                <span className="text-[#111] font-medium">{progress}%</span>
              </div>
              <div className="h-1.5 bg-[#eee] rounded-full overflow-hidden">
                <div className="h-full bg-[#111] rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
              </div>
              <button onClick={() => abortCtrl?.abort()} className="text-xs text-[#999] hover:text-red-500 transition-colors">
                Cancelar
              </button>
            </div>
          )}

          {/* Export button */}
          {!cutting && (
            <button
              onClick={handleExport}
              className="w-full bg-[#111] text-white rounded-xl py-3 font-medium flex items-center justify-center gap-2 hover:bg-[#222] transition-colors"
            >
              <Download size={16} />
              Exportar
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
  const chunkSize = Math.ceil(words.length / Math.max(1, Math.floor(duration / 3)))
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
