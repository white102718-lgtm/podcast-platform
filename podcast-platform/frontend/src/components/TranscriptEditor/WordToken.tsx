import React from 'react'
import type { Word } from '@/types'
import { useStore } from '@/store'

interface Props {
  word: Word
  index: number
  isDeleted: boolean
  isActive: boolean
}

export function WordToken({ word, index, isDeleted, isActive }: Props) {
  const setCurrentTimeMs = useStore(s => s.setCurrentTimeMs)

  return (
    <span
      onClick={() => setCurrentTimeMs(word.start_ms)}
      className={`inline-block mx-0.5 px-1 py-0.5 rounded cursor-pointer font-mono text-[13px] transition-colors ${
        isDeleted
          ? 'bg-red-100 text-red-500 line-through'
          : isActive
          ? 'bg-blue-100 text-blue-700'
          : 'text-slate-900'
      } ${word.confidence < 0.6 ? 'opacity-60' : ''}`}
      title={`${(word.start_ms / 1000).toFixed(2)}s – ${(word.end_ms / 1000).toFixed(2)}s`}
    >
      {word.word}
    </span>
  )
}
