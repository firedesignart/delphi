import { NextRequest } from 'next/server'
import ytdl from '@distube/ytdl-core'

// Vídeos longos demoram para baixar — estende o tempo limite da função (suportado no plano Pro da Vercel)
export const maxDuration = 300

export async function GET(req: NextRequest) {
  const target = req.nextUrl.searchParams.get('url')
  if (!target) return new Response('Missing url', { status: 400 })

  try {
    if (ytdl.validateURL(target)) {
      const info = await ytdl.getInfo(target)
      const format = ytdl.chooseFormat(info.formats, {
        quality: 'highestvideo',
        filter: 'audioandvideo',
      })

      const stream = ytdl.downloadFromInfo(info, { format })

      return new Response(stream as any, {
        headers: {
          'Content-Type': 'video/mp4',
          'Cache-Control': 'no-store',
        },
      })
    }

    // URL direta — repassa o vídeo de origem
    const upstream = await fetch(target)
    if (!upstream.ok || !upstream.body) {
      return new Response('Falha ao baixar vídeo da origem', { status: 502 })
    }
    return new Response(upstream.body, {
      headers: {
        'Content-Type': upstream.headers.get('content-type') ?? 'video/mp4',
        'Cache-Control': 'no-store',
      },
    })
  } catch (err: any) {
    console.error('stream proxy error:', err)
    return new Response(`Erro ao processar vídeo: ${err?.message ?? 'desconhecido'}`, { status: 500 })
  }
}
