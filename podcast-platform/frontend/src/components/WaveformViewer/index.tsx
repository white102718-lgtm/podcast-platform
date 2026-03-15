import React, { useEffect, useRef } from 'react'
import WaveSurfer from 'wavesurfer.js'
import { useStore } from '@/store'

interface Props {
  audioUrl: string
}

export function WaveformViewer({ audioUrl }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const wsRef = useRef<WaveSurfer | null>(null)
  const { session, transcript, setCurrentTimeMs } = useStore()

  useEffect(() => {
    if (!containerRef.current) return

    wsRef.current = WaveSurfer.create({
      container: containerRef.current,
      waveColor: '#a5b4fc',
      progressColor: '#4f46e5',
      height: 80,
      barWidth: 2,
      barGap: 1,
    })

    wsRef.current.load(audioUrl)

    wsRef.current.on('timeupdate', (currentTime: number) => {
      setCurrentTimeMs(Math.round(currentTime * 1000))
    })

    return () => {
      wsRef.current?.destroy()
    }
  }, [audioUrl, setCurrentTimeMs])

  // Overlay cut regions
  const cutRegions = session?.operations.map(op => ({
    start: op.payload.start_ms / 1000,
    end: op.payload.end_ms / 1000,
  })) ?? []

  const duration = transcript?.words.at(-1)?.end_ms ?? 1
  const durationSec = duration / 1000

  return (
    <div style={{ padding: '0 1rem', position: 'relative' }}>
      <div ref={containerRef} />
      {/* Cut region overlays */}
      {cutRegions.map((r, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            top: 0,
            left: `${(r.start / durationSec) * 100}%`,
            width: `${((r.end - r.start) / durationSec) * 100}%`,
            height: 80,
            background: 'rgba(239, 68, 68, 0.25)',
            pointerEvents: 'none',
          }}
        />
      ))}
    </div>
  )
}
