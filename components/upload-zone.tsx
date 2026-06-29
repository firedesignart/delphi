'use client'
import { useCallback, useState } from 'react'
import { Upload, FileVideo, X, Check } from 'lucide-react'
import { cn, formatFileSize } from '@/lib/utils'
import { Button } from './ui/button'

interface UploadZoneProps {
  onFileSelected: (file: File) => void
}

export function UploadZone({ onFileSelected }: UploadZoneProps) {
  const [dragging, setDragging] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

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
            onClick={() => setSelectedFile(null)}
            className="w-8 h-8 rounded-full hover:bg-[#f0f0f0] flex items-center justify-center text-[#888] hover:text-[#111] transition-colors"
          >
            <X size={16} />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      className={cn(
        'border-2 border-dashed rounded-2xl p-16 text-center transition-all duration-200 cursor-pointer',
        dragging
          ? 'border-[#111] bg-[#f5f5f5]'
          : 'border-[#ddd] bg-white hover:border-[#bbb] hover:bg-[#fafafa]'
      )}
      onClick={() => document.getElementById('video-input')?.click()}
    >
      <input
        id="video-input"
        type="file"
        accept="video/*"
        className="hidden"
        onChange={onInputChange}
      />
      <div className="w-16 h-16 rounded-2xl bg-[#f0f0f0] flex items-center justify-center mx-auto mb-4">
        <Upload size={28} className="text-[#555]" />
      </div>
      <h3 className="text-lg font-semibold text-[#111] mb-1">
        Arraste seu vídeo aqui
      </h3>
      <p className="text-sm text-[#888] mb-6">
        MP4, MOV, WebM, AVI — até 20 GB
      </p>
      <Button variant="secondary" size="md" className="mx-auto">
        <FileVideo size={16} />
        Selecionar arquivo
      </Button>
    </div>
  )
}
