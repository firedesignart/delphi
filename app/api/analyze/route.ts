import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { Clip } from '@/types'

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const file = formData.get('video') as File | null

  if (!file) {
    return NextResponse.json({ error: 'No video file provided' }, { status: 400 })
  }

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey || apiKey === 'your_openai_key_here') {
    return NextResponse.json({ error: 'OPENAI_API_KEY not configured' }, { status: 503 })
  }

  const openai = new OpenAI({ apiKey })

  // 1. Transcribe with Whisper
  let transcription: OpenAI.Audio.Transcription
  try {
    transcription = await openai.audio.transcriptions.create({
      file,
      model: 'whisper-1',
      response_format: 'verbose_json',
      timestamp_granularities: ['segment'],
    })
  } catch (err) {
    console.error('Whisper error:', err)
    return NextResponse.json({ error: 'Transcription failed' }, { status: 500 })
  }

  const fullText = transcription.text
  const segments = (transcription as any).segments ?? []

  // Build segment map for clip extraction
  const segmentMap = segments.map((s: any) => ({
    start: s.start,
    end: s.end,
    text: s.text,
  }))

  // 2. Detect viral clips with GPT-4o
  const prompt = `Você é um especialista em YouTube Shorts virais. Analisando a transcrição abaixo, identifique de 3 a 6 momentos que têm alto potencial viral para Shorts de 15 a 60 segundos.

TRANSCRIÇÃO COMPLETA:
${fullText}

SEGMENTOS COM TIMESTAMPS:
${JSON.stringify(segmentMap, null, 2)}

Para cada clip, retorne um JSON array com este formato exato:
[
  {
    "title": "título chamativo em português",
    "description": "descrição curta do conteúdo",
    "start_time": 12.5,
    "end_time": 45.2,
    "transcript": "trecho da transcrição desse momento",
    "hook_score": 85,
    "emotion_score": 72,
    "narrative_score": 68,
    "energy_score": 90,
    "reason": "por que esse momento é viral"
  }
]

Regras:
- start_time e end_time devem ser números em segundos
- Cada clip deve ter entre 15 e 60 segundos
- hook_score, emotion_score, narrative_score, energy_score: números de 0 a 100
- Prefira momentos com gancho forte, emoção, ou informação surpreendente
- Retorne APENAS o JSON array, sem markdown, sem explicação`

  let clips: Clip[] = []

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
    })

    const raw = completion.choices[0].message.content ?? '[]'
    const parsed = JSON.parse(raw.replace(/```json?/g, '').replace(/```/g, '').trim())

    clips = parsed.map((c: any, i: number) => ({
      id: `clip-${Date.now()}-${i}`,
      mediaAssetId: '',
      title: c.title,
      description: c.description ?? '',
      startTime: c.start_time,
      endTime: c.end_time,
      duration: c.end_time - c.start_time,
      hookScore: c.hook_score,
      emotionScore: c.emotion_score,
      narrativeScore: c.narrative_score,
      energyScore: c.energy_score,
      totalScore: Math.round((c.hook_score + c.emotion_score + c.narrative_score + c.energy_score) / 4),
      transcript: c.transcript,
      status: 'PENDING' as const,
      thumbnailUrl: null,
      createdAt: new Date().toISOString(),
    }))
  } catch (err) {
    console.error('GPT-4o error:', err)
    return NextResponse.json({ error: 'Clip detection failed' }, { status: 500 })
  }

  return NextResponse.json({ clips, transcript: fullText })
}

export const config = {
  api: { bodyParser: false },
}
