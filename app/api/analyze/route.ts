import { NextRequest, NextResponse } from 'next/server'
import Groq from 'groq-sdk'
import { Clip } from '@/types'

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const file = (formData.get('audio') ?? formData.get('video')) as File | null

  if (!file) return NextResponse.json({ error: 'No audio file provided' }, { status: 400 })

  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'GROQ_API_KEY not configured' }, { status: 503 })

  const groq = new Groq({ apiKey })

  // 1. Transcrever com Whisper
  let transcription: Groq.Audio.Transcription
  try {
    transcription = await groq.audio.transcriptions.create({
      file,
      model: 'whisper-large-v3',
      response_format: 'verbose_json',
      timestamp_granularities: ['segment'],
    })
  } catch (err) {
    console.error('Whisper error:', err)
    return NextResponse.json({ error: 'Transcription failed' }, { status: 500 })
  }

  const fullText = transcription.text
  const segments = (transcription as any).segments ?? []
  const segmentMap = segments.map((s: any) => ({ start: s.start, end: s.end, text: s.text }))

  // 2. Detectar clips + tema com LLaMA
  const prompt = `Você é um especialista em YouTube Shorts virais. Analise a transcrição abaixo e retorne um JSON com dois campos: "theme" e "clips".

TRANSCRIÇÃO:
${fullText}

SEGMENTOS:
${JSON.stringify(segmentMap, null, 2)}

Retorne APENAS este JSON (sem markdown):
{
  "theme": {
    "genre": "um de: motivacional | drama | terror | humor | educativo | lifestyle | esporte | tecnologia | musica | entrevista",
    "mood": "descrição curta do tom do vídeo em português (ex: 'intenso e emocionante')",
    "music_suggestion": "gênero musical sugerido para trilha: epic | lofi | tense | upbeat | cinematic | none"
  },
  "clips": [
    {
      "title": "título chamativo em português",
      "description": "descrição curta",
      "start_time": 12.5,
      "end_time": 45.2,
      "transcript": "trecho da transcrição",
      "hook_score": 85,
      "emotion_score": 72,
      "narrative_score": 68,
      "energy_score": 90,
      "is_best": false
    }
  ]
}

Regras para clips:
- 3 a 6 clips, cada um com 15 a 60 segundos
- Marque is_best: true no clip de maior potencial viral (apenas 1)
- scores de 0 a 100
- Prefira momentos com gancho forte, emoção ou informação surpreendente
- IMPORTANTE: "transcript" deve ser uma cópia LITERAL e EXATA de um trecho dos SEGMENTOS fornecidos acima, correspondente ao intervalo [start_time, end_time]. NUNCA invente, parafraseie ou resuma — copie o texto real que a pessoa fala nesse trecho.
- "title" deve refletir o que é REALMENTE dito no trecho, não um título genérico de clickbait desconectado do conteúdo
- start_time e end_time devem corresponder exatamente aos timestamps dos segmentos onde esse conteúdo aparece`

  let clips: Clip[] = []
  let theme = { genre: 'educativo', mood: '', music_suggestion: 'none' }

  try {
    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
    })

    const raw = completion.choices[0].message.content ?? '{}'
    const parsed = JSON.parse(raw.replace(/```json?/g, '').replace(/```/g, '').trim())

    theme = parsed.theme ?? theme

    clips = (parsed.clips ?? []).map((c: any, i: number) => ({
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
      isBest: c.is_best === true,
      thumbnailUrl: null,
      createdAt: new Date().toISOString(),
    }))
  } catch (err) {
    console.error('LLaMA error:', err)
    return NextResponse.json({ error: 'Clip detection failed' }, { status: 500 })
  }

  return NextResponse.json({ clips, transcript: fullText, theme })
}
