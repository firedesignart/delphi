import { NextRequest, NextResponse } from 'next/server'
import ytdl from '@distube/ytdl-core'

const DIRECT_VIDEO_RE = /\.(mp4|mov|webm|avi|mkv)(\?.*)?$/i

export async function POST(req: NextRequest) {
  const { url } = await req.json()
  if (!url) return NextResponse.json({ error: 'URL required' }, { status: 400 })

  // YouTube
  if (ytdl.validateURL(url)) {
    try {
      const info = await ytdl.getInfo(url)
      const format = ytdl.chooseFormat(info.formats, {
        quality: 'highestvideo',
        filter: 'audioandvideo',
      })
      return NextResponse.json({
        directUrl: format.url,
        title: info.videoDetails.title,
        duration: Number(info.videoDetails.lengthSeconds),
        thumbnail: info.videoDetails.thumbnails?.slice(-1)[0]?.url ?? null,
      })
    } catch (err) {
      console.error('ytdl error:', err)
      return NextResponse.json({ error: 'Falha ao obter vídeo do YouTube' }, { status: 500 })
    }
  }

  // URL direta de vídeo (MP4, MOV, etc.)
  if (DIRECT_VIDEO_RE.test(url.split('?')[0])) {
    return NextResponse.json({ directUrl: url, title: url.split('/').pop()?.split('?')[0] ?? 'video' })
  }

  // Tenta HEAD para detectar Content-Type de vídeo
  try {
    const head = await fetch(url, { method: 'HEAD' })
    const ct = head.headers.get('content-type') ?? ''
    if (ct.startsWith('video/')) {
      return NextResponse.json({ directUrl: url, title: 'video' })
    }
  } catch {}

  return NextResponse.json(
    { error: 'URL não suportada. Cole um link do YouTube ou uma URL direta de vídeo (.mp4, .mov…)' },
    { status: 400 }
  )
}
