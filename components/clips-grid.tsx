'use client'
import { useState } from 'react'
import { Check, X, Clock, Zap, Heart, TrendingUp, Star, Download, Play, Plus, ScanFace, Sparkle, Rows3, Square } from 'lucide-react'
import type { Clip, VideoProject } from '@/types'
import { cn, formatDuration, scoreColor, scoreBg } from '@/lib/utils'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { LayoutPicker, type VideoLayout, type AspectRatio } from './layout-picker'
import { ClipDetailModal } from './clip-detail-modal'

const FORMAT_LAYOUTS: { id: VideoLayout; label: string; icon: any; localOk: boolean }[] = [
  { id: 'auto', label: 'Seguir Rosto', icon: ScanFace, localOk: false },
  { id: 'react', label: 'React', icon: Sparkle, localOk: false },
  { id: 'fill', label: 'Preenchido', icon: Square, localOk: true },
  { id: 'letterbox', label: 'Com Barras', icon: Square, localOk: true },
  { id: 'split', label: 'Split Screen', icon: Rows3, localOk: true },
]

const FORMAT_RATIOS: { id: AspectRatio; label: string }[] = [
  { id: '9:16', label: '9:16' },
  { id: '1:1', label: '1:1' },
  { id: '4:5', label: '4:5' },
  { id: '16:9', label: '16:9' },
]

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

function ClipCard({ clip, videoFile, localFilename, suggestedMusic, defaultLayout, defaultAspectRatio, onApprove, onReject }: {
  clip: Clip
  videoFile: File | null
  localFilename?: string
  suggestedMusic?: string
  defaultLayout: VideoLayout
  defaultAspectRatio: AspectRatio
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
          localFilename={localFilename}
          suggestedMusic={suggestedMusic}
          onClose={() => setDetailOpen(false)}
          onApprove={onApprove}
          onReject={onReject}
        />
      )}
      {exporting && (
        <LayoutPicker
          clip={clip}
          videoFile={videoFile}
          localFilename={localFilename}
          suggestedMusic={suggestedMusic}
          initialLayout={defaultLayout}
          initialAspectRatio={defaultAspectRatio}
          onClose={() => setExporting(false)}
        />
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

  const [formatByProject, setFormatByProject] = useState<Record<string, { layout: VideoLayout; ratio: AspectRatio }>>({})

  function getFormat(project: VideoProject): { layout: VideoLayout; ratio: AspectRatio } {
    return formatByProject[project.id] ?? {
      layout: project.localFilename ? 'fill' : 'auto',
      ratio: '9:16',
    }
  }

  function setFormat(projectId: string, patch: Partial<{ layout: VideoLayout; ratio: AspectRatio }>) {
    setFormatByProject((prev) => ({
      ...prev,
      [projectId]: { ...getFormatFor(prev, projectId), ...patch },
    }))
  }

  function getFormatFor(map: Record<string, { layout: VideoLayout; ratio: AspectRatio }>, projectId: string) {
    return map[projectId] ?? { layout: 'auto' as VideoLayout, ratio: '9:16' as AspectRatio }
  }

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

            {/* Format bar — define o formato antes de exportar qualquer clip deste vídeo */}
            <div className="bg-[#fafafa] border border-[#eee] rounded-xl p-3 mb-4 flex flex-wrap items-center gap-3">
              <span className="text-xs font-medium text-[#888] shrink-0">Formato padrão:</span>
              <div className="flex gap-1 flex-wrap">
                {FORMAT_RATIOS.map((r) => (
                  <button key={r.id} onClick={() => setFormat(project.id, { ratio: r.id })}
                    className={cn('px-2.5 py-1 rounded-lg text-xs font-medium transition-colors',
                      getFormat(project).ratio === r.id ? 'bg-[#111] text-white' : 'bg-white border border-[#e5e5e5] text-[#666] hover:border-[#ccc]')}>
                    {r.label}
                  </button>
                ))}
              </div>
              <div className="w-px h-5 bg-[#e5e5e5] hidden sm:block" />
              <div className="flex gap-1 flex-wrap">
                {FORMAT_LAYOUTS.filter((l) => !project.localFilename || l.localOk).map((l) => {
                  const Icon = l.icon
                  const active = getFormat(project).layout === l.id
                  return (
                    <button key={l.id} onClick={() => setFormat(project.id, { layout: l.id })}
                      className={cn('flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors',
                        active ? 'bg-[#111] text-white' : 'bg-white border border-[#e5e5e5] text-[#666] hover:border-[#ccc]')}>
                      <Icon size={11} />
                      {l.label}
                    </button>
                  )
                })}
              </div>
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
                  localFilename={project.localFilename}
                  suggestedMusic={project.theme?.music_suggestion}
                  defaultLayout={getFormat(project).layout}
                  defaultAspectRatio={getFormat(project).ratio}
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
