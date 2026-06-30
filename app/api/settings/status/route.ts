import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    groq: !!process.env.GROQ_API_KEY,
    youtube: !!process.env.YOUTUBE_CLIENT_ID && !!process.env.YOUTUBE_CLIENT_SECRET,
  })
}
