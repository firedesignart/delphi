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

  // Quanto maior o vídeo, mais clips faz sentido extrair
  const totalDuration = segmentMap.length > 0 ? segmentMap[segmentMap.length - 1].end : 180
  const targetClipCount = Math.max(3, Math.min(15, Math.round(totalDuration / 90)))

  // Detectar clips + tema com LLaMA
  const prompt = `Você é um especialista em YouTube Shorts virais. Analise a transcrição abaixo e retorne um JSON com dois campos: "theme" e "clips".

DURAÇÃO TOTAL DO VÍDEO: ${Math.round(totalDuration)} segundos (~${Math.round(totalDuration / 60)} minutos)
NÚMERO IDEAL DE CLIPS PARA ESTE VÍDEO: ${targetClipCount}

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
- Gere aproximadamente ${targetClipCount} clips (varie conforme a quantidade de bons momentos reais disponíveis, mas use esse número como alvo)
- CRÍTICO: cada clip DEVE ter duração (end_time - start_time) entre 59 e 90 segundos. NUNCA gere clips com menos de 59 segundos. Se o melhor momento for curto, EXPANDA o intervalo incluindo o contexto antes e/ou depois (frases adjacentes) até atingir pelo menos 59 segundos — um clip curto é INACEITÁVEL e inútil para Shorts.
- Marque is_best: true no clip de maior potencial viral (apenas 1)
- scores de 0 a 100
- Prefira momentos com gancho forte, emoção ou informação surpreendente
- IMPORTANTE: "transcript" deve ser uma cópia LITERAL e EXATA do trecho dos SEGMENTOS fornecidos acima, correspondente ao intervalo [start_time, end_time] completo (não apenas a frase do gancho). NUNCA invente, parafraseie ou resuma — copie o texto real que a pessoa fala em todo o trecho.
- "title" deve refletir o que é REALMENTE dito no trecho, não um título genérico de clickbait desconectado do conteúdo
- start_time e end_time devem corresponder exatamente aos timestamps dos segmentos onde esse conteúdo aparece`

  const MIN_DURATION = 59
  const MAX_DURATION = 90
  const maxAvailableEnd = segmentMap.length > 0 ? segmentMap[segmentMap.length - 1].end : Infinity

  function clampDuration(start: number, end: number): { start: number; end: number } {
    let s = Math.max(0, start)
    let e = end

    if (e - s > MAX_DURATION) {
      e = s + MAX_DURATION
    }

    if (e - s < MIN_DURATION) {
      const needed = MIN_DURATION - (e - s)
      e = Math.min(maxAvailableEnd, e + needed)
      if (e - s < MIN_DURATION) {
        s = Math.max(0, s - (MIN_DURATION - (e - s)))
      }
    }

    return { start: s, end: e }
  }

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
      .map((c: any, i: number) => {
        const { start, end } = clampDuration(c.start_time, c.end_time)
        // Se o clip foi expandido além do trecho original, complementa a transcrição com os segmentos do novo intervalo
        const transcript = (end - start) > (c.end_time - c.start_time) + 1
          ? segmentMap.filter((s) => s.start >= start && s.end <= end).map((s) => s.text).join(' ').trim() || c.transcript
          : c.transcript

        return {
          id: `clip-${Date.now()}-${i}`,
          mediaAssetId: '',
          title: c.title,
          description: c.description ?? '',
          startTime: start,
          endTime: end,
          duration: end - start,
          hookScore: c.hook_score ?? 70,
          emotionScore: c.emotion_score ?? 70,
          narrativeScore: c.narrative_score ?? 70,
          energyScore: c.energy_score ?? 70,
          totalScore: Math.round(((c.hook_score ?? 70) + (c.emotion_score ?? 70) + (c.narrative_score ?? 70) + (c.energy_score ?? 70)) / 4),
          transcript: transcript ?? '',
          status: 'PENDING' as const,
          isBest: c.is_best === true,
          thumbnailUrl: null,
          createdAt: new Date().toISOString(),
        }
      })

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
