'use client'
import { useCallback, useState } from 'react'
import { Upload, FileVideo, X, Check, Link, Loader2 } from 'lucide-react'
import { cn, formatFileSize } from '@/lib/utils'
import { Button } from './ui/button'

interface UploadZoneProps {
  onFileSelected: (file: File) => void
}

type Tab = 'file' | 'url'

export function UploadZone({ onFileSelected }: UploadZoneProps) {
  const [tab, setTab] = useState<Tab>('file')
  const [dragging, setDragging] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [url, setUrl] = useState('')
  const [urlLoading, setUrlLoading] = useState(false)
  const [urlError, setUrlError] = useState('')
  const [urlMeta, setUrlMeta] = useState<{ title: string; duration?: number } | null>(null)

  const handleFile = useCallback(
    (file: File) => {
      const valid = ['video/mp4', 'video/mov', 'video/quicktime', 'video/webm', 'video/avi']
      if (!valid.includes(file.type) && !file.name.match(/\.(mp4|mov|webm|avi|mkv)$/i)) {
        alert('Formato não suportado. Use MP4, MOV, WebM ou AVI.')
        return
      }
      setSelectedFile(file)
      onFileSelected(file)
    },
    [onFileSelected]
  )

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragging(false)
      const file = e.dataTransfer.files[0]
      if (file) handleFile(file)
    },
    [handleFile]
  )

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  async function handleUrlImport() {
    if (!url.trim()) return
    setUrlLoading(true)
    setUrlError('')
    setUrlMeta(null)
    try {
      const res = await fetch('/api/import-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        setUrlError(data.error ?? 'Falha ao importar vídeo')
        return
      }

      setUrlMeta({ title: data.title, duration: data.duration })

      // Baixa via nosso proxy (mesmo domínio, evita bloqueio de CORS do YouTube)
      const videoRes = await fetch(data.streamUrl)
      if (!videoRes.ok) throw new Error('Falha ao baixar vídeo')
      const blob = await videoRes.blob()
      const file = new File([blob], `${data.title ?? 'video'}.mp4`, { type: 'video/mp4' })
      setSelectedFile(file)
      onFileSelected(file)
    } catch (err: any) {
      setUrlError(err.message ?? 'Erro ao importar vídeo. Verifique a URL e tente novamente.')
    } finally {
      setUrlLoading(false)
    }
  }

  if (selectedFile) {
    return (
      <div className="border border-[#e5e5e5] rounded-2xl p-6 bg-white">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-[#f0f0f0] flex items-center justify-center">
            <FileVideo size={24} className="text-[#555]" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-medium text-[#111] truncate">{selectedFile.name}</div>
            <div className="text-sm text-[#888]">{formatFileSize(selectedFile.size)}</div>
          </div>
          <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center">
            <Check size={16} className="text-white" />
          </div>
          <button
            onClick={() => { setSelectedFile(null); setUrl(''); setUrlMeta(null) }}
            className="w-8 h-8 rounded-full hover:bg-[#f0f0f0] flex items-center justify-center text-[#888] hover:text-[#111] transition-colors"
          >
            <X size={16} />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex gap-1 bg-[#f0f0f0] rounded-xl p-1">
        <button
          onClick={() => setTab('file')}
          className={cn(
            'flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all',
            tab === 'file' ? 'bg-white text-[#111] shadow-sm' : 'text-[#888] hover:text-[#555]'
          )}
        >
          <Upload size={14} />
          Upload de arquivo
        </button>
        <button
          onClick={() => setTab('url')}
          className={cn(
            'flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all',
            tab === 'url' ? 'bg-white text-[#111] shadow-sm' : 'text-[#888] hover:text-[#555]'
          )}
        >
          <Link size={14} />
          Importar por URL
        </button>
      </div>

      {/* File upload */}
      {tab === 'file' && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={cn(
            'border-2 border-dashed rounded-2xl p-16 text-center transition-all duration-200 cursor-pointer',
            dragging ? 'border-[#111] bg-[#f5f5f5]' : 'border-[#ddd] bg-white hover:border-[#bbb] hover:bg-[#fafafa]'
          )}
          onClick={() => document.getElementById('video-input')?.click()}
        >
          <input id="video-input" type="file" accept="video/*" className="hidden" onChange={onInputChange} />
          <div className="w-16 h-16 rounded-2xl bg-[#f0f0f0] flex items-center justify-center mx-auto mb-4">
            <Upload size={28} className="text-[#555]" />
          </div>
          <h3 className="text-lg font-semibold text-[#111] mb-1">Arraste seu vídeo aqui</h3>
          <p className="text-sm text-[#888] mb-6">MP4, MOV, WebM, AVI — até 20 GB</p>
          <Button variant="secondary" size="md" className="mx-auto">
            <FileVideo size={16} />
            Selecionar arquivo
          </Button>
        </div>
      )}

      {/* URL import */}
      {tab === 'url' && (
        <div className="bg-white border border-[#e5e5e5] rounded-2xl p-6 space-y-4">
          <div>
            <p className="text-sm font-medium text-[#111] mb-1">Cole o link do vídeo</p>
            <p className="text-xs text-[#999]">YouTube, Rumble, Vimeo, Twitter/X, TikTok, Instagram e outros</p>
          </div>

          <div className="flex gap-2">
            <input
              type="url"
              value={url}
              onChange={(e) => { setUrl(e.target.value); setUrlError('') }}
              onKeyDown={(e) => e.key === 'Enter' && handleUrlImport()}
              placeholder="https://youtube.com/watch?v=..."
              className="flex-1 border border-[#e5e5e5] rounded-xl px-4 py-3 text-sm outline-none focus:border-[#111] transition-colors"
            />
            <button
              onClick={handleUrlImport}
              disabled={urlLoading || !url.trim()}
              className="bg-[#111] text-white rounded-xl px-5 py-3 text-sm font-medium flex items-center gap-2 hover:bg-[#222] disabled:opacity-40 transition-colors"
            >
              {urlLoading ? <Loader2 size={16} className="animate-spin" /> : <Link size={16} />}
              {urlLoading ? 'Importando…' : 'Importar'}
            </button>
          </div>

          {urlError && (
            <p className="text-sm text-red-500 bg-red-50 rounded-lg px-4 py-3">{urlError}</p>
          )}

          {urlLoading && (
            <div className="text-sm text-[#888] flex items-center gap-2">
              <Loader2 size={14} className="animate-spin" />
              Baixando vídeo, aguarde…
            </div>
          )}

          <div className="pt-2 border-t border-[#f0f0f0]">
            <p className="text-xs text-[#bbb]">
              Plataformas suportadas: YouTube · Rumble · Vimeo · Twitter/X · TikTok · Instagram · qualquer URL direta de MP4
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
