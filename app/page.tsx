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
  const [projects, setProjects] = useState<VideoProject[]>([])

  const allClips = projects.flatMap((p) => p.clips)

  const handleFileSelected = useCallback((file: File) => {
    setVideoFile(file)
  }, [])

  const handleAnalysisComplete = useCallback(
    (detectedClips: Clip[], theme?: any) => {
      if (!videoFile) return
      const project: VideoProject = {
        id: `proj-${Date.now()}`,
        title: videoFile.name.replace(/\.[^/.]+$/, ''),
        videoFile,
        clips: detectedClips,
        theme,
      }
      setProjects((prev) => [...prev, project])
      setStep(3)
    },
    [videoFile]
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
    <div className="flex min-h-screen">
      <Sidebar
        activeStep={step}
        onStepClick={setStep}
        hasVideo={!!videoFile}
        hasClips={allClips.length > 0}
      />

      <main className="flex-1 overflow-auto">
        <header className="border-b border-[#e5e5e5] bg-white px-8 py-4 sticky top-0 z-10">
          <h1 className="text-lg font-semibold text-[#111]">{stepTitles[step]?.title}</h1>
          <p className="text-sm text-[#888]">{stepTitles[step]?.subtitle}</p>
        </header>

        <div className="p-8">
          {step === 1 && (
            <div className="max-w-2xl mx-auto">
              <UploadZone onFileSelected={handleFileSelected} />
              {videoFile && (
                <div className="mt-6 flex justify-end">
                  <button
                    onClick={() => setStep(2)}
                    className="bg-[#111] text-white px-6 py-3 rounded-lg font-medium hover:bg-[#222] transition-colors"
                  >
                    Analisar com IA →
                  </button>
                </div>
              )}
              {!videoFile && (
                <div className="mt-8 grid grid-cols-3 gap-4">
                  {[
                    { n: '1', title: 'Envie seu vídeo', desc: 'Upload ou link do YouTube, Rumble e mais' },
                    { n: '2', title: 'IA analisa', desc: 'Detecta os melhores momentos automaticamente' },
                    { n: '3', title: 'Publique', desc: 'Agende direto no YouTube com 1 clique' },
                  ].map((item) => (
                    <div key={item.n} className="bg-white border border-[#e5e5e5] rounded-xl p-4">
                      <div className="w-8 h-8 rounded-lg bg-[#f0f0f0] flex items-center justify-center text-sm font-bold text-[#555] mb-3">
                        {item.n}
                      </div>
                      <div className="font-medium text-[#111] mb-1">{item.title}</div>
                      <div className="text-sm text-[#888]">{item.desc}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {step === 2 && videoFile && (
            <div className="max-w-2xl mx-auto">
              <AnalysisView file={videoFile} onComplete={handleAnalysisComplete} />
            </div>
          )}

          {step === 3 && projects.length > 0 && (
            <div>
              <ClipsGrid
                projects={projects}
                onProjectClipsChange={updateProjectClips}
                onProceed={() => setStep(4)}
                onAddVideo={() => { setVideoFile(null); setStep(1) }}
              />
            </div>
          )}

          {step === 4 && (
            <div className="max-w-2xl mx-auto">
              <PublishPanel clips={allClips} />
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
