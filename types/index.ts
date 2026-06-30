export type MediaAssetStatus =
  | 'UPLOADING'
  | 'UPLOADED'
  | 'PROCESSING'
  | 'READY'
  | 'FAILED'

export type ClipStatus = 'PENDING' | 'APPROVED' | 'REJECTED'

export type ContentStatus =
  | 'GENERATED'
  | 'NEEDS_REVIEW'
  | 'APPROVED'
  | 'SCHEDULED'
  | 'PUBLISHED'
  | 'FAILED'

export interface MediaAsset {
  id: string
  workspaceId: string
  filename: string
  originalFilename: string
  mimeType: string
  duration?: number
  fps?: number
  width?: number
  height?: number
  size: number
  status: MediaAssetStatus
  storagePath: string
  thumbnailPath?: string
  createdAt: string
}

export interface VideoTheme {
  genre: string
  mood: string
  music_suggestion: string
}

export interface VideoProject {
  id: string
  title: string
  videoFile: File | null
  localFilename?: string
  clips: Clip[]
  theme?: VideoTheme
}

export interface Clip {
  id: string
  mediaAssetId: string
  title: string
  description: string
  startTime: number
  endTime: number
  duration: number
  hookScore: number
  emotionScore: number
  narrativeScore: number
  energyScore: number
  totalScore: number
  transcript: string
  status: ClipStatus
  isBest?: boolean
  thumbnailUrl?: string | null
  createdAt: string
}

export interface ContentItem {
  id: string
  clipId: string
  title: string
  description: string
  hashtags: string[]
  platforms: Platform[]
  status: ContentStatus
  scheduledAt?: string
  publishedAt?: string
  youtubeVideoId?: string
  createdAt: string
}

export interface Platform {
  id: 'youtube' | 'tiktok' | 'instagram'
  name: string
  connected: boolean
}

export interface Project {
  id: string
  name: string
  mediaAsset: MediaAsset
  clips: Clip[]
  contentItems: ContentItem[]
  createdAt: string
}

export interface AnalysisProgress {
  stage: string
  percent: number
  message: string
}
