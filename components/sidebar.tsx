'use client'
import Image from 'next/image'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  Upload,
  Film,
  Calendar,
  BarChart2,
  Settings,
  ChevronRight,
} from 'lucide-react'

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
  function isAccessible(stepId: number) {
    if (stepId === 1) return true
    if (stepId === 2) return hasVideo
    if (stepId === 3) return hasClips
    if (stepId === 4) return hasClips
    return false
  }

  return (
    <aside className="w-[220px] min-h-screen bg-[#111] flex flex-col">
      {/* Logo */}
      <div className="px-5 py-6 border-b border-white/10">
        <Image src="/logo.png" alt="Delphi" width={100} height={40} className="invert" />
      </div>

      {/* Nav steps */}
      <nav className="flex-1 px-3 py-6 flex flex-col gap-1">
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
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all duration-150',
                active
                  ? 'bg-white text-[#111]'
                  : accessible
                  ? 'text-white/70 hover:bg-white/10 hover:text-white'
                  : 'text-white/25 cursor-not-allowed'
              )}
            >
              <div
                className={cn(
                  'w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold shrink-0',
                  active ? 'bg-[#111] text-white' : 'bg-white/10'
                )}
              >
                {step.id}
              </div>
              <div className="min-w-0">
                <div className="text-sm font-medium leading-tight">{step.label}</div>
                <div
                  className={cn(
                    'text-xs leading-tight',
                    active ? 'text-[#555]' : 'text-white/40'
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
      <div className="px-3 py-4 border-t border-white/10">
        <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-all text-sm">
          <Settings size={16} />
          Configurações
        </button>
      </div>
    </aside>
  )
}
