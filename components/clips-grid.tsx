'use client'
import { useState, useRef } from 'react'
import { Check, X, Clock, Zap, Heart, TrendingUp, Star, Download, Loader2, Play } from 'lucide-react'
import type { Clip } from '@/types'
import { cn, formatDuration, scoreColor, scoreBg } from '@/lib/utils'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { cutVideoClip } from '@/lib/ffmpeg'
import { ClipPreviewModal } from './clip-preview-modal'

interface ClipsGridProps {
  clips: Clip[]
  videoFile: File | null
  onClipsChange: (clips: Clip[]) => void
  onProceed: () => void
}

function ScoreBar({ label, value, icon: Icon }: { label: string; value: number; icon: any }) {
  return (
    <div className="flex items-center gap-2">
      <Icon size={11} className="text-[#aaa] shrink-0" />
      <div className="flex-1 h-1 bg-[#eee] rounded-full overflow-hidden">
        <div className={cn('h-full rounded-full', scoreBg(value))} style={{ width: `${value}%` }} />
      </div>
      <span className={cn('text-xs font-medium w-7 text-right', scoreColor(value))}>{value}</span>
    </div>
  )
}

function ClipCard({
  clip,
  videoFile,
  onApprove,
  onReject,
}: {
  clip: Clip
  videoFile: File | null
  onApprove: () => void
  onReject: () => void
}) {
  const [cutting, setCutting] = useState(false)
  const [cutProgress, setCutProgress] = useState(0)
  const [previewing, setPreviewing] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const approved = clip.status === 'APPROVED'
  const rejected = clip.status === 'REJECTED'

  async function handleDownload() {
    if (!videoFile) return
    abortRef.current = new AbortController()
    setCutting(true)
    setCutProgress(0)
    try {
      const blob = await cutVideoClip(
        videoFile,
        clip.startTime,
        clip.endTime,
        (p) => setCutProgress(p),
        abortRef.current.signal
      )
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${clip.title.replace(/[^a-zA-Z0-9]/g, '_')}.mp4`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        alert('Erro ao cortar o vídeo. Tente novamente.')
      }
    } finally {
      setCutting(false)
      setCutProgress(0)
      abortRef.current = null
    }
  }

  function handleCancel() {
    abortRef.current?.abort()
  }

  return (
    <>
      {previewing && videoFile && (
        <ClipPreviewModal
          clip={clip}
          videoFile={videoFile}
          onClose={() => setPreviewing(false)}
        />
      )}

      <div
        className={cn(
          'bg-white rounded-2xl border overflow-hidden transition-all duration-200',
          approved && 'border-emerald-300 ring-1 ring-emerald-200',
          rejected && 'border-[#eee] opacity-40',
          !approved && !rejected && 'border-[#e5e5e5] hover:border-[#ccc]'
        )}
      >
        {/* Thumbnail */}
        <div className="relative bg-gradient-to-b from-[#1a1a1a] to-[#333] aspect-[9/16] max-h-48 overflow-hidden flex items-center justify-center">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-white/20 text-7xl font-black">
              {clip.id.split('_')[1] ?? '?'}
            </div>
          </div>

          {/* Play preview button */}
          {videoFile && !cutting && (
            <button
              onClick={() => setPreviewing(true)}
              className="absolute inset-0 flex items-center justify-center group"
            >
              <div className="w-12 h-12 rounded-full bg-black/50 group-hover:bg-black/70 flex items-center justify-center transition-colors">
                <Play size={20} className="text-white ml-1" />
              </div>
            </button>
          )}

          <div className="absolute top-2 left-2">
            <div className={cn(
              'text-white text-xs font-bold px-2 py-1 rounded-lg',
              clip.totalScore >= 85 ? 'bg-emerald-500' : clip.totalScore >= 70 ? 'bg-yellow-500' : 'bg-red-500'
            )}>
              {clip.totalScore}
            </div>
          </div>

          <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded-lg flex items-center gap-1">
            <Clock size={10} />
            {formatDuration(clip.duration)}
          </div>

          {approved && !cutting && (
            <div className="absolute top-2 right-2">
              <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center">
                <Check size={12} className="text-white" />
              </div>
            </div>
          )}

          {/* Cut progress overlay */}
          {cutting && (
            <div className="absolute inset-0 bg-black/75 flex flex-col items-center justify-center gap-3">
              <Loader2 size={24} className="text-white animate-spin" />
              <span className="text-white text-sm font-medium">{cutProgress}%</span>
              <div className="w-3/4 h-1.5 bg-white/20 rounded-full overflow-hidden">
                <div
                  className="h-full bg-white rounded-full transition-all duration-300"
                  style={{ width: `${cutProgress}%` }}
                />
              </div>
              <button
                onClick={handleCancel}
                className="mt-1 text-xs text-white/50 hover:text-white/80 underline transition-colors"
              >
                Cancelar
              </button>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-4">
          <h3 className="font-semibold text-[#111] text-sm leading-snug mb-1 line-clamp-2">
            {clip.title}
          </h3>
          <p className="text-xs text-[#888] mb-3 line-clamp-2">{clip.description}</p>

          <div className="text-xs text-[#bbb] mb-3">
            {formatDuration(clip.startTime)} → {formatDuration(clip.endTime)}
          </div>

          <div className="space-y-1.5 mb-4">
            <ScoreBar label="Hook" value={clip.hookScore} icon={Zap} />
            <ScoreBar label="Emoção" value={clip.emotionScore} icon={Heart} />
            <ScoreBar label="Narrativa" value={clip.narrativeScore} icon={TrendingUp} />
            <ScoreBar label="Energia" value={clip.energyScore} icon={Star} />
          </div>

          <div className="bg-[#fafafa] rounded-lg p-2 mb-4 text-xs text-[#666] italic line-clamp-2">
            "{clip.transcript}"
          </div>

          <div className="flex gap-2">
            <Button
              variant={approved ? 'primary' : 'secondary'}
              size="sm"
              className="flex-1"
              onClick={onApprove}
            >
              <Check size={14} />
              {approved ? 'Aprovado' : 'Aprovar'}
            </Button>
            {videoFile && (
              <button
                onClick={handleDownload}
                disabled={cutting}
                title="Baixar este clip"
                className="w-8 h-8 rounded-lg hover:bg-blue-50 flex items-center justify-center text-[#ccc] hover:text-blue-500 transition-colors disabled:opacity-40"
              >
                {cutting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
              </button>
            )}
            <button
              onClick={onReject}
              className="w-8 h-8 rounded-lg hover:bg-red-50 flex items-center justify-center text-[#ccc] hover:text-red-500 transition-colors"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

export function ClipsGrid({ clips, videoFile, onClipsChange, onProceed }: ClipsGridProps) {
  const approvedCount = clips.filter((c) => c.status === 'APPROVED').length

  function approve(id: string) {
    onClipsChange(clips.map((c) => (c.id === id ? { ...c, status: 'APPROVED' } : c)))
  }

  function reject(id: string) {
    onClipsChange(clips.map((c) => (c.id === id ? { ...c, status: 'REJECTED' } : c)))
  }

  function approveAll() {
    onClipsChange(clips.map((c) => ({ ...c, status: 'APPROVED' })))
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-[#111]">Shorts detectados</h2>
          <p className="text-sm text-[#888]">
            A IA encontrou {clips.length} momentos de alta retenção
          </p>
        </div>
        <div className="flex items-center gap-3">
          {approvedCount > 0 && (
            <Badge variant="success">{approvedCount} aprovado{approvedCount > 1 ? 's' : ''}</Badge>
          )}
          <Button variant="ghost" size="sm" onClick={approveAll}>
            Aprovar todos
          </Button>
          <Button size="sm" onClick={onProceed} disabled={approvedCount === 0}>
            Publicar {approvedCount > 0 ? `(${approvedCount})` : ''} →
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {clips.map((clip) => (
          <ClipCard
            key={clip.id}
            clip={clip}
            videoFile={videoFile}
            onApprove={() => approve(clip.id)}
            onReject={() => reject(clip.id)}
          />
        ))}
      </div>
    </div>
  )
}
