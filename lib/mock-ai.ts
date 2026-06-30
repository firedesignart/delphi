import type { Clip, AnalysisProgress, VideoTheme } from '@/types'
import { extractAudio } from './ffmpeg'
import { transcribeAudio } from './groq-client'
import { extractAudioLocal } from './local-helper'

export type AnalysisResult = { clips: Clip[]; theme: VideoTheme; isMock?: boolean; errorReason?: string }

export async function* analyzeVideo(
  videoFile: File | null,
  onProgress: (p: AnalysisProgress) => void,
  localFilename?: string
): AsyncGenerator<AnalysisResult> {
  onProgress({ stage: 'extracting', percent: 5, message: 'Extraindo áudio do vídeo...' })

  let audioBlob: Blob | null = null
  let errorReason: string | undefined

  try {
    if (localFilename) {
      // Vídeo grande processado pelo Agente Local — FFmpeg nativo, sem limite de memória
      audioBlob = await extractAudioLocal(localFilename)
      onProgress({ stage: 'extracting', percent: 25, message: 'Extraindo áudio do vídeo...' })
    } else if (videoFile) {
      audioBlob = await extractAudio(videoFile, (p) => {
        onProgress({ stage: 'extracting', percent: 5 + Math.round(p * 0.2), message: 'Extraindo áudio do vídeo...' })
      })
    }
  } catch (err: any) {
    console.error('Audio extraction failed:', err)
    errorReason = `Falha ao extrair áudio: ${err?.message ?? 'erro desconhecido'}`
  }

  onProgress({ stage: 'transcribing', percent: 30, message: 'Transcrevendo com Whisper...' })

  if (audioBlob) {
    try {
      // Transcrição roda direto no navegador → Groq (evita limite de upload da Vercel)
      const { text, segments } = await transcribeAudio(audioBlob)

      onProgress({ stage: 'analyzing', percent: 60, message: 'IA detectando melhores momentos...' })

      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript: text, segments }),
      })

      if (res.ok) {
        onProgress({ stage: 'scoring', percent: 85, message: 'Calculando scores de retenção...' })
        await delay(300)
        onProgress({ stage: 'done', percent: 100, message: 'Análise concluída!' })
        const { clips, theme } = await res.json()
        yield { clips: clips as Clip[], theme: theme ?? mockTheme() }
        return
      } else {
        const errBody = await res.json().catch(() => ({}))
        console.error('Analyze API error:', res.status, errBody)
        errorReason = `Falha na análise (${res.status}): ${errBody?.error ?? 'erro desconhecido'}`
      }
    } catch (err: any) {
      console.error('Transcription/analyze failed:', err)
      errorReason = err?.message ?? 'erro desconhecido na transcrição'
    }
  }

  // Fallback: mock (quando a transcrição ou análise falha)
  onProgress({ stage: 'analyzing', percent: 55, message: 'IA detectando melhores momentos...' })
  await delay(800)
  onProgress({ stage: 'scoring', percent: 80, message: 'Calculando scores de retenção...' })
  await delay(800)
  onProgress({ stage: 'done', percent: 100, message: 'Análise concluída! (modo demonstração)' })

  yield { clips: generateMockClips(videoFile?.name ?? localFilename ?? 'video'), theme: mockTheme(), isMock: true, errorReason }
}

function mockTheme(): VideoTheme {
  return { genre: 'educativo', mood: 'informativo e envolvente', music_suggestion: 'lofi' }
}

function generateMockClips(filename: string): Clip[] {
  const mockClips = [
    {
      title: 'O maior erro que criadores cometem',
      description: 'Trecho com alta retenção — hook poderoso + revelação surpreendente',
      startTime: 12.4,
      endTime: 68.2,
      hookScore: 94,
      emotionScore: 88,
      narrativeScore: 91,
      energyScore: 85,
      transcript:
        'Existe um erro que 90% dos criadores cometem e que destrói completamente o alcance do canal...',
    },
    {
      title: 'A estratégia que ninguém fala',
      description: 'Curiosity gap forte + pico de energia na fala',
      startTime: 124.0,
      endTime: 179.5,
      hookScore: 89,
      emotionScore: 82,
      narrativeScore: 87,
      energyScore: 90,
      transcript:
        'Ninguém fala sobre isso, mas existe uma estratégia que os maiores canais usam silenciosamente...',
    },
    {
      title: '3 ferramentas que mudaram tudo',
      description: 'Listicle com ritmo alto e CTA claro',
      startTime: 198.3,
      endTime: 248.7,
      hookScore: 81,
      emotionScore: 76,
      narrativeScore: 84,
      energyScore: 88,
      transcript:
        'Essas 3 ferramentas transformaram completamente minha produção de conteúdo...',
    },
    {
      title: 'Revelação: os números reais',
      description: 'Dados concretos + surpresa — alta probabilidade de compartilhamento',
      startTime: 267.1,
      endTime: 312.9,
      hookScore: 86,
      emotionScore: 91,
      narrativeScore: 79,
      energyScore: 83,
      transcript:
        'Vou mostrar os números reais do meu canal e o que realmente funcionou...',
    },
  ]

  const clips = mockClips.map((c, i) => {
    const total = Math.round((c.hookScore + c.emotionScore + c.narrativeScore + c.energyScore) / 4)
    return {
      id: `clip_${i + 1}`,
      mediaAssetId: 'asset_mock',
      title: c.title,
      description: c.description,
      startTime: c.startTime,
      endTime: c.endTime,
      duration: c.endTime - c.startTime,
      hookScore: c.hookScore,
      emotionScore: c.emotionScore,
      narrativeScore: c.narrativeScore,
      energyScore: c.energyScore,
      totalScore: total,
      transcript: c.transcript,
      status: 'PENDING' as const,
      isBest: false,
      createdAt: new Date().toISOString(),
    }
  })
  const best = clips.reduce((a, b) => (a.totalScore > b.totalScore ? a : b))
  best.isBest = true
  return clips
}

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}
