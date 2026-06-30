'use client'

/**
 * Chama a API de transcrição do Groq diretamente do navegador, sem passar pelo
 * nosso backend na Vercel — isso evita o limite de ~4.5MB no corpo de requisições
 * de API routes, que bloqueava vídeos mais longos.
 */
export interface TranscriptSegment {
  start: number
  end: number
  text: string
}

export interface TranscriptionResult {
  text: string
  segments: TranscriptSegment[]
}

export async function transcribeAudio(audioBlob: Blob): Promise<TranscriptionResult> {
  const apiKey = process.env.NEXT_PUBLIC_GROQ_API_KEY
  if (!apiKey) throw new Error('NEXT_PUBLIC_GROQ_API_KEY não configurada')

  const form = new FormData()
  form.append('file', audioBlob, 'audio.mp3')
  form.append('model', 'whisper-large-v3')
  form.append('response_format', 'verbose_json')
  form.append('timestamp_granularities[]', 'segment')

  const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(`Groq Whisper falhou (${res.status}): ${errText.slice(0, 200)}`)
  }

  const data = await res.json()
  return {
    text: data.text ?? '',
    segments: (data.segments ?? []).map((s: any) => ({ start: s.start, end: s.end, text: s.text })),
  }
}
