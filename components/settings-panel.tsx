'use client'
import { useEffect, useState } from 'react'
import { X, Check, ExternalLink, Save, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SettingsPanelProps {
  onClose: () => void
}

interface ApiStatus {
  groq: boolean
  youtube: boolean
}

export function SettingsPanel({ onClose }: SettingsPanelProps) {
  const [status, setStatus] = useState<ApiStatus | null>(null)
  const [youtubeClientId, setYoutubeClientId] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    fetch('/api/settings/status')
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => setStatus({ groq: false, youtube: false }))

    setYoutubeClientId(localStorage.getItem('delphi_youtube_client_id') ?? '')
  }, [])

  function saveLocal() {
    localStorage.setItem('delphi_youtube_client_id', youtubeClientId)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#eee] sticky top-0 bg-white">
          <h3 className="font-semibold text-[#111]">Configurações</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-[#f5f5f5] flex items-center justify-center text-[#999]">
            <X size={16} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-6">
          {/* Integrations status */}
          <div>
            <p className="text-sm font-medium text-[#111] mb-3">Integrações conectadas</p>
            <div className="space-y-2">
              <StatusRow
                label="Groq (Transcrição + IA)"
                connected={status?.groq ?? false}
                desc="Whisper + LLaMA para análise dos vídeos"
              />
              <StatusRow
                label="YouTube Data API"
                connected={status?.youtube ?? false}
                desc="Necessário para publicar/agendar vídeos"
              />
            </div>
          </div>

          {/* YouTube setup guide */}
          {!status?.youtube && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <div className="flex items-start gap-2 mb-3">
                <AlertCircle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-amber-900">YouTube não configurado</p>
                  <p className="text-xs text-amber-700 mt-0.5">Siga os passos para conectar seu canal</p>
                </div>
              </div>
              <ol className="text-xs text-amber-800 space-y-2 ml-1">
                <li>1. Acesse <a href="https://console.cloud.google.com" target="_blank" className="underline inline-flex items-center gap-1">console.cloud.google.com<ExternalLink size={10} /></a></li>
                <li>2. Crie um projeto novo (ex: "Delphi")</li>
                <li>3. Ative a <strong>YouTube Data API v3</strong> em "APIs e Serviços"</li>
                <li>4. Crie credenciais OAuth 2.0 (tipo: Aplicativo Web)</li>
                <li>5. Adicione a URL de callback nas origens autorizadas</li>
                <li>6. Cole o Client ID e Secret no Vercel como variáveis de ambiente</li>
              </ol>
              <p className="text-xs text-amber-700 mt-3">
                Me envie o Client ID e Secret no chat e eu configuro tudo no Vercel automaticamente.
              </p>
            </div>
          )}

          {/* Brand */}
          <div>
            <p className="text-sm font-medium text-[#111] mb-3">Marca</p>
            <div className="flex items-center gap-4 p-4 bg-[#fafafa] rounded-xl">
              <img src="/brand/logo-symbol.svg" alt="Delphi" className="w-10 h-10" />
              <div>
                <p className="text-sm font-medium text-[#111]">Delphi</p>
                <p className="text-xs text-[#888]">Create. Edit. Publish. Grow.</p>
              </div>
            </div>
          </div>

          {/* About */}
          <div className="text-xs text-[#aaa] pt-2 border-t border-[#f0f0f0]">
            Delphi v1.0 · Powered by Groq, FFmpeg WASM, Supabase
          </div>
        </div>
      </div>
    </div>
  )
}

function StatusRow({ label, connected, desc }: { label: string; connected: boolean; desc: string }) {
  return (
    <div className="flex items-center justify-between p-3 bg-[#fafafa] rounded-xl">
      <div>
        <p className="text-sm text-[#111]">{label}</p>
        <p className="text-xs text-[#999]">{desc}</p>
      </div>
      <div className={cn(
        'flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full',
        connected ? 'bg-emerald-100 text-emerald-700' : 'bg-[#eee] text-[#888]'
      )}>
        {connected && <Check size={11} />}
        {connected ? 'Conectado' : 'Não configurado'}
      </div>
    </div>
  )
}
