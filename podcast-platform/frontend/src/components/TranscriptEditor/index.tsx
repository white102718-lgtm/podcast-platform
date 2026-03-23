import React from 'react'
import { useStore } from '@/store'
import { WordToken } from './WordToken'

export function TranscriptEditor() {
  const { transcript, session, currentTimeMs } = useStore()

  if (!transcript || !session) return null

  // Build set of deleted word indices from operations
  const deletedMs = new Set<string>()
  session.operations.forEach(op => {
    transcript.words.forEach((w, i) => {
      if (w.start_ms >= op.payload.start_ms && w.end_ms <= op.payload.end_ms) {
        deletedMs.add(String(i))
      }
    })
  })

  return (
    <div className="flex flex-col flex-1 bg-white border border-slate-200 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
        <span className="text-[11px] font-semibold text-slate-400 tracking-wider uppercase">词级标注</span>
        <span className="text-[11px] text-slate-400">点击词语跳转到对应音频位置</span>
      </div>

      {/* Word token view - scrollable */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="flex flex-wrap gap-1 leading-[1.9]">
          {transcript.words.map((w, i) => (
            <WordToken
              key={i}
              word={w}
              index={i}
              isDeleted={deletedMs.has(String(i))}
              isActive={currentTimeMs >= w.start_ms && currentTimeMs < w.end_ms}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
