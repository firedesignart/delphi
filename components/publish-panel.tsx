'use client'
import { useState } from 'react'
import {
  PlayCircle,
  Calendar,
  Send,
  CheckCircle,
  Clock,
  Hash,
  FileText,
  Zap,
  ExternalLink,
} from 'lucide-react'
import type { Clip, ContentItem } from '@/types'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { cn, formatDuration } from '@/lib/utils'
import { scheduleToYouTube, publishNow } from '@/lib/mock-youtube'

interface PublishPanelProps {
  clips: Clip[]
}

interface PublishState {
  clipId: string
  status: 'idle' | 'publishing' | 'done' | 'error'
  youtubeUrl?: string
  scheduledAt?: string
}

function ClipPublishCard({
  clip,
  state,
  onPublishNow,
  onSchedule,
}: {
  clip: Clip
  state: PublishState
  onPublishNow: (clip: Clip, title: string, description: string, tags: string) => void
  onSchedule: (clip: Clip, title: string, description: string, tags: string, date: string) => void
}) {
  const [title, setTitle] = useState(clip.title)
  const [description, setDescription] = useState(
    `${clip.transcript}\n\n#shorts #youtube #conteudo`
  )
  const [tags, setTags] = useState('#shorts #youtube #viral #conteudo')
  const [scheduleDate, setScheduleDate] = useState('')
  const [showSchedule, setShowSchedule] = useState(false)

  if (state.status === 'done') {
    return (
      <div className="bg-white border border-emerald-200 rounded-2xl p-5">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
            <CheckCircle size={20} className="text-emerald-500" />
          </div>
          <div className="flex-1">
            <div className="font-medium text-[#111] mb-0.5">{clip.title}</div>
            <div className="text-sm text-emerald-600 mb-3">
              {state.scheduledAt ? `Agendado para ${state.scheduledAt}` : 'Publicado com sucesso'}
            </div>
            {state.youtubeUrl && (
              <a
                href={state.youtubeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-[#888] hover:text-[#111] transition-colors"
              >
                <ExternalLink size={12} />
                Ver no YouTube
              </a>
            )}
          </div>
          <Badge variant="success">
            <PlayCircle size={10} />
            {state.scheduledAt ? 'Agendado' : 'Publicado'}
          </Badge>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white border border-[#e5e5e5] rounded-2xl p-5">
      <div className="flex items-start gap-4 mb-5">
        {/* Clip preview */}
        <div className="w-12 h-20 bg-gradient-to-b from-[#1a1a1a] to-[#333] rounded-xl shrink-0 flex items-center justify-center text-white/20 font-black text-2xl">
          {clip.id.split('_')[1]}
        </div>
        <div className="flex-1">
          <div className="font-semibold text-[#111] mb-1">{clip.title}</div>
          <div className="flex items-center gap-2 text-xs text-[#888]">
            <Clock size={11} />
            {formatDuration(clip.duration)}
            <span className="text-[#ccc]">·</span>
            Score {clip.totalScore}
          </div>
        </div>
      </div>

      <div className="space-y-3 mb-5">
        {/* Title */}
        <div>
          <label className="text-xs font-medium text-[#555] mb-1 block">
            <FileText size={11} className="inline mr-1" />
            Título
          </label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full text-sm border border-[#e5e5e5] rounded-lg px-3 py-2 focus:outline-none focus:border-[#111] transition-colors"
          />
        </div>

        {/* Description */}
        <div>
          <label className="text-xs font-medium text-[#555] mb-1 block">
            <FileText size={11} className="inline mr-1" />
            Descrição
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full text-sm border border-[#e5e5e5] rounded-lg px-3 py-2 focus:outline-none focus:border-[#111] transition-colors resize-none"
          />
        </div>

        {/* Tags */}
        <div>
          <label className="text-xs font-medium text-[#555] mb-1 block">
            <Hash size={11} className="inline mr-1" />
            Hashtags
          </label>
          <input
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            className="w-full text-sm border border-[#e5e5e5] rounded-lg px-3 py-2 focus:outline-none focus:border-[#111] transition-colors"
          />
        </div>

        {/* Schedule date */}
        {showSchedule && (
          <div>
            <label className="text-xs font-medium text-[#555] mb-1 block">
              <Calendar size={11} className="inline mr-1" />
              Data e hora de publicação
            </label>
            <input
              type="datetime-local"
              value={scheduleDate}
              onChange={(e) => setScheduleDate(e.target.value)}
              className="w-full text-sm border border-[#e5e5e5] rounded-lg px-3 py-2 focus:outline-none focus:border-[#111] transition-colors"
            />
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <Button
          size="sm"
          className="flex-1"
          disabled={state.status === 'publishing'}
          onClick={() => onPublishNow(clip, title, description, tags)}
        >
          <Send size={14} />
          {state.status === 'publishing' ? 'Publicando...' : 'Publicar agora'}
        </Button>
        {!showSchedule ? (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowSchedule(true)}
          >
            <Calendar size={14} />
            Agendar
          </Button>
        ) : (
          <Button
            variant="secondary"
            size="sm"
            disabled={!scheduleDate || state.status === 'publishing'}
            onClick={() => onSchedule(clip, title, description, tags, scheduleDate)}
          >
            <Calendar size={14} />
            Confirmar
          </Button>
        )}
      </div>
    </div>
  )
}

export function PublishPanel({ clips }: PublishPanelProps) {
  const approvedClips = clips.filter((c) => c.status === 'APPROVED')
  const [states, setStates] = useState<Record<string, PublishState>>(
    Object.fromEntries(approvedClips.map((c) => [c.id, { clipId: c.id, status: 'idle' }]))
  )

  function setClipState(clipId: string, update: Partial<PublishState>) {
    setStates((prev) => ({ ...prev, [clipId]: { ...prev[clipId], ...update } }))
  }

  async function handlePublishNow(clip: Clip, title: string, desc: string, tags: string) {
    setClipState(clip.id, { status: 'publishing' })
    try {
      const result = await publishNow({ title, description: desc, hashtags: tags.split(' ') })
      setClipState(clip.id, { status: 'done', youtubeUrl: result.url })
    } catch {
      setClipState(clip.id, { status: 'error' })
    }
  }

  async function handleSchedule(
    clip: Clip,
    title: string,
    desc: string,
    tags: string,
    dateStr: string
  ) {
    setClipState(clip.id, { status: 'publishing' })
    try {
      const date = new Date(dateStr)
      const result = await scheduleToYouTube({ title, description: desc, hashtags: tags.split(' ') }, date)
      setClipState(clip.id, {
        status: 'done',
        youtubeUrl: result.url,
        scheduledAt: date.toLocaleString('pt-BR'),
      })
    } catch {
      setClipState(clip.id, { status: 'error' })
    }
  }

  const doneCount = Object.values(states).filter((s) => s.status === 'done').length

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-[#111]">Publicar no YouTube</h2>
          <p className="text-sm text-[#888]">
            {approvedClips.length} short{approvedClips.length > 1 ? 's' : ''} aprovado{approvedClips.length > 1 ? 's' : ''} pronto{approvedClips.length > 1 ? 's' : ''} para publicar
          </p>
        </div>
        {doneCount > 0 && (
          <Badge variant="success">
            <CheckCircle size={11} />
            {doneCount} publicado{doneCount > 1 ? 's' : ''}
          </Badge>
        )}
      </div>

      {/* YouTube connection notice */}
      <div className="bg-[#fafafa] border border-[#e5e5e5] rounded-xl p-4 mb-6 flex items-start gap-3">
        <PlayCircle size={18} className="text-red-500 shrink-0 mt-0.5" />
        <div>
          <div className="text-sm font-medium text-[#111] mb-0.5">YouTube API não configurada</div>
          <div className="text-xs text-[#888]">
            Adicione <code className="bg-[#eee] px-1 py-0.5 rounded text-[#555]">YOUTUBE_CLIENT_ID</code> e{' '}
            <code className="bg-[#eee] px-1 py-0.5 rounded text-[#555]">YOUTUBE_CLIENT_SECRET</code> no{' '}
            <code className="bg-[#eee] px-1 py-0.5 rounded text-[#555]">.env.local</code> para ativar publicação real.
            Por enquanto, a publicação é simulada.
          </div>
        </div>
      </div>

      {/* Clips */}
      <div className="space-y-4">
        {approvedClips.map((clip) => (
          <ClipPublishCard
            key={clip.id}
            clip={clip}
            state={states[clip.id]}
            onPublishNow={handlePublishNow}
            onSchedule={handleSchedule}
          />
        ))}
      </div>
    </div>
  )
}
