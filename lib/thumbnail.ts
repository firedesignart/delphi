'use client'

/**
 * Captura um frame do vídeo em um timestamp específico e retorna como data URL (JPEG).
 * Usa <video> + <canvas>, sem FFmpeg — leve e rápido, funciona com qualquer fonte de vídeo
 * acessível por URL (object URL local ou stream do Agente Local).
 */
export function captureFrame(videoSrc: string, time: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    video.crossOrigin = 'anonymous'
    video.muted = true
    video.playsInline = true
    video.preload = 'metadata'
    video.src = videoSrc

    const cleanup = () => {
      video.removeEventListener('loadedmetadata', onMeta)
      video.removeEventListener('seeked', onSeeked)
      video.removeEventListener('error', onError)
    }

    function onMeta() {
      video.currentTime = Math.min(time, Math.max(0, video.duration - 0.1))
    }

    function onSeeked() {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        const ctx = canvas.getContext('2d')
        if (!ctx) throw new Error('Canvas context indisponível')
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        const dataUrl = canvas.toDataURL('image/jpeg', 0.75)
        cleanup()
        resolve(dataUrl)
      } catch (err) {
        cleanup()
        reject(err)
      }
    }

    function onError() {
      cleanup()
      reject(new Error('Falha ao carregar vídeo para thumbnail'))
    }

    video.addEventListener('loadedmetadata', onMeta)
    video.addEventListener('seeked', onSeeked)
    video.addEventListener('error', onError)
  })
}
