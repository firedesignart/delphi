import type { ContentItem } from '@/types'

// Mock YouTube publishing — replace with YouTube Data API v3 when credentials are available
export async function scheduleToYouTube(
  clip: { title: string; description: string; hashtags: string[] },
  scheduledAt: Date
): Promise<{ videoId: string; url: string }> {
  await new Promise((r) => setTimeout(r, 1500))

  const mockVideoId = `yt_${Math.random().toString(36).slice(2, 10)}`
  return {
    videoId: mockVideoId,
    url: `https://youtube.com/shorts/${mockVideoId}`,
  }
}

export async function publishNow(
  clip: { title: string; description: string; hashtags: string[] }
): Promise<{ videoId: string; url: string }> {
  return scheduleToYouTube(clip, new Date())
}
