'use client'
import { useState, useCallback } from 'react'
import { Sidebar } from '@/components/sidebar'
import { UploadZone } from '@/components/upload-zone'
import { AnalysisView } from '@/components/analysis-view'
import { ClipsGrid } from '@/components/clips-grid'
import { PublishPanel } from '@/components/publish-panel'
import type { Clip, VideoProject } from '@/types'

export default function Home() {
  const [step, setStep] = useState(1)
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [localFilename, setLocalFilename] = useState<string | null>(null)
  const [localFileSize, setLocalFileSize] = useState<number>(0)
  const [projects, setProjects] = useState<VideoProject[]>([])

  const allClips = projects.flatMap((p) => p.clips)
  const hasVideo = !!videoFile || !!localFilename

  const handleFileSelected = useCallback((file: File) => {
    setVideoFile(file)
    setLocalFilename(null)
  }, [])

  const handleLocalFileSelected = useCallback((filename: string, size: number) => {
    setLocalFilename(filename)
    setLocalFileSize(size)
    setVideoFile(null)
  }, [])

  const handleAnalysisComplete = useCallback(
    (detectedClips: Clip[], theme?: any) => {
      if (!videoFile && !localFilename) return
      const project: VideoProject = {
        id: `proj-${Date.now()}`,
        title: (videoFile?.name ?? localFilename ?? 'video').replace(/\.[^/.]+$/, ''),
        videoFile,
        localFilename: localFilename ?? undefined,
        clips: detectedClips,
        theme,
      }
      setProjects((prev) => [...prev, project])
      setStep(3)
    },
    [videoFile, localFilename]
  )

  function updateProjectClips(projectId: string, clips: Clip[]) {
    setProjects((prev) => prev.map((p) => (p.id === projectId ? { ...p, clips } : p)))
  }

  const stepTitles: Record<number, { title: string; subtitle: string }> = {
    1: { title: 'Upload de vídeo', subtitle: 'Envie o vídeo ou cole um link para começar' },
    2: { title: 'Análise com IA', subtitle: 'Detectando os melhores momentos automaticamente' },
    3: { title: 'Shorts gerados', subtitle: 'Revise e aprove os clips detectados pela IA' },
    4: { title: 'Publicar', subtitle: 'Agende e publique no YouTube' },
  }

  return (
    <div className="flex min-h-screen bg-[#f7f7f8]">
      <Sidebar
        activeStep={step}
        onStepClick={setStep}
        hasVideo={hasVideo}
        hasClips={allClips.length > 0}
      />

      <main className="flex-1 overflow-auto">
        <header className="border-b border-[#ececec] bg-white/80 backdrop-blur px-8 py-4 sticky top-0 z-10">
          <h1 className="text-lg font-semibold text-[#111] tracking-tight">{stepTitles[step]?.title}</h1>
          <p className="text-sm text-[#999]">{stepTitles[step]?.subtitle}</p>
        </header>

        <div className="p-8">
          {step === 1 && (
            <div className="max-w-2xl mx-auto">
              <div className="bg-white border border-[#ececec] rounded-2xl p-6 sm:p-8 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
                <div className="flex items-center gap-2.5 mb-6">
                  <div className="w-6 h-6 rounded-full bg-[#111] text-white text-xs font-bold flex items-center justify-center shrink-0">1</div>
                  <span className="text-xs font-semibold text-[#999] uppercase tracking-wide">Envie seu conteúdo</span>
                </div>

                <UploadZone onFileSelected={handleFileSelected} onLocalFileSelected={handleLocalFileSelected} />

                {hasVideo && (
                  <div className="mt-6 flex justify-end">
                    <button
                      onClick={() => setStep(2)}
                      className="bg-[#111] text-white px-6 py-2.5 rounded-xl text-sm font-medium hover:bg-[#222] transition-colors"
                    >
                      Continuar →
                    </button>
                  </div>
                )}
              </div>

              {!hasVideo && (
                <div className="mt-6 grid grid-cols-3 gap-4">
                  {[
                    { n: '1', title: 'Envie seu vídeo', desc: 'Upload, link ou vídeo grande do seu PC' },
                    { n: '2', title: 'IA analisa', desc: 'Detecta os melhores momentos automaticamente' },
                    { n: '3', title: 'Publique', desc: 'Agende direto no YouTube com 1 clique' },
                  ].map((item) => (
                    <div key={item.n} className="bg-white border border-[#ececec] rounded-2xl p-4">
                      <div className="w-7 h-7 rounded-lg bg-[#f5f5f5] flex items-center justify-center text-xs font-bold text-[#888] mb-3">
                        {item.n}
                      </div>
                      <div className="font-medium text-[#111] text-sm mb-1">{item.title}</div>
                      <div className="text-xs text-[#999]">{item.desc}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {step === 2 && hasVideo && (
            <div className="max-w-2xl mx-auto">
              <div className="bg-white border border-[#ececec] rounded-2xl p-6 sm:p-8 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
                <div className="flex items-center gap-2.5 mb-6">
                  <div className="w-6 h-6 rounded-full bg-[#111] text-white text-xs font-bold flex items-center justify-center shrink-0">2</div>
                  <span className="text-xs font-semibold text-[#999] uppercase tracking-wide">Análise com IA</span>
                </div>
                <AnalysisView file={videoFile} localFilename={localFilename ?? undefined} onComplete={handleAnalysisComplete} />
              </div>
            </div>
          )}

          {step === 3 && projects.length > 0 && (
            <div>
              <ClipsGrid
                projects={projects}
                onProjectClipsChange={updateProjectClips}
                onProceed={() => setStep(4)}
                onAddVideo={() => { setVideoFile(null); setLocalFilename(null); setStep(1) }}
              />
            </div>
          )}

          {step === 4 && (
            <div className="max-w-2xl mx-auto">
              <div className="bg-white border border-[#ececec] rounded-2xl p-6 sm:p-8 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
                <div className="flex items-center gap-2.5 mb-6">
                  <div className="w-6 h-6 rounded-full bg-[#111] text-white text-xs font-bold flex items-center justify-center shrink-0">4</div>
                  <span className="text-xs font-semibold text-[#999] uppercase tracking-wide">Revisar e publicar</span>
                </div>
                <PublishPanel clips={allClips} />
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
