import { NextRequest, NextResponse } from 'next/server'
import Groq from 'groq-sdk'
import { Clip } from '@/types'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const fullText: string | undefined = body.transcript
  const segmentMap: { start: number; end: number; text: string }[] = body.segments ?? []

  if (!fullText) return NextResponse.json({ error: 'No transcript provided' }, { status: 400 })

  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'GROQ_API_KEY not configured' }, { status: 503 })

  const groq = new Groq({ apiKey })

  // Transcrições muito longas (vídeos longos) podem estourar o limite de contexto do modelo —
  // trunca preservando o suficiente para detectar bons momentos sem falhar a chamada
  const MAX_CHARS = 12000
  const truncatedText = fullText.length > MAX_CHARS ? fullText.slice(0, MAX_CHARS) + '…' : fullText
  const truncatedSegments = segmentMap.filter((s) => s.start * (MAX_CHARS / Math.max(1, fullText.length)) < MAX_CHARS).slice(0, 200)

  // Detectar clips + tema com LLaMA
  const prompt = `Você é um especialista em YouTube Shorts virais. Analise a transcrição abaixo e retorne um JSON com dois campos: "theme" e "clips".

TRANSCRIÇÃO:
${truncatedText}

SEGMENTOS:
${JSON.stringify(truncatedSegments, null, 2)}

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

  let raw = ''
  try {
    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      response_format: { type: 'json_object' },
    })

    raw = completion.choices[0].message.content ?? '{}'
    const parsed = JSON.parse(raw.replace(/```json?/g, '').replace(/```/g, '').trim())

    theme = parsed.theme ?? theme

    clips = (parsed.clips ?? [])
      .filter((c: any) => c.start_time != null && c.end_time != null && c.title)
      .map((c: any, i: number) => ({
        id: `clip-${Date.now()}-${i}`,
        mediaAssetId: '',
        title: c.title,
        description: c.description ?? '',
        startTime: c.start_time,
        endTime: c.end_time,
        duration: c.end_time - c.start_time,
        hookScore: c.hook_score ?? 70,
        emotionScore: c.emotion_score ?? 70,
        narrativeScore: c.narrative_score ?? 70,
        energyScore: c.energy_score ?? 70,
        totalScore: Math.round(((c.hook_score ?? 70) + (c.emotion_score ?? 70) + (c.narrative_score ?? 70) + (c.energy_score ?? 70)) / 4),
        transcript: c.transcript ?? '',
        status: 'PENDING' as const,
        isBest: c.is_best === true,
        thumbnailUrl: null,
        createdAt: new Date().toISOString(),
      }))

    if (clips.length === 0) {
      console.error('LLaMA returned zero valid clips. Raw response:', raw)
      return NextResponse.json({ error: 'A IA não retornou clips válidos para este vídeo' }, { status: 500 })
    }
  } catch (err: any) {
    console.error('LLaMA error:', err?.message ?? err, 'Raw response was:', raw)
    return NextResponse.json({ error: `Falha ao processar resposta da IA: ${err?.message ?? 'erro desconhecido'}` }, { status: 500 })
  }

  return NextResponse.json({ clips, transcript: fullText, theme })
}
