'use client'
import { useEffect, useRef, useState } from 'react'
import type { VideoLayout, AspectRatio } from './layout-picker'

interface FormatPreviewProps {
  videoSrc: string | null
  previewTime: number
  layout: VideoLayout
  aspectRatio: AspectRatio
  faceSide?: 'left' | 'right'
}

const RATIO_VALUES: Record<AspectRatio, number> = {
  '9:16': 9 / 16,
  '1:1': 1,
  '4:5': 4 / 5,
  '16:9': 16 / 9,
}

function VideoFrame({ videoSrc, previewTime, objectFit, objectPosition }: {
  videoSrc: string
  previewTime: number
  objectFit: 'cover' | 'contain'
  objectPosition?: string
}) {
  const ref = useRef<HTMLVideoElement>(null)
  useEffect(() => {
    const v = ref.current
    if (!v) return
    function onMeta() { if (v) v.currentTime = previewTime }
    v.addEventListener('loadedmetadata', onMeta)
    if (v.readyState >= 1) v.currentTime = previewTime
    return () => v.removeEventListener('loadedmetadata', onMeta)
  }, [videoSrc, previewTime])

  return (
    <video
      ref={ref}
      src={videoSrc}
      muted
      playsInline
      preload="metadata"
      className="absolute inset-0 w-full h-full"
      style={{ objectFit, objectPosition: objectPosition ?? 'center' }}
    />
  )
}

export function FormatPreview({ videoSrc, previewTime, layout, aspectRatio, faceSide = 'left' }: FormatPreviewProps) {
  const ratio = RATIO_VALUES[aspectRatio]

  if (!videoSrc) {
    return (
      <div className="bg-[#f0f0f0] rounded-xl flex items-center justify-center text-xs text-[#999]" style={{ aspectRatio: ratio, maxHeight: 220 }}>
        Preview indisponível
      </div>
    )
  }

  if (layout === 'split') {
    const topPos = faceSide === 'right' ? '100% center' : '0% center'
    const botPos = faceSide === 'right' ? '0% center' : '100% center'
    return (
      <div className="bg-black rounded-xl overflow-hidden mx-auto relative" style={{ aspectRatio: ratio, maxHeight: 220 }}>
        <div className="absolute inset-0 flex flex-col">
          <div className="relative flex-1 overflow-hidden border-b border-black">
            <VideoFrame videoSrc={videoSrc} previewTime={previewTime} objectFit="cover" objectPosition={topPos} />
          </div>
          <div className="relative flex-1 overflow-hidden">
            <VideoFrame videoSrc={videoSrc} previewTime={previewTime} objectFit="cover" objectPosition={botPos} />
          </div>
        </div>
      </div>
    )
  }

  if (layout === 'letterbox') {
    return (
      <div className="bg-black rounded-xl overflow-hidden mx-auto relative" style={{ aspectRatio: ratio, maxHeight: 220 }}>
        <VideoFrame videoSrc={videoSrc} previewTime={previewTime} objectFit="contain" />
      </div>
    )
  }

  if (layout === 'react') {
    return (
      <div className="bg-black rounded-xl overflow-hidden mx-auto relative" style={{ aspectRatio: ratio, maxHeight: 220 }}>
        <div className="absolute inset-0">
          <VideoFrame videoSrc={videoSrc} previewTime={previewTime} objectFit="cover" />
          <div className="absolute inset-0 backdrop-blur-md bg-black/20" />
        </div>
        <div className="absolute inset-x-[7%] top-[19%] bottom-[19%] rounded-lg overflow-hidden ring-2 ring-white/80 shadow-lg">
          <VideoFrame videoSrc={videoSrc} previewTime={previewTime} objectFit="cover" />
        </div>
      </div>
    )
  }

  // fill / auto
  return (
    <div className="bg-black rounded-xl overflow-hidden mx-auto relative" style={{ aspectRatio: ratio, maxHeight: 220 }}>
      <VideoFrame videoSrc={videoSrc} previewTime={previewTime} objectFit="cover" />
    </div>
  )
}
