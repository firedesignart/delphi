'use client'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import {
  Upload,
  Film,
  Calendar,
  BarChart2,
  Settings,
} from 'lucide-react'
import { SettingsPanel } from './settings-panel'

interface SidebarProps {
  activeStep: number
  onStepClick: (step: number) => void
  hasVideo: boolean
  hasClips: boolean
}

const steps = [
  { id: 1, icon: Upload, label: 'Upload', sublabel: 'Envie seu vídeo' },
  { id: 2, icon: BarChart2, label: 'Análise IA', sublabel: 'Detectar momentos' },
  { id: 3, icon: Film, label: 'Shorts', sublabel: 'Revisar clips' },
  { id: 4, icon: Calendar, label: 'Publicar', sublabel: 'Agendar e publicar' },
]

export function Sidebar({ activeStep, onStepClick, hasVideo, hasClips }: SidebarProps) {
  const [settingsOpen, setSettingsOpen] = useState(false)

  function isAccessible(stepId: number) {
    if (stepId === 1) return true
    if (stepId === 2) return hasVideo
    if (stepId === 3) return hasClips
    if (stepId === 4) return hasClips
    return false
  }

  return (
    <>
      {settingsOpen && <SettingsPanel onClose={() => setSettingsOpen(false)} />}

      <aside className="w-[200px] min-h-screen bg-[#111] flex flex-col shrink-0">
        {/* Logo */}
        <div className="px-4 py-5 border-b border-white/[0.08] flex items-center gap-2.5">
          <img src="/brand/logo-symbol.svg" alt="" className="w-6 h-6 brightness-0 invert" />
          <div className="leading-tight">
            <div className="text-white font-semibold text-sm tracking-tight">Delphi</div>
            <div className="text-white/35 text-[8px] tracking-wider">CREATE · EDIT · PUBLISH</div>
          </div>
        </div>

        {/* Nav steps */}
        <nav className="flex-1 px-2.5 py-5 flex flex-col gap-0.5">
          {steps.map((step) => {
            const accessible = isAccessible(step.id)
            const active = activeStep === step.id
            const Icon = step.icon

            return (
              <button
                key={step.id}
                onClick={() => accessible && onStepClick(step.id)}
                disabled={!accessible}
                className={cn(
                  'w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-left transition-all duration-150',
                  active
                    ? 'bg-white text-[#111]'
                    : accessible
                    ? 'text-white/60 hover:bg-white/[0.06] hover:text-white'
                    : 'text-white/20 cursor-not-allowed'
                )}
              >
                <div
                  className={cn(
                    'w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold shrink-0',
                    active ? 'bg-[#111] text-white' : 'bg-white/[0.08]'
                  )}
                >
                  {step.id}
                </div>
                <div className="min-w-0">
                  <div className="text-[13px] font-medium leading-tight">{step.label}</div>
                  <div
                    className={cn(
                      'text-[10px] leading-tight',
                      active ? 'text-[#999]' : 'text-white/35'
                    )}
                  >
                    {step.sublabel}
                  </div>
                </div>
              </button>
            )
          })}
        </nav>

        {/* Bottom */}
        <div className="px-2.5 py-3 border-t border-white/[0.08]">
          <button
            onClick={() => setSettingsOpen(true)}
            className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-white/35 hover:text-white hover:bg-white/[0.06] transition-all text-[13px]"
          >
            <Settings size={14} />
            Configurações
          </button>
        </div>
      </aside>
    </>
  )
}
