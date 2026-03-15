import React, { useState } from 'react'
import { useStore } from '@/store'
import { ProjectList } from '@/components/ProjectList'
import { RecordingUploader } from '@/components/RecordingUploader'
import { TranscriptEditor } from '@/components/TranscriptEditor'
import { WaveformViewer } from '@/components/WaveformViewer'
import { ExportPanel } from '@/components/ExportPanel'
import { ApiKeySettings } from '@/components/ApiKeySettings'

export function App() {
  const { currentProject, session, currentRecording, openaiKey, anthropicKey } = useStore()
  const [showSettings, setShowSettings] = useState(false)
  const keysSet = openaiKey && anthropicKey

  // Prompt for keys on first load if missing
  React.useEffect(() => {
    if (!openaiKey || !anthropicKey) setShowSettings(true)
  }, [])

  const audioUrl = currentRecording
    ? `${import.meta.env.VITE_API_BASE_URL || '/api'}/recordings/${currentRecording.id}/audio`
    : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', fontFamily: 'system-ui, sans-serif' }}>
      {/* Global header */}
      <header style={{ padding: '0.75rem 1.5rem', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: 12 }}>
        {currentProject && (
          <button
            onClick={() => useStore.setState({ currentProject: null, session: null, transcript: null, currentRecording: null, editedText: '', exportId: null, exportStatus: null })}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', fontSize: 13 }}
          >
            ← Projects
          </button>
        )}
        <h2 style={{ margin: 0, fontSize: 16, flex: 1 }}>
          {currentProject ? currentProject.title : 'Podcast Platform'}
        </h2>
        <button
          onClick={() => setShowSettings(true)}
          style={{
            padding: '4px 12px',
            fontSize: 12,
            borderRadius: 4,
            border: '1px solid #d1d5db',
            background: keysSet ? '#f0fdf4' : '#fef3c7',
            cursor: 'pointer',
            color: keysSet ? '#166534' : '#92400e',
          }}
        >
          {keysSet ? '⚙ API Keys ✓' : '⚙ Set API Keys'}
        </button>
      </header>

      {/* Main content */}
      {!currentProject ? (
        <ProjectList />
      ) : (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {!session ? (
            <RecordingUploader />
          ) : (
            <>
              {audioUrl && <WaveformViewer audioUrl={audioUrl} />}
              <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
                <TranscriptEditor />
              </div>
              <ExportPanel />
            </>
          )}
        </div>
      )}

      {showSettings && <ApiKeySettings onClose={() => setShowSettings(false)} />}
    </div>
  )
}
