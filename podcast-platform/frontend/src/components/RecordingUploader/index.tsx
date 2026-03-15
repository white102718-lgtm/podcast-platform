import React, { useRef, useState } from 'react'
import { useStore } from '@/store'
import * as api from '@/api/client'

export function RecordingUploader() {
  const { currentProject, uploadRecording, setCurrentRecording, loadTranscriptAndSession } = useStore()
  const [dragging, setDragging] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  if (!currentProject) return null

  const handleFile = async (file: File) => {
    setStatus('Uploading...')
    const recording = await uploadRecording(currentProject.id, file)
    setStatus('Transcribing... (this may take a minute)')

    await api.startTranscription(recording.id)

    // poll until ready
    const poll = async () => {
      const r = await api.getRecording(recording.id)
      setCurrentRecording(r)
      if (r.status === 'transcribing' || r.status === 'pending') {
        setTimeout(poll, 2500)
      } else if (r.status === 'ready') {
        setStatus('Loading editor...')
        await loadTranscriptAndSession(recording.id)
        setStatus(null)
      } else {
        setStatus('Transcription failed. Please try again.')
      }
    }
    await poll()
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  return (
    <div style={{ padding: '2rem' }}>
      <h2>{currentProject.title}</h2>
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        style={{
          border: `2px dashed ${dragging ? '#4f46e5' : '#ccc'}`,
          borderRadius: 8,
          padding: '3rem',
          textAlign: 'center',
          cursor: 'pointer',
          background: dragging ? '#f0f0ff' : '#fafafa',
          transition: 'all 0.15s',
        }}
      >
        <p style={{ margin: 0, color: '#555' }}>
          Drop an audio file here, or click to browse
        </p>
        <p style={{ margin: '8px 0 0', fontSize: 12, color: '#999' }}>
          MP3, WAV, M4A, FLAC supported
        </p>
        <input
          ref={inputRef}
          type="file"
          accept="audio/*"
          style={{ display: 'none' }}
          onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
        />
      </div>
      {status && (
        <p style={{ marginTop: '1rem', color: '#4f46e5', fontStyle: 'italic' }}>{status}</p>
      )}
    </div>
  )
}
