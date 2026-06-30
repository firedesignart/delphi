'use client'
import { useCallback, useEffect, useState } from 'react'
import { Upload, FileVideo, X, Check, Link, Loader2, HardDrive, RefreshCw, FolderOpen, FileDown } from 'lucide-react'
import { cn, formatFileSize } from '@/lib/utils'
import { Button } from './ui/button'
import { pingLocalHelper, listLocalFiles, type LocalFile } from '@/lib/local-helper'

interface UploadZoneProps {
  onFileSelected: (file: File) => void
  onLocalFileSelected?: (filename: string, size: number) => void
}

type Tab = 'file' | 'url' | 'local'

export function UploadZone({ onFileSelected, onLocalFileSelected }: UploadZoneProps) {
  const [tab, setTab] = useState<Tab>('file')
  const [dragging, setDragging] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [selectedLocal, setSelectedLocal] = useState<{ name: string; size: number } | null>(null)
  const [url, setUrl] = useState('')
  const [urlLoading, setUrlLoading] = useState(false)
  const [urlError, setUrlError] = useState('')
  const [urlMeta, setUrlMeta] = useState<{ title: string; duration?: number } | null>(null)

  const [helperStatus, setHelperStatus] = useState<'checking' | 'online' | 'offline'>('checking')
  const [localFiles, setLocalFiles] = useState<LocalFile[]>([])
  const [localLoading, setLocalLoading] = useState(false)

  const checkHelper = useCallback(async () => {
    setHelperStatus('checking')
    const status = await pingLocalHelper()
    if (status?.ok) {
      setHelperStatus('online')
      refreshLocalFiles()
    } else {
      setHelperStatus('offline')
    }
  }, [])

  async function refreshLocalFiles() {
    setLocalLoading(true)
    try {
      setLocalFiles(await listLocalFiles())
    } catch { /* ignore */ }
    setLocalLoading(false)
  }

  useEffect(() => {
    if (tab === 'local') checkHelper()
  }, [tab, checkHelper])

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

  function selectLocalFile(f: LocalFile) {
    setSelectedLocal({ name: f.name, size: f.size })
    onLocalFileSelected?.(f.name, f.size)
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

  if (selectedLocal) {
    return (
      <div className="border border-purple-200 bg-purple-50/50 rounded-2xl p-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center">
            <HardDrive size={24} className="text-purple-600" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-medium text-[#111] truncate">{selectedLocal.name}</div>
            <div className="text-sm text-[#888]">{formatFileSize(selectedLocal.size)} · processado no seu PC</div>
          </div>
          <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center">
            <Check size={16} className="text-white" />
          </div>
          <button
            onClick={() => setSelectedLocal(null)}
            className="w-8 h-8 rounded-full hover:bg-white flex items-center justify-center text-[#888] hover:text-[#111] transition-colors"
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
          className={cn('flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all',
            tab === 'file' ? 'bg-white text-[#111] shadow-sm' : 'text-[#888] hover:text-[#555]')}>
          <Upload size={14} /> Upload
        </button>
        <button
          onClick={() => setTab('url')}
          className={cn('flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all',
            tab === 'url' ? 'bg-white text-[#111] shadow-sm' : 'text-[#888] hover:text-[#555]')}>
          <Link size={14} /> URL
        </button>
        <button
          onClick={() => setTab('local')}
          className={cn('flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all',
            tab === 'local' ? 'bg-white text-[#111] shadow-sm' : 'text-[#888] hover:text-[#555]')}>
          <HardDrive size={14} /> Vídeo grande (PC)
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
          <p className="text-sm text-[#888] mb-6">MP4, MOV, WebM, AVI — recomendado até 1GB</p>
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
            <p className="text-xs text-[#999]">Rumble, Vimeo, Twitter/X, TikTok, Instagram e outros (YouTube costuma bloquear)</p>
          </div>

          <div className="flex gap-2">
            <input
              type="url"
              value={url}
              onChange={(e) => { setUrl(e.target.value); setUrlError('') }}
              onKeyDown={(e) => e.key === 'Enter' && handleUrlImport()}
              placeholder="https://..."
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

          {urlError && <p className="text-sm text-red-500 bg-red-50 rounded-lg px-4 py-3">{urlError}</p>}
          {urlLoading && (
            <div className="text-sm text-[#888] flex items-center gap-2">
              <Loader2 size={14} className="animate-spin" /> Baixando vídeo, aguarde…
            </div>
          )}
        </div>
      )}

      {/* Local helper */}
      {tab === 'local' && (
        <div className="bg-white border border-[#e5e5e5] rounded-2xl p-6 space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-[#111] mb-1">Processar vídeo grande no seu computador</p>
              <p className="text-xs text-[#999]">Sem limite de tamanho — usa o FFmpeg instalado no seu PC</p>
            </div>
            {helperStatus === 'online' && (
              <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full font-medium flex items-center gap-1">
                <Check size={10} /> Agente conectado
              </span>
            )}
          </div>

          {helperStatus === 'checking' && (
            <div className="text-sm text-[#888] flex items-center gap-2 py-4 justify-center">
              <Loader2 size={14} className="animate-spin" /> Procurando agente local…
            </div>
          )}

          {helperStatus === 'offline' && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
              <p className="text-sm font-medium text-amber-900">Agente local não detectado</p>
              <p className="text-xs text-amber-700">
                Para usar este modo, baixe e rode o Agente Local Delphi no seu computador:
              </p>
              <a
                href="/downloads/delphi-local-helper.zip"
                download
                className="inline-flex items-center gap-2 bg-amber-900 text-white text-xs font-medium px-4 py-2.5 rounded-lg hover:bg-amber-800 transition-colors"
              >
                <FileDown size={14} /> Baixar Agente Local (.zip)
              </a>
              <ol className="text-xs text-amber-800 space-y-1 ml-4 list-decimal">
                <li>Extraia o arquivo .zip baixado em qualquer pasta</li>
                <li>Dê duplo-clique em <code className="bg-amber-100 px-1 rounded">start.bat</code></li>
                <li>Na primeira vez, o Windows pode pedir para instalar o Node.js — baixe em <a href="https://nodejs.org" target="_blank" className="underline">nodejs.org</a> se necessário</li>
                <li>Coloque seu vídeo na pasta <code className="bg-amber-100 px-1 rounded">Delphi/Input</code> que será criada</li>
                <li>Volte aqui e clique em atualizar</li>
              </ol>
              <button onClick={checkHelper} className="flex items-center gap-1.5 text-xs font-medium text-amber-900 hover:underline">
                <RefreshCw size={12} /> Verificar novamente
              </button>
            </div>
          )}

          {helperStatus === 'online' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-[#888] flex items-center gap-1.5">
                  <FolderOpen size={12} /> Vídeos encontrados em Delphi/Input
                </p>
                <button onClick={refreshLocalFiles} className="text-xs text-[#888] hover:text-[#111] flex items-center gap-1">
                  <RefreshCw size={11} className={cn(localLoading && 'animate-spin')} /> Atualizar
                </button>
              </div>

              {localFiles.length === 0 && !localLoading && (
                <div className="text-center py-8 text-sm text-[#999]">
                  Nenhum vídeo encontrado. Coloque um arquivo na pasta Delphi/Input.
                </div>
              )}

              <div className="space-y-2">
                {localFiles.map((f) => (
                  <button
                    key={f.name}
                    onClick={() => selectLocalFile(f)}
                    className="w-full flex items-center gap-3 p-3 rounded-xl border border-[#e5e5e5] hover:border-purple-300 hover:bg-purple-50/50 transition-colors text-left"
                  >
                    <FileVideo size={18} className="text-[#888] shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-[#111] truncate">{f.name}</div>
                      <div className="text-xs text-[#999]">{formatFileSize(f.size)}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
