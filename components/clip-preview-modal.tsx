'use client'
import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import type { Clip } from '@/types'
import { formatDuration } from '@/lib/utils'

interface ClipPreviewModalProps {
  clip: Clip
  videoFile: File
  onClose: () => void
}

export function ClipPreviewModal({ clip, videoFile, onClose }: ClipPreviewModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const urlRef = useRef<string>('')

  useEffect(() => {
    urlRef.current = URL.createObjectURL(videoFile)
    const video = videoRef.current
    if (!video) return
    video.src = urlRef.current
    video.currentTime = clip.startTime
    video.play()

    function handleTimeUpdate() {
      if (video && video.currentTime >= clip.endTime) {
        video.pause()
        video.currentTime = clip.startTime
      }
    }
    video.addEventListener('timeupdate', handleTimeUpdate)
    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate)
      URL.revokeObjectURL(urlRef.current)
    }
  }, [clip, videoFile])

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="relative bg-[#111] rounded-2xl overflow-hidden max-h-[90vh] flex flex-col"
        style={{ width: 'min(400px, 90vw)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <div>
            <h3 className="text-white font-semibold text-sm line-clamp-1">{clip.title}</h3>
            <p className="text-white/40 text-xs mt-0.5">
              {formatDuration(clip.startTime)} → {formatDuration(clip.endTime)} · {formatDuration(clip.duration)}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/60 hover:text-white transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Video */}
        <div className="flex-1 flex items-center justify-center bg-black">
          <video
            ref={videoRef}
            className="max-h-[70vh] w-full object-contain"
            controls
            playsInline
          />
        </div>
      </div>
    </div>
  )
}
