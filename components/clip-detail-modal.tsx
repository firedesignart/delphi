'use client'
import { useEffect, useRef, useState } from 'react'
import { X, Check, Download, Zap, Heart, TrendingUp, Star, Play, Pause } from 'lucide-react'
import type { Clip } from '@/types'
import { cn, formatDuration, scoreColor, scoreBg } from '@/lib/utils'
import { LayoutPicker } from './layout-picker'
import { localStreamUrl } from '@/lib/local-helper'

interface ClipDetailModalProps {
  clip: Clip
  videoFile: File | null
  localFilename?: string
  suggestedMusic?: string
  onClose: () => void
  onApprove: () => void
  onReject: () => void
}

function ScoreRow({ label, value, icon: Icon }: { label: string; value: number; icon: any }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-1.5 w-24">
        <Icon size={12} className="text-[#aaa]" />
        <span className="text-xs text-[#888]">{label}</span>
      </div>
      <div className="flex-1 h-1.5 bg-[#eee] rounded-full overflow-hidden">
        <div className={cn('h-full rounded-full transition-all', scoreBg(value))} style={{ width: `${value}%` }} />
      </div>
      <span className={cn('text-xs font-semibold w-8 text-right', scoreColor(value))}>{value}</span>
    </div>
  )
}

export function ClipDetailModal({ clip, videoFile, localFilename, suggestedMusic, onClose, onApprove, onReject }: ClipDetailModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const urlRef = useRef('')
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(clip.startTime)
  const [exporting, setExporting] = useState(false)
  const approved = clip.status === 'APPROVED'

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    if (localFilename) {
      video.src = localStreamUrl(localFilename)
    } else if (videoFile) {
      urlRef.current = URL.createObjectURL(videoFile)
      video.src = urlRef.current
    } else {
      return
    }
    video.currentTime = clip.startTime

    function onTime() {
      if (!video) return
      setCurrentTime(video.currentTime)
      if (video.currentTime >= clip.endTime) {
        video.pause()
        video.currentTime = clip.startTime
        setPlaying(false)
      }
    }
    video.addEventListener('timeupdate', onTime)
    return () => {
      video.removeEventListener('timeupdate', onTime)
      if (urlRef.current) URL.revokeObjectURL(urlRef.current)
    }
  }, [clip, videoFile, localFilename])

  function togglePlay() {
    const video = videoRef.current
    if (!video) return
    if (video.paused) {
      video.play()
      setPlaying(true)
    } else {
      video.pause()
      setPlaying(false)
    }
  }

  // Split transcript into pseudo-segments for display
  const words = clip.transcript?.split(' ') ?? []
  const hookWordCount = Math.ceil((words.length * 5) / Math.max(1, clip.duration))
  const hookWords = words.slice(0, hookWordCount).join(' ')
  const restWords = words.slice(hookWordCount).join(' ')

  const progress = clip.duration > 0
    ? Math.min(100, ((currentTime - clip.startTime) / clip.duration) * 100)
    : 0

  return (
    <>
      {exporting && (
        <LayoutPicker clip={clip} videoFile={videoFile} localFilename={localFilename} suggestedMusic={suggestedMusic} onClose={() => setExporting(false)} />
      )}

      <div className="fixed inset-0 z-40 bg-black/85 flex items-center justify-center p-4" onClick={onClose}>
        <div
          className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#eee] shrink-0">
            <div className="flex items-center gap-3">
              {clip.isBest && (
                <span className="text-[10px] bg-yellow-400 text-yellow-900 font-bold px-2 py-0.5 rounded-full">★ Melhor clip</span>
              )}
              <h2 className="font-semibold text-[#111] line-clamp-1">{clip.title}</h2>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-[#f5f5f5] flex items-center justify-center text-[#999]">
              <X size={16} />
            </button>
          </div>

          <div className="flex flex-1 overflow-hidden">
            {/* Left: video */}
            <div className="w-64 shrink-0 bg-black flex flex-col">
              <div className="relative flex-1 flex items-center justify-center">
                <video ref={videoRef} className="max-h-full w-full object-contain" playsInline />
                <button
                  onClick={togglePlay}
                  className="absolute inset-0 flex items-center justify-center group"
                >
                  <div className={cn(
                    'w-12 h-12 rounded-full bg-black/50 group-hover:bg-black/70 flex items-center justify-center transition-all',
                    playing && 'opacity-0 group-hover:opacity-100'
                  )}>
                    {playing
                      ? <Pause size={20} className="text-white" />
                      : <Play size={20} className="text-white ml-1" />
                    }
                  </div>
                </button>
              </div>
              {/* Progress bar */}
              <div className="px-3 py-2 bg-black/80">
                <div className="h-1 bg-white/20 rounded-full overflow-hidden">
                  <div className="h-full bg-white rounded-full transition-all" style={{ width: `${progress}%` }} />
                </div>
                <div className="flex justify-between text-[10px] text-white/50 mt-1">
                  <span>{formatDuration(currentTime - clip.startTime)}</span>
                  <span>{formatDuration(clip.duration)}</span>
                </div>
              </div>
            </div>

            {/* Right: info */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* Scores */}
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <div className={cn(
                    'text-2xl font-black',
                    clip.totalScore >= 85 ? 'text-emerald-500' : clip.totalScore >= 70 ? 'text-yellow-500' : 'text-red-500'
                  )}>
                    {clip.totalScore}
                    <span className="text-sm font-normal text-[#aaa]">/100</span>
                  </div>
                  <span className="text-xs text-[#888]">
                    {formatDuration(clip.startTime)} → {formatDuration(clip.endTime)} · {formatDuration(clip.duration)}
                  </span>
                </div>
                <div className="space-y-2">
                  <ScoreRow label="Hook" value={clip.hookScore} icon={Zap} />
                  <ScoreRow label="Emoção" value={clip.emotionScore} icon={Heart} />
                  <ScoreRow label="Narrativa" value={clip.narrativeScore} icon={TrendingUp} />
                  <ScoreRow label="Energia" value={clip.energyScore} icon={Star} />
                </div>
              </div>

              {/* Transcript with hook highlighted */}
              <div>
                <p className="text-xs font-semibold text-[#111] uppercase tracking-wide mb-2">Transcrição</p>

                {hookWords && (
                  <div className="mb-3">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Zap size={11} className="text-yellow-500" />
                      <span className="text-[10px] font-bold text-yellow-600 uppercase tracking-wide">Gancho — primeiros 5s</span>
                    </div>
                    <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-3 py-2.5 text-sm text-[#333] leading-relaxed">
                      {hookWords}
                    </div>
                  </div>
                )}

                {restWords && (
                  <div className="bg-[#fafafa] rounded-xl px-3 py-2.5 text-sm text-[#666] leading-relaxed">
                    {restWords}
                  </div>
                )}
              </div>

              {/* Description */}
              {clip.description && (
                <div>
                  <p className="text-xs font-semibold text-[#111] uppercase tracking-wide mb-1">Por que é viral</p>
                  <p className="text-sm text-[#666]">{clip.description}</p>
                </div>
              )}
            </div>
          </div>

          {/* Footer actions */}
          <div className="flex items-center gap-3 px-6 py-4 border-t border-[#eee] shrink-0">
            <button
              onClick={onReject}
              className="px-4 py-2 rounded-xl border border-[#e5e5e5] text-sm text-[#888] hover:border-red-300 hover:text-red-500 transition-colors"
            >
              Rejeitar
            </button>
            <div className="flex-1" />
            <button
              onClick={() => setExporting(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-[#e5e5e5] text-sm text-[#555] hover:border-[#aaa] transition-colors"
            >
              <Download size={14} /> Exportar
            </button>
            <button
              onClick={() => { onApprove(); onClose() }}
              className={cn(
                'flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-medium transition-colors',
                approved
                  ? 'bg-emerald-500 text-white hover:bg-emerald-600'
                  : 'bg-[#111] text-white hover:bg-[#222]'
              )}
            >
              <Check size={14} />
              {approved ? 'Aprovado' : 'Aprovar'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
