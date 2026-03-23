import React, { useEffect, useRef, useState } from 'react'
import WaveSurfer from 'wavesurfer.js'
import { useStore } from '@/store'

interface Props {
  audioUrl: string
}

export function WaveformViewer({ audioUrl }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const wsRef = useRef<WaveSurfer | null>(null)
  const { session, transcript, setCurrentTimeMs } = useStore()
  const [waveformHeight, setWaveformHeight] = useState(80)
  const [isPlaying, setIsPlaying] = useState(false)

  useEffect(() => {
    if (!containerRef.current) return

    wsRef.current = WaveSurfer.create({
      container: containerRef.current,
      waveColor: '#C7D2FE',
      progressColor: '#6366F1',
      height: waveformHeight,
      barWidth: 3,
      barGap: 2,
      barRadius: 2,
    })

    wsRef.current.load(audioUrl)

    wsRef.current.on('timeupdate', (currentTime: number) => {
      setCurrentTimeMs(Math.round(currentTime * 1000))
    })

    wsRef.current.on('play', () => setIsPlaying(true))
    wsRef.current.on('pause', () => setIsPlaying(false))

    return () => {
      wsRef.current?.destroy()
    }
  }, [audioUrl, setCurrentTimeMs, waveformHeight])

  const handlePlayPause = () => {
    wsRef.current?.playPause()
  }

  const handleZoomIn = () => {
    setWaveformHeight(prev => Math.min(prev + 20, 200))
  }

  const handleZoomOut = () => {
    setWaveformHeight(prev => Math.max(prev - 20, 60))
  }

  // Overlay cut regions
  const cutRegions = session?.operations.map(op => ({
    start: op.payload.start_ms / 1000,
    end: op.payload.end_ms / 1000,
  })) ?? []

  const duration = transcript?.words.at(-1)?.end_ms ?? 1
  const durationSec = duration / 1000
  const currentTime = useStore(s => s.currentTimeMs) / 1000
  const formattedCurrent = `${Math.floor(currentTime / 60)}:${String(Math.floor(currentTime % 60)).padStart(2, '0')}`
  const formattedDuration = `${Math.floor(durationSec / 60)}:${String(Math.floor(durationSec % 60)).padStart(2, '0')}`

  return (
    <div className="flex flex-col bg-white border border-slate-200 rounded-lg p-4 gap-3 flex-shrink-0">
      {/* Playback controls */}
      <div className="flex items-center gap-3">
        <button
          onClick={handlePlayPause}
          className="w-9 h-9 bg-primary-500 hover:bg-primary-600 rounded-full flex items-center justify-center transition-colors"
        >
          <span className="text-white text-sm pl-0.5">{isPlaying ? '⏸' : '▶'}</span>
        </button>
        <span className="font-mono text-[13px] font-medium text-slate-700">{formattedCurrent}</span>
        <span className="text-xs text-slate-400">/</span>
        <span className="font-mono text-[13px] text-slate-400">{formattedDuration}</span>
        <div className="flex-1" />
        <span className="text-[11px] text-slate-400">1.0x</span>
      </div>

      {/* Waveform */}
      <div className="relative">
        <div ref={containerRef} />
        {/* Cut region overlays */}
        {cutRegions.map((r, i) => (
          <div
            key={i}
            className="absolute top-0 pointer-events-none"
            style={{
              left: `${(r.start / durationSec) * 100}%`,
              width: `${((r.end - r.start) / durationSec) * 100}%`,
              height: waveformHeight,
              background: 'rgba(252, 165, 165, 0.4)',
            }}
          />
        ))}
      </div>

      {/* Zoom controls */}
      <div className="flex items-center gap-2 px-1">
        <span className="text-[11px] font-medium text-slate-400">缩放</span>
        <div className="flex items-center gap-1">
          <button
            onClick={handleZoomOut}
            className="w-6 h-6 bg-slate-50 border border-slate-200 rounded flex items-center justify-center hover:bg-slate-100 transition-colors"
          >
            <span className="text-xs text-slate-600">−</span>
          </button>
          <button
            onClick={handleZoomIn}
            className="w-6 h-6 bg-slate-50 border border-slate-200 rounded flex items-center justify-center hover:bg-slate-100 transition-colors"
          >
            <span className="text-xs text-slate-600">+</span>
          </button>
        </div>
        <div className="flex-1" />
        <span className="text-[11px] text-slate-400">上下拖动调整高度</span>
      </div>
    </div>
  )
}
