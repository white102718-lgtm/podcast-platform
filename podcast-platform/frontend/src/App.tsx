import React, { useState, useEffect } from 'react'
import { useStore } from '@/store'
import { Sidebar } from '@/components/Sidebar'
import { RecordingUploader } from '@/components/RecordingUploader'
import { TranscriptEditor } from '@/components/TranscriptEditor'
import { WaveformViewer } from '@/components/WaveformViewer'
import { ActionPanel } from '@/components/ActionPanel'
import { ApiKeySettings } from '@/components/ApiKeySettings'

function ErrorToast({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 5000)
    return () => clearTimeout(t)
  }, [message, onDismiss])

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-800 text-white px-5 py-2.5 rounded-lg text-[13px] z-[9999] flex items-center gap-3 shadow-xl max-w-[480px]">
      <span className="text-red-400">✕</span>
      <span className="flex-1">{message}</span>
      <button onClick={onDismiss} className="bg-transparent border-none text-slate-400 cursor-pointer text-base leading-none hover:text-slate-200">×</button>
    </div>
  )
}

export function App() {
  const { currentProject, session, currentRecording, openaiKey, anthropicKey } = useStore()
  const [showSettings, setShowSettings] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const keysSet = openaiKey && anthropicKey

  useEffect(() => {
    if (!openaiKey || !anthropicKey) setShowSettings(true)
  }, [])

  // Listen for global API errors from axios interceptor
  useEffect(() => {
    const handler = (e: Event) => setErrorMsg((e as CustomEvent<string>).detail)
    window.addEventListener('api-error', handler)
    return () => window.removeEventListener('api-error', handler)
  }, [])

  const audioUrl = currentRecording
    ? `${import.meta.env.VITE_API_BASE_URL || '/api'}/recordings/${currentRecording.id}/audio`
    : null

  return (
    <div className="flex h-screen bg-slate-50">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Top Bar */}
        <header className="flex items-center px-6 py-3.5 border-b border-slate-200 bg-white flex-shrink-0 gap-3">
          <span className="text-[15px] font-semibold text-slate-900 flex-1">
            {currentProject ? `${currentProject.title} — 创业者访谈录` : '我的项目'}
          </span>
          {session && (
            <>
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-green-50 rounded-full">
                <div className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                <span className="text-[11px] font-medium text-green-700">已转录</span>
              </div>
              <div className="w-px h-5 bg-slate-200" />
            </>
          )}
          <button
            onClick={() => setShowSettings(true)}
            className="w-8 h-8 flex items-center justify-center border border-slate-200 rounded-md hover:bg-slate-50 transition-colors"
          >
            <span className="text-sm text-slate-500">⚙</span>
          </button>
        </header>

        {/* Editor Body */}
        {!currentProject ? (
          <div className="flex-1 flex items-center justify-center p-12">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-slate-900 mb-2">欢迎使用 PodCraft</h2>
              <p className="text-slate-500">从左侧选择一个项目开始编辑</p>
            </div>
          </div>
        ) : !session ? (
          <RecordingUploader />
        ) : (
          <div className="flex flex-1 overflow-hidden">
            {/* Center Editor Column */}
            <div className="flex flex-col flex-1 p-6 gap-5 overflow-hidden">
              {/* Word Tokens - takes most space */}
              <TranscriptEditor />

              {/* Waveform at bottom */}
              {audioUrl && <WaveformViewer audioUrl={audioUrl} />}
            </div>

            {/* Right Action Panel */}
            <ActionPanel />
          </div>
        )}
      </div>

      {showSettings && <ApiKeySettings onClose={() => setShowSettings(false)} />}
      {errorMsg && <ErrorToast message={errorMsg} onDismiss={() => setErrorMsg(null)} />}
    </div>
  )
}
