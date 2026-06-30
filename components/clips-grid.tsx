'use client'
import { useState } from 'react'
import { Check, X, Clock, Zap, Heart, TrendingUp, Star, Download, Play, Plus } from 'lucide-react'
import type { Clip, VideoProject } from '@/types'
import { cn, formatDuration, scoreColor, scoreBg } from '@/lib/utils'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { LayoutPicker } from './layout-picker'
import { ClipDetailModal } from './clip-detail-modal'

interface ClipsGridProps {
  projects: VideoProject[]
  onProjectClipsChange: (projectId: string, clips: Clip[]) => void
  onProceed: () => void
  onAddVideo: () => void
}

function ScoreBar({ value, icon: Icon }: { value: number; icon: any }) {
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

function ClipCard({ clip, videoFile, suggestedMusic, onApprove, onReject }: {
  clip: Clip
  videoFile: File
  suggestedMusic?: string
  onApprove: () => void
  onReject: () => void
}) {
  const [detailOpen, setDetailOpen] = useState(false)
  const [exporting, setExporting] = useState(false)
  const approved = clip.status === 'APPROVED'
  const rejected = clip.status === 'REJECTED'

  return (
    <>
      {detailOpen && (
        <ClipDetailModal
          clip={clip}
          videoFile={videoFile}
          suggestedMusic={suggestedMusic}
          onClose={() => setDetailOpen(false)}
          onApprove={onApprove}
          onReject={onReject}
        />
      )}
      {exporting && (
        <LayoutPicker clip={clip} videoFile={videoFile} suggestedMusic={suggestedMusic} onClose={() => setExporting(false)} />
      )}

      <div className={cn(
        'bg-white rounded-2xl border overflow-hidden transition-all duration-200',
        approved && 'border-emerald-300 ring-1 ring-emerald-200',
        rejected && 'border-[#eee] opacity-40',
        !approved && !rejected && 'border-[#e5e5e5] hover:border-[#ccc]',
        clip.isBest && !rejected && 'ring-2 ring-yellow-300 border-yellow-200'
      )}>
        <div className="relative bg-gradient-to-b from-[#1a1a1a] to-[#333] aspect-[9/16] max-h-48 overflow-hidden">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-white/20 text-7xl font-black">{clip.id.split('-').pop()}</div>
          </div>

          {/* Best badge */}
          {clip.isBest && (
            <div className="absolute top-2 left-2 bg-yellow-400 text-yellow-900 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
              ★ Melhor
            </div>
          )}

          <button onClick={() => setDetailOpen(true)} className="absolute inset-0 flex items-center justify-center group">
            <div className="w-12 h-12 rounded-full bg-black/50 group-hover:bg-black/70 flex items-center justify-center transition-colors">
              <Play size={20} className="text-white ml-1" />
            </div>
          </button>

          {!clip.isBest && (
            <div className="absolute top-2 left-2">
              <div className={cn('text-white text-xs font-bold px-2 py-1 rounded-lg',
                clip.totalScore >= 85 ? 'bg-emerald-500' : clip.totalScore >= 70 ? 'bg-yellow-500' : 'bg-red-500')}>
                {clip.totalScore}
              </div>
            </div>
          )}

          <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded-lg flex items-center gap-1">
            <Clock size={10} />{formatDuration(clip.duration)}
          </div>

          {approved && (
            <div className="absolute top-2 right-2">
              <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center">
                <Check size={12} className="text-white" />
              </div>
            </div>
          )}
        </div>

        <div className="p-4">
          <button onClick={() => setDetailOpen(true)} className="text-left w-full">
            <h3 className="font-semibold text-[#111] text-sm leading-snug mb-1 line-clamp-2 hover:underline">{clip.title}</h3>
            <p className="text-xs text-[#888] mb-3 line-clamp-2">{clip.description}</p>
            <div className="text-xs text-[#bbb] mb-3">{formatDuration(clip.startTime)} → {formatDuration(clip.endTime)}</div>

            <div className="space-y-1.5 mb-4">
              <ScoreBar value={clip.hookScore} icon={Zap} />
              <ScoreBar value={clip.emotionScore} icon={Heart} />
              <ScoreBar value={clip.narrativeScore} icon={TrendingUp} />
              <ScoreBar value={clip.energyScore} icon={Star} />
            </div>

            <div className="bg-[#fafafa] rounded-lg p-2 mb-4 text-xs text-[#666] italic line-clamp-2">
              "{clip.transcript}"
            </div>
          </button>

          <div className="flex gap-2">
            <Button variant={approved ? 'primary' : 'secondary'} size="sm" className="flex-1" onClick={onApprove}>
              <Check size={14} />{approved ? 'Aprovado' : 'Aprovar'}
            </Button>
            <button onClick={() => setExporting(true)} title="Exportar"
              className="w-8 h-8 rounded-lg hover:bg-blue-50 flex items-center justify-center text-[#ccc] hover:text-blue-500 transition-colors">
              <Download size={14} />
            </button>
            <button onClick={onReject}
              className="w-8 h-8 rounded-lg hover:bg-red-50 flex items-center justify-center text-[#ccc] hover:text-red-500 transition-colors">
              <X size={14} />
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

export function ClipsGrid({ projects, onProjectClipsChange, onProceed, onAddVideo }: ClipsGridProps) {
  const allClips = projects.flatMap((p) => p.clips)
  const approvedCount = allClips.filter((c) => c.status === 'APPROVED').length

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-[#111]">Shorts detectados</h2>
          <p className="text-sm text-[#888]">
            {allClips.length} clips de {projects.length} vídeo{projects.length > 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {approvedCount > 0 && (
            <Badge variant="success">{approvedCount} aprovado{approvedCount > 1 ? 's' : ''}</Badge>
          )}
          <Button variant="ghost" size="sm" onClick={onAddVideo}>
            <Plus size={14} /> Adicionar vídeo
          </Button>
          <Button size="sm" onClick={onProceed} disabled={approvedCount === 0}>
            Publicar {approvedCount > 0 ? `(${approvedCount})` : ''} →
          </Button>
        </div>
      </div>

      {/* Projects with dividers */}
      <div className="space-y-10">
        {projects.map((project) => (
          <div key={project.id}>
            {/* Project divider */}
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-1 h-px bg-[#e5e5e5]" />
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-[#111] max-w-xs truncate">{project.title}</span>
                {project.theme && (
                  <span className="text-[10px] bg-[#f0f0f0] text-[#666] px-2 py-0.5 rounded-full font-medium capitalize">
                    {project.theme.genre}
                  </span>
                )}
                {project.theme?.mood && (
                  <span className="text-[10px] text-[#999] hidden md:inline">{project.theme.mood}</span>
                )}
              </div>
              <div className="flex-1 h-px bg-[#e5e5e5]" />
            </div>

            {/* Approve all for this project */}
            <div className="flex justify-end mb-3">
              <button
                onClick={() => onProjectClipsChange(project.id, project.clips.map((c) => ({ ...c, status: 'APPROVED' as const })))}
                className="text-xs text-[#888] hover:text-[#111] transition-colors"
              >
                Aprovar todos deste vídeo
              </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {project.clips.map((clip) => (
                <ClipCard
                  key={clip.id}
                  clip={clip}
                  videoFile={project.videoFile}
                  suggestedMusic={project.theme?.music_suggestion}
                  onApprove={() => onProjectClipsChange(project.id, project.clips.map((c) => c.id === clip.id ? { ...c, status: 'APPROVED' as const } : c))}
                  onReject={() => onProjectClipsChange(project.id, project.clips.map((c) => c.id === clip.id ? { ...c, status: 'REJECTED' as const } : c))}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
