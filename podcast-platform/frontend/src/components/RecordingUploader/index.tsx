import React, { useRef, useState, useEffect } from 'react'
import { useStore } from '@/store'
import * as api from '@/api/client'

type Phase = 'idle' | 'uploading' | 'transcribing' | 'loading' | 'error'

function ProgressBar({ pct, color = '#4f46e5' }: { pct: number; color?: string }) {
  return (
    <div style={{ background: '#e5e7eb', borderRadius: 4, height: 6, overflow: 'hidden', marginTop: 8 }}>
      <div style={{
        width: `${pct}%`,
        height: '100%',
        background: color,
        borderRadius: 4,
        transition: 'width 0.3s ease',
      }} />
    </div>
  )
}

export function RecordingUploader() {
  const { currentProject, uploadRecording, setCurrentRecording, loadTranscriptAndSession } = useStore()
  const [dragging, setDragging] = useState(false)
  const [phase, setPhase] = useState<Phase>('idle')
  const [uploadPct, setUploadPct] = useState(0)
  const [transcribePct, setTranscribePct] = useState(0)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const transcribeTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Estimate transcription progress based on elapsed time.
  // Whisper typically processes ~1 min of audio in ~10-20s.
  // We animate to 90% over 60s, then hold until done.
  const startTranscribeProgress = () => {
    setTranscribePct(0)
    const start = Date.now()
    const DURATION_MS = 60_000
    transcribeTimerRef.current = setInterval(() => {
      const elapsed = Date.now() - start
      const pct = Math.min(90, Math.round((elapsed / DURATION_MS) * 90))
      setTranscribePct(pct)
    }, 500)
  }

  const stopTranscribeProgress = (success: boolean) => {
    if (transcribeTimerRef.current) clearInterval(transcribeTimerRef.current)
    setTranscribePct(success ? 100 : 0)
  }

  useEffect(() => () => { if (transcribeTimerRef.current) clearInterval(transcribeTimerRef.current) }, [])

  if (!currentProject) return null

  const handleFile = async (file: File) => {
    setPhase('uploading')
    setUploadPct(0)
    setErrorMsg(null)

    let recording
    try {
      recording = await uploadRecording(currentProject.id, file, (pct) => setUploadPct(pct))
    } catch (err) {
      setPhase('error')
      setErrorMsg(err instanceof Error ? err.message : '上传失败，请重试。')
      return
    }

    setUploadPct(100)

    // Upload is confirmed synchronously — go straight to transcription
    setPhase('transcribing')
    startTranscribeProgress()

    try {
      await api.startTranscription(recording.id)
    } catch (err) {
      stopTranscribeProgress(false)
      setPhase('error')
      const detail = err instanceof Error ? err.message : ''
      const hint = detail.includes('422') || detail.includes('OpenAI')
        ? '请先在右上角设置 OpenAI API Key。'
        : `转录启动失败：${detail || '请重试。'}`
      setErrorMsg(hint)
      return
    }

    const poll = async () => {
      const r = await api.getRecording(recording.id)
      setCurrentRecording(r)
      if (r.status === 'transcribing' || r.status === 'pending') {
        setTimeout(poll, 2500)
      } else if (r.status === 'ready') {
        stopTranscribeProgress(true)
        setPhase('loading')
        await loadTranscriptAndSession(r.id)
        setPhase('idle')
      } else {
        stopTranscribeProgress(false)
        setPhase('error')
        setErrorMsg(r.error_message || '转录失败，请重试。')
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

  const busy = phase !== 'idle' && phase !== 'error'

  return (
    <div style={{ padding: '2rem', maxWidth: 560 }}>
      <h2 style={{ marginTop: 0 }}>{currentProject.title}</h2>

      <div
        onDragOver={e => { e.preventDefault(); if (!busy) setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => { if (!busy) inputRef.current?.click() }}
        style={{
          border: `2px dashed ${dragging ? '#4f46e5' : busy ? '#c7d2fe' : '#ccc'}`,
          borderRadius: 8,
          padding: '3rem',
          textAlign: 'center',
          cursor: busy ? 'default' : 'pointer',
          background: dragging ? '#f0f0ff' : busy ? '#f5f3ff' : '#fafafa',
          transition: 'all 0.15s',
        }}
      >
        <p style={{ margin: 0, color: busy ? '#6d28d9' : '#555' }}>
          {busy ? '处理中，请稍候…' : '拖拽音频文件到此处，或点击选择'}
        </p>
        <p style={{ margin: '8px 0 0', fontSize: 12, color: '#999' }}>
          支持 MP3、WAV、M4A、FLAC，最大 200MB
        </p>
        <input
          ref={inputRef}
          type="file"
          accept="audio/*"
          style={{ display: 'none' }}
          onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
        />
      </div>

      {/* Progress section */}
      {phase !== 'idle' && (
        <div style={{ marginTop: '1.25rem' }}>
          {/* Upload progress */}
          <div style={{ marginBottom: '0.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#374151' }}>
              <span>上传文件</span>
              <span style={{ color: uploadPct === 100 ? '#16a34a' : '#4f46e5' }}>
                {uploadPct === 100 ? '完成 ✓' : `${uploadPct}%`}
              </span>
            </div>
            <ProgressBar pct={uploadPct} color={uploadPct === 100 ? '#16a34a' : '#4f46e5'} />
          </div>

          {/* Transcription progress */}
          {(phase === 'transcribing' || phase === 'loading' || (phase === 'error' && transcribePct > 0)) && (
            <div style={{ marginBottom: '0.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#374151' }}>
                <span>AI 转录中 (Whisper)</span>
                <span style={{ color: transcribePct === 100 ? '#16a34a' : '#4f46e5' }}>
                  {transcribePct === 100 ? '完成 ✓' : phase === 'loading' ? '处理中…' : `~${transcribePct}%`}
                </span>
              </div>
              <ProgressBar pct={transcribePct} color={transcribePct === 100 ? '#16a34a' : '#818cf8'} />
              {phase === 'transcribing' && (
                <p style={{ margin: '4px 0 0', fontSize: 11, color: '#9ca3af' }}>
                  进度为估算值，实际时间取决于音频时长
                </p>
              )}
            </div>
          )}

          {/* Error */}
          {phase === 'error' && errorMsg && (
            <div style={{ marginTop: '0.5rem' }}>
              <p style={{ margin: '0 0 8px', fontSize: 13, color: '#dc2626' }}>{errorMsg}</p>
              <button
                onClick={() => { setPhase('idle'); setUploadPct(0); setTranscribePct(0); setErrorMsg(null) }}
                style={{
                  padding: '6px 16px', fontSize: 13, borderRadius: 4,
                  border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', color: '#374151',
                }}
              >
                重新上传
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
