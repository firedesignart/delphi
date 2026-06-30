import { NextRequest, NextResponse } from 'next/server'
import Groq from 'groq-sdk'
import { Clip } from '@/types'

const GENRE_CRITERIA: Record<string, string> = {
  humor: 'Procure PIADAS COM PUNCHLINE CLARO, virada cômica, ironia, deboche, reação engraçada de alguém. O corte deve incluir a configuração da piada (setup) E o desfecho (punchline) — nunca corte antes do final da piada. Se não houver um momento genuinamente engraçado e completo, não force.',
  terror: 'Procure momentos de TENSÃO CRESCENTE, revelação assustadora, descrição de algo perturbador, sustos, ou construção de suspense que termine em um clímax. O corte precisa ter início (contexto/tensão), meio (escalada) e fim (revelação/choque) — nunca corte no meio da escalada.',
  drama: 'Procure momentos de CONFLITO EMOCIONAL, confissão, virada de história, vulnerabilidade genuína. O trecho deve ter arco completo: contexto → tensão → desfecho emocional.',
  motivacional: 'Procure VIRADAS DE MINDSET, frase de impacto, conquista contra adversidade, conselho prático e acionável. O clip deve terminar em uma frase que "bate" — não cortar antes do clímax motivacional.',
  educativo: 'Procure FATOS SURPREENDENTES que contrariam o senso comum, explicações que mudam a forma de ver algo, ou informação prática e nova. O trecho deve apresentar o fato E a explicação/contexto completo.',
  entrevista: 'Procure RESPOSTAS POLÊMICAS, momentos de vulnerabilidade, revelações pessoais, ou debates acalorados entre os participantes. Inclua a pergunta/contexto E a resposta completa.',
  esporte: 'Procure LANCES DECISIVOS, reações de torcida/comentaristas, momentos de virada no jogo, ou declarações fortes de atletas.',
  tecnologia: 'Procure DEMONSTRAÇÕES SURPREENDENTES, comparações que revelam algo inesperado, ou previsões/opiniões fortes sobre tecnologia.',
  lifestyle: 'Procure DICAS PRÁTICAS COM RESULTADO VISÍVEL, transformações, ou momentos relacionáveis do dia a dia que gerem identificação.',
  musica: 'Procure os TRECHOS MAIS MARCANTES musicalmente — refrão, drop, virada instrumental, ou momento de maior energia vocal.',
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const fullText: string | undefined = body.transcript
  const segmentMap: { start: number; end: number; text: string }[] = body.segments ?? []

  if (!fullText) return NextResponse.json({ error: 'No transcript provided' }, { status: 400 })

  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'GROQ_API_KEY not configured' }, { status: 503 })

  const groq = new Groq({ apiKey })

  const MAX_CHARS = 12000
  const truncatedText = fullText.length > MAX_CHARS ? fullText.slice(0, MAX_CHARS) + '…' : fullText
  const truncatedSegments = segmentMap.filter((s) => s.start * (MAX_CHARS / Math.max(1, fullText.length)) < MAX_CHARS).slice(0, 200)

  const totalDuration = segmentMap.length > 0 ? segmentMap[segmentMap.length - 1].end : 180
  const targetClipCount = Math.max(3, Math.min(15, Math.round(totalDuration / 90)))

  let raw = ''
  let theme = { genre: 'educativo', mood: '', music_suggestion: 'none' }
  let clips: Clip[] = []

  try {
    // ETAPA 1 — Classifica o gênero/tema antes de procurar os cortes, para aplicar
    // critérios de viralidade específicos (uma piada e um susto são "virais" de formas diferentes)
    const themeCompletion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [{
        role: 'user',
        content: `Classifique o gênero/tema deste vídeo com base na transcrição. Retorne APENAS um JSON:
{
  "genre": "um de: motivacional | drama | terror | humor | educativo | lifestyle | esporte | tecnologia | musica | entrevista",
  "mood": "descrição curta do tom em português",
  "music_suggestion": "epic | lofi | tense | upbeat | cinematic | none"
}

TRANSCRIÇÃO:
${truncatedText.slice(0, 4000)}`,
      }],
      temperature: 0.2,
      response_format: { type: 'json_object' },
    })

    const themeRaw = themeCompletion.choices[0].message.content ?? '{}'
    theme = { ...theme, ...JSON.parse(themeRaw.replace(/```json?/g, '').replace(/```/g, '').trim()) }
  } catch (err) {
    console.error('Theme classification failed, using default:', err)
  }

  const genreCriteria = GENRE_CRITERIA[theme.genre] ?? GENRE_CRITERIA.educativo

  const prompt = `Você é um editor profissional de YouTube Shorts especializado no gênero "${theme.genre}". Sua missão é encontrar momentos que REALMENTE engajariam pessoas na internet hoje — não trechos aleatórios só porque parecem ter palavras-chave interessantes.

GÊNERO DETECTADO: ${theme.genre} (tom: ${theme.mood})
CRITÉRIO DE VIRALIDADE PARA ESTE GÊNERO: ${genreCriteria}

DURAÇÃO TOTAL DO VÍDEO: ${Math.round(totalDuration)} segundos (~${Math.round(totalDuration / 60)} minutos)
NÚMERO IDEAL DE CLIPS PARA ESTE VÍDEO: ${targetClipCount}

TRANSCRIÇÃO:
${truncatedText}

SEGMENTOS:
${JSON.stringify(truncatedSegments, null, 2)}

Retorne APENAS este JSON (sem markdown):
{
  "clips": [
    {
      "title": "título chamativo em português, refletindo o conteúdo real",
      "description": "por que esse momento específico funciona para o gênero ${theme.genre}",
      "start_time": 12.5,
      "end_time": 75.2,
      "transcript": "trecho da transcrição",
      "hook_score": 85,
      "emotion_score": 72,
      "narrative_score": 68,
      "energy_score": 90,
      "is_best": false
    }
  ]
}

Regras inegociáveis:
1. CADA CLIP DEVE FAZER SENTIDO SOZINHO — um espectador que nunca viu o vídeo completo precisa entender do que se trata sem contexto adicional. Se o trecho depende de algo dito muito antes que não está incluso, EXPANDA o intervalo para incluir esse contexto, ou descarte o momento.
2. NUNCA corte no meio de uma frase, piada, ideia ou história incompleta. Sempre comece em uma transição natural (início de frase/ideia) e termine em um fechamento natural (fim de frase, punchline, conclusão).
3. Aplique o critério de viralidade específico do gênero "${theme.genre}" descrito acima — não generalize.
4. Gere aproximadamente ${targetClipCount} clips, mas SOMENTE se houver momentos genuinamente bons — é melhor ter 2 clips ótimos que 6 medianos.
5. Duração (end_time - start_time) entre 59 e 90 segundos.
6. Marque is_best: true no clip de maior potencial viral (apenas 1).
7. "transcript" deve ser cópia LITERAL do trecho dos SEGMENTOS no intervalo [start_time, end_time] — nunca invente ou parafraseie.
8. start_time e end_time devem corresponder exatamente aos timestamps reais dos segmentos.`

  const MIN_DURATION = 59
  const MAX_DURATION = 90
  const maxAvailableEnd = segmentMap.length > 0 ? segmentMap[segmentMap.length - 1].end : Infinity

  function clampDuration(start: number, end: number): { start: number; end: number } {
    let s = Math.max(0, start)
    let e = end
    if (e - s > MAX_DURATION) e = s + MAX_DURATION
    if (e - s < MIN_DURATION) {
      const needed = MIN_DURATION - (e - s)
      e = Math.min(maxAvailableEnd, e + needed)
      if (e - s < MIN_DURATION) s = Math.max(0, s - (MIN_DURATION - (e - s)))
    }
    return { start: s, end: e }
  }

  try {
    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.4,
      response_format: { type: 'json_object' },
    })

    raw = completion.choices[0].message.content ?? '{}'
    const parsed = JSON.parse(raw.replace(/```json?/g, '').replace(/```/g, '').trim())

    clips = (parsed.clips ?? [])
      .filter((c: any) => c.start_time != null && c.end_time != null && c.title)
      .map((c: any, i: number) => {
        const { start, end } = clampDuration(c.start_time, c.end_time)
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
