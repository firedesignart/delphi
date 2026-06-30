'use client'
import { useEffect, useState } from 'react'
import { Loader2, Sparkles, CheckCircle, AlertTriangle } from 'lucide-react'
import type { AnalysisProgress, Clip, VideoTheme } from '@/types'
import { analyzeVideo } from '@/lib/mock-ai'
import { cn } from '@/lib/utils'

interface AnalysisViewProps {
  file: File | null
  localFilename?: string
  onComplete: (clips: Clip[], theme?: VideoTheme) => void
}

const stageLabels: Record<string, string> = {
  extracting: 'Extraindo áudio',
  transcribing: 'Transcrevendo com Whisper',
  analyzing: 'IA analisando momentos',
  scoring: 'Calculando scores',
  done: 'Análise concluída',
}

export function AnalysisView({ file, localFilename, onComplete }: AnalysisViewProps) {
  const [progress, setProgress] = useState<AnalysisProgress>({
    stage: 'extracting',
    percent: 0,
    message: 'Iniciando análise...',
  })
  const [done, setDone] = useState(false)
  const [mockWarning, setMockWarning] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function run() {
      for await (const result of analyzeVideo(file, (p) => {
        if (!cancelled) setProgress(p)
      }, localFilename)) {
        if (!cancelled) {
          setDone(true)
          if (result.isMock) {
            setMockWarning(result.errorReason ?? 'Não foi possível analisar o vídeo real.')
          }
          setTimeout(() => onComplete(result.clips, result.theme), result.isMock ? 2500 : 600)
        }
      }
    }

    run()
    return () => { cancelled = true }
  }, [file, localFilename, onComplete])

  const stages = ['extracting', 'transcribing', 'analyzing', 'scoring', 'done']
  const currentIdx = stages.indexOf(progress.stage)

  return (
    <div className="flex flex-col items-center justify-center py-16 px-8">
      {/* Icon */}
      <div className={cn(
        'w-20 h-20 rounded-2xl flex items-center justify-center mb-6 transition-all duration-300',
        done ? 'bg-emerald-50' : 'bg-[#f0f0f0]'
      )}>
        {done
          ? <CheckCircle size={36} className="text-emerald-500" />
          : <Sparkles size={36} className="text-[#555] animate-pulse" />
        }
      </div>

      <h2 className="text-2xl font-bold text-[#111] mb-2">
        {done ? 'Análise concluída!' : 'Analisando seu vídeo'}
      </h2>
      <p className="text-[#888] mb-10 text-center max-w-sm">
        {done
          ? 'A IA encontrou os melhores momentos do seu vídeo'
          : progress.message
        }
      </p>

      {/* Progress bar */}
      <div className="w-full max-w-md mb-8">
        <div className="flex justify-between text-xs text-[#888] mb-2">
          <span>{progress.message}</span>
          <span>{progress.percent}%</span>
        </div>
        <div className="h-2 bg-[#eee] rounded-full overflow-hidden">
          <div
            className="h-full bg-[#111] rounded-full transition-all duration-500 ease-out"
            style={{ width: `${progress.percent}%` }}
          />
        </div>
      </div>

      {/* Stage indicators */}
      <div className="flex gap-2 flex-wrap justify-center">
        {stages.map((stage, idx) => (
          <div
            key={stage}
            className={cn(
              'flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full transition-all',
              idx < currentIdx
                ? 'bg-emerald-50 text-emerald-700'
                : idx === currentIdx
                ? 'bg-[#111] text-white'
                : 'bg-[#f0f0f0] text-[#aaa]'
            )}
          >
            {idx < currentIdx ? (
              <CheckCircle size={11} />
            ) : idx === currentIdx ? (
              <Loader2 size={11} className="animate-spin" />
            ) : null}
            {stageLabels[stage]}
          </div>
        ))}
      </div>

      {/* Mock fallback warning */}
      {mockWarning && (
        <div className="mt-8 max-w-md w-full bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-start gap-3">
          <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-900">Análise real falhou — usando clips de demonstração</p>
            <p className="text-xs text-amber-700 mt-1">{mockWarning}</p>
          </div>
        </div>
      )}
    </div>
  )
}
